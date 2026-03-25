import { IAMCredentialsClient } from '@google-cloud/iam-credentials';

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

async function getDriveAccessToken(): Promise<string> {
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  if (!serviceAccountEmail) throw new Error('GOOGLE_SERVICE_ACCOUNT_EMAIL is not set');

  const subject = process.env.WORKSPACE_IMPERSONATE_ADMIN?.trim();
  if (!subject) throw new Error('WORKSPACE_IMPERSONATE_ADMIN is not set');

  const iam = new IAMCredentialsClient();
  const iat = Math.floor(Date.now() / 1000);

  const claims = {
    iss: serviceAccountEmail,
    sub: subject,
    scope: DRIVE_SCOPE,
    aud: 'https://oauth2.googleapis.com/token',
    iat,
    exp: iat + 3600,
  };

  const [resp] = await iam.signJwt({
    name: `projects/-/serviceAccounts/${serviceAccountEmail}`,
    payload: JSON.stringify(claims),
  });
  if (!resp.signedJwt) throw new Error('signJwt: empty signedJwt');

  const form = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: resp.signedJwt,
  });

  const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form,
  });

  const json: any = await tokenResp.json();
  if (!tokenResp.ok) throw new Error(`token exchange failed: ${tokenResp.status} ${JSON.stringify(json)}`);
  if (!json.access_token) throw new Error('token exchange: missing access_token');
  return json.access_token as string;
}

/**
 * Uploads a PDF buffer to a Google Drive folder.
 * Returns the Drive file ID on success.
 * Requires GOOGLE_DRIVE_FOLDER_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL,
 * and WORKSPACE_IMPERSONATE_ADMIN env vars.
 */
export async function uploadCertificateToDrive(
  pdfBuffer: Uint8Array,
  filename: string,
): Promise<string> {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim();
  if (!folderId) throw new Error('GOOGLE_DRIVE_FOLDER_ID is not set');

  const accessToken = await getDriveAccessToken();

  const metadata = JSON.stringify({
    name: filename,
    parents: [folderId],
    mimeType: 'application/pdf',
  });

  const boundary = '-------PSMCertBoundary';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metaPart = `${delimiter}Content-Type: application/json\r\n\r\n${metadata}`;
  const filePart = `${delimiter}Content-Type: application/pdf\r\n\r\n`;

  const encoder = new TextEncoder();
  const metaBytes = encoder.encode(metaPart);
  const filePartBytes = encoder.encode(filePart);
  const closeBytes = encoder.encode(closeDelimiter);

  const body = new Uint8Array(
    metaBytes.length + filePartBytes.length + pdfBuffer.length + closeBytes.length,
  );
  body.set(metaBytes, 0);
  body.set(filePartBytes, metaBytes.length);
  body.set(pdfBuffer, metaBytes.length + filePartBytes.length);
  body.set(closeBytes, metaBytes.length + filePartBytes.length + pdfBuffer.length);

  const uploadResp = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );

  const result: any = await uploadResp.json();
  if (!uploadResp.ok) throw new Error(`Drive upload failed: ${uploadResp.status} ${JSON.stringify(result)}`);
  return result.id as string;
}
