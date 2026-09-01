// backend/googleWorkspace.js
// Thin REST wrappers over Admin Directory + Gmail, using delegated tokens from workspaceAuth.js.
// Replaces the googleapis SDK usage in volunteer-onboarding (workspaceDirectory.ts, gmail.ts,
// gmailSignature.ts) — REST keeps the Velo bundle small.

import { fetch } from 'wix-fetch';
import { getDelegatedAccessToken } from 'backend/workspaceAuth';

const DIRECTORY_SCOPE = 'https://www.googleapis.com/auth/admin.directory.user';
const GMAIL_SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send';
const GMAIL_SETTINGS_SCOPE = 'https://www.googleapis.com/auth/gmail.settings.basic';

async function gapi(method, url, token, body) {
  const resp = await fetch(url, {
    method,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const err = new Error(`${method} ${url} -> ${resp.status}: ${JSON.stringify(json)}`);
    err.code = resp.status;
    throw err;
  }
  return json;
}

/** Create a Workspace user. `requestBody` matches Directory users.insert. */
export async function insertUser(requestBody) {
  const token = await getDelegatedAccessToken([DIRECTORY_SCOPE]);
  return gapi('post', 'https://admin.googleapis.com/admin/directory/v1/users', token, requestBody);
}

/** Get a user (used to poll for propagation). Throws err.code===404 until ready. */
export async function getUser(userKey) {
  const token = await getDelegatedAccessToken([DIRECTORY_SCOPE]);
  return gapi(
    'get',
    `https://admin.googleapis.com/admin/directory/v1/users/${encodeURIComponent(userKey)}?projection=full`,
    token
  );
}

/** Send an HTML email as `fromMailbox` (impersonated). */
export async function sendGmail({ fromMailbox, to, cc, subject, html }) {
  const token = await getDelegatedAccessToken([GMAIL_SEND_SCOPE], fromMailbox);
  const lines = [
    `From: "Polish Youth Association" <${fromMailbox}>`,
    `To: ${to}`,
  ];
  if (cc) lines.push(`Cc: ${cc}`);
  lines.push(
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset="UTF-8"',
    '',
    html
  );
  const raw = Buffer.from(lines.join('\r\n'))
    .toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  return gapi(
    'post',
    `https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(fromMailbox)}/messages/send`,
    token,
    { raw }
  );
}

/** Set the Gmail signature for a user's primary sendAs. Impersonates the target user. */
export async function setGmailSignature(userEmail, signatureHtml) {
  const token = await getDelegatedAccessToken([GMAIL_SETTINGS_SCOPE], userEmail);
  return gapi(
    'patch',
    `https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(userEmail)}/settings/sendAs/${encodeURIComponent(userEmail)}`,
    token,
    { signature: signatureHtml }
  );
}
