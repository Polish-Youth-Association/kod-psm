// backend/volunteer.js
// Port of apps/volunteer-onboarding POST /v1/onboarding/volunteers, REDESIGNED FOR VELO.
//
// Velo web/http functions have a short (~14s) timeout. The old flow polled up to 30s for user
// propagation and retried the Gmail signature up to ~minutes — impossible in one invocation. So we
// split it in two:
//   provisionVolunteer()  -> fast, must-succeed: validate + Directory users.insert; persist a
//                            VolunteerRequests row; return { requestId, primaryEmail, tempPassword }.
//   finishProvisioning()  -> best-effort tail: wait for propagation, set signature, send 2 emails,
//                            trigger Slack; record per-step status. Called by the frontend after a
//                            short delay, or by a Wix scheduled job.

import crypto from 'crypto';
import wixData from 'wix-data';
import { fetch } from 'wix-fetch';
import { getSecret } from 'wix-secrets-backend';
import { COLLECTIONS } from 'backend/config';
import { insertUser, getUser, sendGmail, setGmailSignature } from 'backend/googleWorkspace';
import {
  ONBOARDING_TEMPLATE_HTML,
  ONBOARDING_TEMPLATE_PSM_HTML,
  renderTemplate,
  buildSignatureHtml,
} from 'backend/templates';

const AUTH = { suppressAuth: true };
const CC_EMAIL = 'onboarding@polishyouth.org';

function isEmail(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s).trim()); }

function toEmailLocalPart(first, last) {
  return `${first}.${last}`.trim().toLowerCase().normalize('NFKD')
    .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9.]/g, '')
    .replace(/\.+/g, '.').replace(/^\.+|\.+$/g, '');
}

async function generateTempPassword() {
  const prefix = (await getSecret('WORKSPACE_TEMP_PASSWORD_PREFIX')) || 'Psm!';
  return `${prefix}${crypto.randomBytes(12).toString('base64url')}A1`;
}

/** Fast, synchronous part: create the Workspace user and record the request. */
export async function provisionVolunteer(body) {
  body = body || {};
  if (!body.firstName || !body.lastName || !body.personalEmail) {
    throw Object.assign(new Error('Missing required fields: firstName, lastName, personalEmail'), { status: 400 });
  }
  if (!isEmail(body.personalEmail)) {
    throw Object.assign(new Error('personalEmail is not valid'), { status: 400 });
  }

  const domain = ((await getSecret('WORKSPACE_DOMAIN')) || 'polishyouth.org').trim();
  const local = toEmailLocalPart(body.firstName, body.lastName);
  const primaryEmail =
    body.suggestedPrimaryEmail && String(body.suggestedPrimaryEmail).includes('@')
      ? String(body.suggestedPrimaryEmail).trim()
      : `${local}@${domain}`;
  const orgUnitPath = ((await getSecret('DEFAULT_ORG_UNIT')) || '/').trim();
  const tempPassword = await generateTempPassword();

  const requestBody = {
    primaryEmail,
    name: { givenName: String(body.firstName).trim(), familyName: String(body.lastName).trim() },
    password: tempPassword,
    changePasswordAtNextLogin: true,
    recoveryEmail: String(body.personalEmail).trim(),
    orgUnitPath,
  };
  if (body.phoneNumber && String(body.phoneNumber).trim()) {
    requestBody.phones = [{ type: 'mobile', value: String(body.phoneNumber).trim() }];
  }
  if (body.title && String(body.title).trim()) {
    requestBody.organizations = [{ title: String(body.title).trim(), primary: true }];
  }
  if (body.birthday && String(body.birthday).trim()) {
    const [y, m, d] = String(body.birthday).trim().split('-').map(Number);
    if (y && m && d) requestBody.birthdays = [{ date: { year: y, month: m, day: d } }];
  }

  let created;
  try {
    created = await insertUser(requestBody);
  } catch (err) {
    // Directory returns 409 if the user already exists — surface it like the old service.
    throw Object.assign(new Error(err.message), { status: err.code === 409 ? 400 : 500 });
  }

  const row = await wixData.insert(
    COLLECTIONS.volunteerRequests,
    {
      status: 'Provisioned',
      primaryEmail: created.primaryEmail || primaryEmail,
      userId: created.id || null,
      firstName: String(body.firstName).trim(),
      lastName: String(body.lastName).trim(),
      title: (body.title || '').trim(),
      personalEmail: String(body.personalEmail).trim(),
      tempPassword, // stored so finishProvisioning can email it; delete the row after completion
      signatureStatus: 'Pending',
      emailStatus: 'Pending',
      docusignStatus: 'Pending',
    },
    AUTH
  );

  return {
    ok: true,
    requestId: row._id,
    status: 'Provisioned',
    user: { id: created.id, primaryEmail: created.primaryEmail || primaryEmail },
    tempPassword,
  };
}

/** Best-effort tail. Idempotent enough to be retried by a scheduled job. */
export async function finishProvisioning(requestId) {
  const req = await wixData.get(COLLECTIONS.volunteerRequests, requestId, AUTH);
  if (!req) throw Object.assign(new Error('request not found'), { status: 400 });

  const createdEmail = req.primaryEmail;

  // Wait for propagation, but bounded to fit one invocation (was 30s; now ~10s).
  for (let i = 0; i < 5; i++) {
    try { await getUser(createdEmail); break; }
    catch (err) { if (err.code !== 404) throw err; await new Promise((r) => setTimeout(r, 2000)); }
  }

  // Signature (best-effort)
  try {
    await setGmailSignature(
      createdEmail,
      buildSignatureHtml({ firstName: req.firstName, lastName: req.lastName, email: createdEmail, title: req.title })
    );
    req.signatureStatus = 'Set';
  } catch (e) { req.signatureStatus = 'Failed'; }

  // Onboarding emails (best-effort)
  try {
    const slackInviteLink = (await getSecret('SLACK_INVITE_LINK')) || '';
    const vars = {
      FIRST_NAME: req.firstName, TITLE: req.title,
      POLISH_YOUTH_EMAIL: createdEmail, TEMP_PASSWORD: req.tempPassword, SLACK_INVITE_LINK: slackInviteLink,
    };
    await sendGmail({
      fromMailbox: (await getSecret('ONBOARDING_FROM_EMAIL')).trim(),
      to: req.personalEmail, cc: CC_EMAIL,
      subject: 'Welcome to the Polish Youth Association Volunteer Team!',
      html: renderTemplate(ONBOARDING_TEMPLATE_HTML, vars),
    });
    await sendGmail({
      fromMailbox: (await getSecret('ONBOARDING_FROM_EMAIL')).trim(),
      to: createdEmail, cc: CC_EMAIL,
      subject: 'Welcome to the Polish Youth Association Volunteer Team!',
      html: renderTemplate(ONBOARDING_TEMPLATE_PSM_HTML, { ...vars, TEMP_PASSWORD: '—' }),
    });
    req.emailStatus = 'Sent';
  } catch (e) { req.emailStatus = 'Failed'; }

  // Slack DocuSign workflow (best-effort)
  try {
    const webhookUrl = (await getSecret('SLACK_DOCUSIGN_WORKFLOW_WEBHOOK_URL') || '').trim();
    if (!webhookUrl) throw new Error('SLACK_DOCUSIGN_WORKFLOW_WEBHOOK_URL not set');
    const resp = await fetch(webhookUrl, {
      method: 'post',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ EMAIL: req.personalEmail, NAME: `${req.firstName} ${req.lastName}`.trim() }),
    });
    if (!resp.ok) throw new Error(`Slack webhook ${resp.status}`);
    req.docusignStatus = 'Sent';
  } catch (e) { req.docusignStatus = 'Failed'; }

  req.tempPassword = null; // scrub the password once we're done emailing it
  await wixData.update(COLLECTIONS.volunteerRequests, req, AUTH);

  return {
    ok: true,
    requestId,
    signature: { status: req.signatureStatus },
    email: { status: req.emailStatus },
    docusign: { status: req.docusignStatus },
  };
}
