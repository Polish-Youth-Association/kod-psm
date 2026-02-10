// apps/volunteer-onboarding/src/docusign.ts
import crypto from "node:crypto";

type DocuSignConfig = {
  integrationKey: string; // DS_CLIENT_ID
  userId: string;         // DS_USER_ID (GUID)
  accountId: string;      // DS_ACCOUNT_ID (GUID)
  basePath: string;       // DS_BASE_PATH e.g. https://demo.docusign.net or https://www.docusign.net
  authServer: string;     // DS_AUTH_SERVER e.g. account-d.docusign.com or account.docusign.com
  privateKeyPem: string;  // DS_PRIVATE_KEY_PEM (PEM contents)
};

function requiredEnv(name: string) {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

function loadConfig(): DocuSignConfig {
  return {
    integrationKey: requiredEnv("DS_CLIENT_ID"),
    userId: requiredEnv("DS_USER_ID"),
    accountId: requiredEnv("DS_ACCOUNT_ID"),
    basePath: requiredEnv("DS_BASE_PATH"),
    authServer: requiredEnv("DS_AUTH_SERVER"),
    privateKeyPem: requiredEnv("DS_PRIVATE_KEY_PEM"),
  };
}

function base64url(buf: Buffer) {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function signJwtRS256(payload: object, privateKeyPem: string) {
  const header = { alg: "RS256", typ: "JWT" };
  const encHeader = base64url(Buffer.from(JSON.stringify(header)));
  const encPayload = base64url(Buffer.from(JSON.stringify(payload)));
  const unsigned = `${encHeader}.${encPayload}`;

  const sig = crypto.createSign("RSA-SHA256").update(unsigned).sign(privateKeyPem);
  return `${unsigned}.${base64url(sig)}`;
}

async function getAccessToken(cfg: DocuSignConfig) {
  const now = Math.floor(Date.now() / 1000);
  const jwt = signJwtRS256(
    {
      iss: cfg.integrationKey,
      sub: cfg.userId,
      aud: `https://${cfg.authServer}`,
      iat: now,
      exp: now + 3600,
      scope: "signature impersonation",
    },
    cfg.privateKeyPem
  );

  const form = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: jwt,
  });

  const resp = await fetch(`https://${cfg.authServer}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form,
  });

  const json: any = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(`DocuSign token error: ${resp.status} ${JSON.stringify(json)}`);
  }
  if (!json.access_token) throw new Error("DocuSign token: missing access_token");
  return json.access_token as string;
}

export async function sendVolunteerAgreementEnvelope(args: {
  // who signs
  signerEmail: string; // likely personal email
  signerName: string;  // "First Last"
  // which template
  templateId: string;  // DS_TEMPLATE_VOLUNTEER_AGREEMENT
  // optional: email subject/message shown by DocuSign
  emailSubject?: string;
  emailBlurb?: string;
}) {
  const cfg = loadConfig();
  const token = await getAccessToken(cfg);

  const url = `${cfg.basePath.replace(/\/$/, "")}/restapi/v2.1/accounts/${cfg.accountId}/envelopes`;

  // Template-role based send
  // NOTE: "roleName" must match the role in your DocuSign template (e.g. "Volunteer")
  const body = {
    status: "sent",
    emailSubject: args.emailSubject ?? "Polish Youth Association — Volunteer Agreement",
    emailBlurb:
      args.emailBlurb ??
      "Please review and sign the volunteering agreement to complete onboarding.",
    templateId: args.templateId,
    templateRoles: [
      {
        roleName: "Volunteer", // <-- IMPORTANT: match your DocuSign template role
        name: args.signerName,
        email: args.signerEmail,
      },
    ],
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const json: any = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(`DocuSign envelope error: ${resp.status} ${JSON.stringify(json)}`);
  }

  return {
    envelopeId: json.envelopeId as string | undefined,
    status: json.status as string | undefined,
  };
}