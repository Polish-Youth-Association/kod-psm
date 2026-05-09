import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import express, { Request, Response } from 'express';
import cors from 'cors';
import multer from 'multer';
import nodemailer from 'nodemailer';
import { GoogleAuth } from 'google-auth-library';
import { initFirestore, initStorage } from '@kod-psm/gcp-helpers';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getMemberPrefix } from './geoPrefix';

// ---------------------------------------------------------------------------
// SMTP
// ---------------------------------------------------------------------------
type SmtpConfig = {
  SMTP_HOST: string;
  SMTP_PORT: string | number;
  SMTP_USER: string;
  SMTP_PASS: string;
  EMAIL_FROM: string;
};

function loadSmtpConfig(): SmtpConfig | null {
  const raw = process.env.APP_CONFIG_JSON;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<SmtpConfig>;
      const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM } = parsed;
      if (SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS && EMAIL_FROM) {
        return { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM };
      }
      console.warn('APP_CONFIG_JSON missing some SMTP_* fields');
    } catch (err) {
      console.error('Failed to parse APP_CONFIG_JSON:', err);
    }
  }
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !EMAIL_FROM) {
    console.warn('SMTP env vars not fully set. Email endpoints will return 500.');
    return null;
  }
  return { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM };
}

const smtpConfig = loadSmtpConfig();
const transporter = smtpConfig
  ? nodemailer.createTransport({
      host: smtpConfig.SMTP_HOST,
      port: Number(smtpConfig.SMTP_PORT),
      secure: Number(smtpConfig.SMTP_PORT) === 465,
      auth: { user: smtpConfig.SMTP_USER, pass: smtpConfig.SMTP_PASS },
    })
  : null;

// ---------------------------------------------------------------------------
// Email template
// ---------------------------------------------------------------------------
let emailTemplate: string | null = null;

function loadNewMemberTemplate(): string | null {
  if (emailTemplate) return emailTemplate;
  const templatePath = path.resolve(__dirname, '../templates/NewMembersEmailTemplate.html');
  try {
    emailTemplate = fs.readFileSync(templatePath, 'utf8');
  } catch {
    emailTemplate = null;
  }
  return emailTemplate;
}

function renderNewMemberEmail(params: {
  firstNamePolish: string;
  firstNameEnglish: string;
  memberId: string;
}) {
  const base = loadNewMemberTemplate();
  if (!base) {
    return `<h2>Welcome to Polish Youth Association!</h2>
      <p>Dear ${params.firstNamePolish} (${params.firstNameEnglish}),</p>
      <p>Your membership ID is <strong>${params.memberId}</strong>.</p>`;
  }
  return base
    .replace(/{{\s*firstNamePolish\s*}}/gi, params.firstNamePolish)
    .replace(/{{\s*firstNameEnglish\s*}}/gi, params.firstNameEnglish)
    .replace(/{{\s*memberId\s*}}/gi, params.memberId)
    .replace(/\[First Name Polish\]/g, params.firstNamePolish)
    .replace(/\[First Name English\]/g, params.firstNameEnglish)
    .replace(/\[MEMBERSHIP_ID\]/g, params.memberId);
}

// ---------------------------------------------------------------------------
// Firestore + Storage
// ---------------------------------------------------------------------------
const db = initFirestore({ databaseId: 'psm-member-platform' });

const storage = initStorage({
  bucketName: process.env.GCP_BUCKET_NAME,
  projectId: process.env.GCP_PROJECT_ID,
  localBaseDir: path.resolve(__dirname, '../local-certificates'),
});

// ---------------------------------------------------------------------------
// Member ID assignment (atomic counter per prefix)
// ---------------------------------------------------------------------------
async function assignMemberId(prefix: string): Promise<string> {
  const counterRef = db.collection('counters').doc(prefix);
  const number = await db.runTransaction(async (tx) => {
    const snap = await tx.get(counterRef);
    const current: number = snap.exists ? (snap.get('next') as number) : 1;
    tx.set(counterRef, { next: current + 1, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return current;
  });
  return `${prefix}${number}`;
}

// ---------------------------------------------------------------------------
// Certificate generator call (service-to-service)
// ---------------------------------------------------------------------------
async function callCertificateGenerator(
  memberId: string,
  firstName: string,
  lastName: string,
): Promise<{ objectPath?: string; localPath?: string; backend?: string; url?: string }> {
  const base = process.env.CERTIFICATE_GENERATOR_BASE?.trim();
  if (!base) {
    console.warn('CERTIFICATE_GENERATOR_BASE not set — skipping cert generation');
    return {};
  }

  const url = `${base.replace(/\/$/, '')}/generate-certificate`;
  const isLocal = base.includes('localhost');
  const headers: Record<string, string> = { 'content-type': 'application/json' };

  if (!isLocal) {
    const auth = new GoogleAuth();
    const client = await auth.getIdTokenClient(base);
    const authHeaders = await client.getRequestHeaders() as Record<string, string>;
    const token = authHeaders['Authorization'] || authHeaders['authorization'];
    if (token) headers['authorization'] = token;
  }

  const resp = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ memberId, firstName, lastName }),
    cache: 'no-store',
  });

  if (!resp.ok) {
    throw new Error(`certificate-generator returned ${resp.status}: ${await resp.text()}`);
  }

  const json = await resp.json() as Record<string, unknown>;
  return {
    objectPath: json.objectPath as string | undefined,
    localPath:  json.localPath  as string | undefined,
    backend:    json.backend    as string | undefined,
    url:        json.url        as string | undefined,
  };
}

// ---------------------------------------------------------------------------
// Wix Contacts API helpers (REST v4)
// ---------------------------------------------------------------------------
function wixHeaders(): Record<string, string> | null {
  const apiKey   = process.env.WIX_API_KEY?.trim();
  const accountId = process.env.WIX_ACCOUNT_ID?.trim();
  const siteId    = process.env.WIX_SITE_ID?.trim();
  if (!apiKey || !accountId || !siteId) return null;
  return {
    'Authorization': apiKey,
    'wix-account-id': accountId,
    'wix-site-id': siteId,
  };
}

// Find a Wix contact by email. Returns { id, revision } or null.
async function findWixContactByEmail(
  email: string,
): Promise<{ id: string; revision: number } | null> {
  const headers = wixHeaders();
  if (!headers) return null;

  const resp = await fetch('https://www.wixapis.com/contacts/v4/contacts/query', {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({
      query: { filter: { 'info.emails.email': email.trim().toLowerCase() } },
    }),
  });

  if (!resp.ok) {
    console.warn(`Wix contact query failed ${resp.status}: ${await resp.text()}`);
    return null;
  }

  const json = await resp.json() as {
    contacts?: Array<{ id: string; revision?: number; _id?: string; _revision?: number }>;
  };
  const c = json.contacts?.[0];
  if (!c) return null;

  const id = c.id ?? c._id;
  const revision = c.revision ?? c._revision ?? 0;
  if (!id) return null;
  return { id, revision: Number(revision) };
}

// Patch a contact's extended (custom) fields. Best-effort.
async function updateWixContactExtendedFields(
  contactId: string,
  revision: number,
  fields: Record<string, string>,
): Promise<{ ok: boolean; reason?: string }> {
  const headers = wixHeaders();
  if (!headers) return { ok: false, reason: 'no_credentials' };

  const resp = await fetch(`https://www.wixapis.com/contacts/v4/contacts/${encodeURIComponent(contactId)}`, {
    method: 'PATCH',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({
      revision,
      info: { extendedFields: { items: fields } },
    }),
  });

  if (!resp.ok) {
    return { ok: false, reason: `${resp.status}: ${await resp.text()}` };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Wix contact attachment upload (best-effort)
// ---------------------------------------------------------------------------
// Two-step: POST /contacts/v4/attachments/{contactId}/upload-url to get a
// pre-signed uploadUrl, then PUT the PDF bytes there. The file then appears
// in the contact's Attachments tab in the Wix dashboard.
async function attachCertificateToWixContact(params: {
  contactId: string;
  memberId: string;
  certBytes: Uint8Array;
}): Promise<{ ok: boolean; reason?: string; fileId?: string }> {
  const headers = wixHeaders();
  if (!headers) return { ok: false, reason: 'wix_credentials_not_configured' };

  const fileName = `PSM_Certificate_${params.memberId}.pdf`;
  const mimeType = 'application/pdf';

  // 1) Generate upload URL
  const uploadUrlEndpoint =
    `https://www.wixapis.com/contacts/v4/attachments/${encodeURIComponent(params.contactId)}/upload-url`;

  const genResp = await fetch(uploadUrlEndpoint, {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ fileName, mimeType }),
  });

  if (!genResp.ok) {
    return {
      ok: false,
      reason: `generate_upload_url_failed_${genResp.status}: ${await genResp.text()}`,
    };
  }

  const genJson = await genResp.json() as Record<string, any>;
  const uploadUrl: string | undefined = genJson.uploadUrl;
  const fileId: string | undefined =
    genJson.fileId ?? genJson.attachmentId ?? genJson.attachment?.id ?? genJson.id;
  if (!uploadUrl) {
    return { ok: false, reason: 'no_upload_url_in_response' };
  }

  // 2) PUT the PDF bytes to the pre-signed URL
  const putResp = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'content-type': mimeType },
    body: params.certBytes as any,
  });

  if (!putResp.ok) {
    return {
      ok: false,
      reason: `upload_put_failed_${putResp.status}: ${await putResp.text()}`,
    };
  }

  return { ok: true, fileId };
}

// ---------------------------------------------------------------------------
// Wix contact sync orchestrator: lookup → update fields → attach PDF
// ---------------------------------------------------------------------------
type WixSyncResult = {
  contactId?: string;
  attachStatus: 'attached' | 'skipped' | 'failed';
  attachFileId?: string;
  fieldsUpdated: boolean;
};

async function syncWixContact(params: {
  email: string;
  memberId: string;
  certUrl?: string;
  certObjectPath?: string;
  skipAttach?: boolean;
}): Promise<WixSyncResult> {
  const result: WixSyncResult = { attachStatus: 'skipped', fieldsUpdated: false };

  if (!wixHeaders()) {
    console.warn('Wix credentials not configured — skipping contact sync');
    return result;
  }

  // Wix Form widget creates the contact synchronously on submit, but the
  // contact record may take a moment to be queryable. Brief retry loop.
  let contact: { id: string; revision: number } | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    contact = await findWixContactByEmail(params.email);
    if (contact) break;
    if (attempt < 4) await new Promise((r) => setTimeout(r, 800));
  }
  if (!contact) {
    console.warn(`No Wix contact found for ${params.email} after retries`);
    return result;
  }
  result.contactId = contact.id;

  // Update custom fields (best-effort)
  const fields: Record<string, string> = {
    [WIX_FIELD_MEMBER_ID]: params.memberId,
  };
  if (params.certUrl) fields[WIX_FIELD_CERT_URL] = params.certUrl;
  const fieldUpdate = await updateWixContactExtendedFields(contact.id, contact.revision, fields);
  if (fieldUpdate.ok) {
    result.fieldsUpdated = true;
  } else {
    console.warn(`Wix field update failed for ${params.memberId}:`, fieldUpdate.reason);
  }

  // Attach the cert PDF (best-effort)
  if (!params.skipAttach && params.certObjectPath) {
    try {
      const certBytes = await storage.getFile(params.certObjectPath);
      const attach = await attachCertificateToWixContact({
        contactId: contact.id,
        memberId: params.memberId,
        certBytes,
      });
      if (attach.ok) {
        result.attachStatus = 'attached';
        result.attachFileId = attach.fileId;
        console.log(`Attached cert to Wix contact ${contact.id} (file ${attach.fileId})`);
      } else {
        result.attachStatus = 'failed';
        console.warn(`Wix attachment failed for ${params.memberId}:`, attach.reason);
      }
    } catch (err) {
      result.attachStatus = 'failed';
      console.warn(`Wix attachment threw for ${params.memberId}:`, err);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------
const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Health
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ ok: true, service: 'member-onboarding-app' });
});

// ---------------------------------------------------------------------------
// POST /api/intake — Wix webhook
// Body: { apiKey, fullName, email, birthday?, phone?, address: { line1?, city?, state?, postalCode, country } }
// ---------------------------------------------------------------------------
// Custom field keys for Wix contacts (created in the Wix dashboard).
const WIX_FIELD_MEMBER_ID = 'custom.membership_id_cvtyjgiautctnhvxvwcpo';
const WIX_FIELD_CERT_URL  = 'custom.certificate_url';

app.post('/api/intake', async (req: Request, res: Response) => {
  try {
    const { apiKey, fullName, email, birthday, phone, address } = req.body ?? {};

    // Auth
    const expectedKey = process.env.WIX_INTAKE_SECRET;
    if (!expectedKey || apiKey !== expectedKey) {
      return res.status(401).json({ ok: false, error: 'unauthorized' });
    }

    // Validate
    if (!fullName || !email || !address?.postalCode || !address?.country) {
      return res.status(400).json({
        ok: false,
        error: 'fullName, email, address.postalCode, and address.country are required',
      });
    }

    const normalizedEmail = (email as string).trim().toLowerCase();

    // Idempotency: return the existing member if one already exists for this email,
    // so resubmissions don't allocate a fresh memberId or overwrite the Wix contact.
    // Equality on a single field uses an auto-managed index — no composite index needed.
    const existingSnap = await db
      .collection('members')
      .where('email', '==', normalizedEmail)
      .limit(1)
      .get();
    if (!existingSnap.empty) {
      const doc = existingSnap.docs[0];
      const data = doc.data();
      console.log(`Intake dedup hit: ${data.memberId} for ${normalizedEmail}`);

      const dedupSync = await syncWixContact({
        email: normalizedEmail,
        memberId: data.memberId,
        certUrl: data.certUrl,
        certObjectPath: data.certObjectPath,
        skipAttach: data.wixAttachStatus === 'attached',
      });

      if (dedupSync.contactId || dedupSync.attachStatus === 'attached') {
        await doc.ref.update({
          wixContactId: dedupSync.contactId ?? data.wixContactId ?? null,
          wixAttachStatus: dedupSync.attachStatus,
          wixAttachFileId: dedupSync.attachFileId ?? data.wixAttachFileId ?? null,
          wixFieldsUpdated: dedupSync.fieldsUpdated,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      return res.status(200).json({
        ok: true,
        memberId: data.memberId,
        docId: doc.id,
        certStatus: data.certStatus ?? null,
        certUrl: data.certUrl ?? null,
        alreadyExisted: true,
        wixContactId: dedupSync.contactId ?? null,
        wixAttachStatus: dedupSync.attachStatus,
        wixFieldsUpdated: dedupSync.fieldsUpdated,
      });
    }

    // Resolve prefix
    const prefix = getMemberPrefix({ country: address.country, postalCode: address.postalCode })
      ?? 'DNY'; // fallback to HQ

    // Assign member ID
    const memberId = await assignMemberId(prefix);

    // Split name for certificate (first word = first name, rest = last name)
    const [firstName, ...rest] = (fullName as string).trim().split(/\s+/);
    const lastName = rest.join(' ') || firstName;

    // Generate certificate (best-effort — member is stored even if this fails)
    let certObjectPath: string | undefined;
    let certLocalPath: string | undefined;
    let certBackend: string | undefined;
    let certUrl: string | undefined;
    let certStatus: 'generated' | 'failed' | 'pending' = 'pending';

    try {
      const cert = await callCertificateGenerator(memberId, firstName, lastName);
      certObjectPath = cert.objectPath;
      certLocalPath  = cert.localPath;
      certBackend    = cert.backend;
      certUrl        = cert.url;
      certStatus     = 'generated';
    } catch (certErr) {
      console.error('Certificate generation failed for', memberId, certErr);
      certStatus = 'failed';
    }

    // Sync Wix contact: look up by email, attach PDF, update custom fields.
    const sync = await syncWixContact({
      email: normalizedEmail,
      memberId,
      certUrl,
      certObjectPath,
      skipAttach: certStatus !== 'generated',
    });

    // Persist member
    const memberRef = db.collection('members').doc();
    await memberRef.set({
      memberId,
      prefix,
      fullName,
      firstName,
      lastName,
      email: normalizedEmail,
      birthday: birthday ?? null,
      phone: phone ?? null,
      address,
      onboardingStatus: 'NOT_ONBOARDED',
      certStatus,
      certObjectPath: certObjectPath ?? null,
      certLocalPath: certLocalPath ?? null,
      certBackend: certBackend ?? null,
      certUrl: certUrl ?? null,
      wixContactId: sync.contactId ?? null,
      wixAttachStatus: sync.attachStatus,
      wixAttachFileId: sync.attachFileId ?? null,
      wixFieldsUpdated: sync.fieldsUpdated,
      source: 'wix',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log(`Intake complete: ${memberId} (${prefix}) for ${email}`);
    return res.status(201).json({
      ok: true,
      memberId,
      docId: memberRef.id,
      certStatus,
      certUrl: certUrl ?? null,
      wixContactId: sync.contactId ?? null,
      wixAttachStatus: sync.attachStatus,
      wixFieldsUpdated: sync.fieldsUpdated,
    });
  } catch (err: any) {
    console.error('Intake error:', err);
    return res.status(500).json({ ok: false, error: err?.message ?? String(err) });
  }
});

// ---------------------------------------------------------------------------
// GET /api/members/pending — list NOT_ONBOARDED members for the portal queue
// Requires composite index: onboardingStatus ASC, createdAt DESC (see infra/db.yaml)
// ---------------------------------------------------------------------------
app.get('/api/members/pending', async (_req: Request, res: Response) => {
  try {
    const snap = await db
      .collection('members')
      .where('onboardingStatus', '==', 'NOT_ONBOARDED')
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();

    const members = snap.docs.map((d) => {
      const data = d.data();
      return {
        docId: d.id,
        memberId:     data.memberId,
        fullName:     data.fullName,
        firstName:    data.firstName,
        lastName:     data.lastName,
        email:        data.email,
        prefix:       data.prefix,
        address:      data.address,
        birthday:     data.birthday,
        phone:        data.phone,
        certStatus:   data.certStatus,
        createdAt:    data.createdAt,
      };
    });

    return res.json({ ok: true, members });
  } catch (err: any) {
    console.error('Pending members error:', err);
    return res.status(500).json({ ok: false, error: err?.message ?? String(err) });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/members/:docId — remove a member from the queue.
// Deletes the Firestore doc only. The cert PDF in GCS is preserved (cheap
// safety net; can be regenerated). Wix contact is not touched.
// ---------------------------------------------------------------------------
app.delete('/api/members/:docId', async (req: Request, res: Response) => {
  try {
    const { docId } = req.params;
    const memberRef = db.collection('members').doc(docId);
    const snap = await memberRef.get();
    if (!snap.exists) {
      return res.status(404).json({ ok: false, error: 'member not found' });
    }
    await memberRef.delete();
    console.log(`Deleted member ${snap.data()?.memberId ?? docId}`);
    return res.json({ ok: true });
  } catch (err: any) {
    console.error('Delete member error:', err);
    return res.status(500).json({ ok: false, error: err?.message ?? String(err) });
  }
});

// ---------------------------------------------------------------------------
// POST /api/members/:docId/approve — admin verifies details and triggers email
// Body: { firstNamePolish }
// ---------------------------------------------------------------------------
app.post('/api/members/:docId/approve', async (req: Request, res: Response) => {
  try {
    if (!transporter || !smtpConfig) {
      return res.status(500).json({ ok: false, error: 'Email transport not configured' });
    }

    const { docId } = req.params;
    const { firstNamePolish } = req.body ?? {};

    if (!firstNamePolish?.trim()) {
      return res.status(400).json({ ok: false, error: 'firstNamePolish is required' });
    }

    const memberRef = db.collection('members').doc(docId);
    const snap = await memberRef.get();
    if (!snap.exists) return res.status(404).json({ ok: false, error: 'member not found' });

    const member = snap.data()!;
    if (member.onboardingStatus === 'ONBOARDED') {
      return res.status(409).json({ ok: false, error: 'member already onboarded' });
    }

    // Fetch certificate — generate on the fly if not already done at intake
    let attachments: { filename: string; content: Buffer; contentType: string }[] = [];
    let certObjectPath = member.certObjectPath as string | undefined;

    if (member.certStatus !== 'generated' || !certObjectPath) {
      try {
        const cert = await callCertificateGenerator(member.memberId, member.firstName, member.lastName);
        if (cert.objectPath) {
          certObjectPath = cert.objectPath;
          await memberRef.update({
            certStatus: 'generated',
            certObjectPath: cert.objectPath,
            certLocalPath: cert.localPath ?? null,
            certBackend: cert.backend ?? null,
            certUrl: cert.url ?? null,
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      } catch (certErr) {
        console.warn('On-demand cert generation failed for', member.memberId, certErr);
      }
    }

    if (certObjectPath) {
      try {
        let certBuffer: Buffer;
        if (member.certBackend === 'local' && member.certLocalPath) {
          certBuffer = await fsp.readFile(member.certLocalPath);
        } else {
          certBuffer = await storage.getFile(certObjectPath);
        }
        attachments = [{
          filename: `PSM_Certificate_${member.memberId}.pdf`,
          content: certBuffer,
          contentType: 'application/pdf',
        }];
      } catch (certErr) {
        console.warn('Could not retrieve certificate for', member.memberId, certErr);
        // Send email without certificate rather than failing
      }
    }

    // Send welcome email
    const html = renderNewMemberEmail({
      firstNamePolish: firstNamePolish.trim(),
      firstNameEnglish: member.firstName,
      memberId: member.memberId,
    });

    await transporter.sendMail({
      from: `"PSM Onboarding" <${smtpConfig.EMAIL_FROM}>`,
      to: member.email,
      cc: 'records@polishyouth.org',
      subject: `Welcome to Polish Youth Association! (ID: ${member.memberId})`,
      html,
      attachments,
    });

    // Mark as onboarded
    await memberRef.update({
      onboardingStatus: 'ONBOARDED',
      firstNamePolish: firstNamePolish.trim(),
      onboardedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log(`Onboarded: ${member.memberId} (${member.email})`);
    return res.json({ ok: true, memberId: member.memberId });
  } catch (err: any) {
    console.error('Approve error:', err);
    return res.status(500).json({ ok: false, error: err?.message ?? String(err) });
  }
});

// ---------------------------------------------------------------------------
// POST /api/onboard — kept for backwards compatibility with existing portal page
// ---------------------------------------------------------------------------
app.post(
  '/api/onboard',
  upload.single('certificate'),
  async (req: Request, res: Response) => {
    try {
      if (!transporter || !smtpConfig) {
        return res.status(500).json({ error: 'Email transport not configured.' });
      }
      const { firstNamePolish, firstNameEnglish, email, memberId } = req.body;
      if (!firstNamePolish || !firstNameEnglish || !email || !memberId) {
        return res.status(400).json({ error: 'Missing required fields.' });
      }
      const html = renderNewMemberEmail({ firstNamePolish, firstNameEnglish, memberId });
      const certFile = req.file ?? null;
      await transporter.sendMail({
        from: `"PSM Onboarding" <${smtpConfig.EMAIL_FROM}>`,
        to: email,
        cc: 'records@polishyouth.org',
        subject: `Welcome to Polish Youth Association! (ID: ${memberId})`,
        html,
        attachments: certFile
          ? [{ filename: certFile.originalname, content: certFile.buffer, contentType: certFile.mimetype }]
          : [],
      });
      return res.json({ ok: true, message: 'Onboarding email sent.' });
    } catch (err) {
      console.error('Error in /api/onboard:', err);
      return res.status(500).json({ error: 'Internal server error.' });
    }
  },
);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`member-onboarding listening on port ${PORT}`);
});
