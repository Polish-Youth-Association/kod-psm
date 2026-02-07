import { google } from "googleapis";
import { IAMCredentialsClient } from "@google-cloud/iam-credentials";

// Directory API scopes
const SCOPES = [
  "https://www.googleapis.com/auth/admin.directory.user",
  // later:
  // "https://www.googleapis.com/auth/admin.directory.group",
  // "https://www.googleapis.com/auth/admin.directory.group.member",
];

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function base64url(input: string) {
  return Buffer.from(input).toString("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function signJwtWithIamCredentials(serviceAccountEmail: string, payload: object) {
  const header = { alg: "RS256", typ: "JWT" };
  const unsigned =
    `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;

  const iam = new IAMCredentialsClient();
  const [resp] = await iam.signJwt({
    name: `projects/-/serviceAccounts/${serviceAccountEmail}`,
    payload: unsigned,
  });

  if (!resp.signedJwt) throw new Error("signJwt: missing signedJwt");
  return resp.signedJwt;
}

async function exchangeJwtForAccessToken(assertion: string) {
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });

  const json = await resp.json();
  if (!resp.ok) {
    throw new Error(`token exchange failed: ${resp.status} ${JSON.stringify(json)}`);
  }
  if (!json.access_token) throw new Error("token exchange: missing access_token");
  return json.access_token as string;
}

export async function getDirectoryClient() {
  const adminSubject = process.env.WORKSPACE_IMPERSONATE_ADMIN?.trim();
  if (!adminSubject) throw new Error("WORKSPACE_IMPERSONATE_ADMIN is not set");

  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  if (!serviceAccountEmail) {
    // Cloud Run sets this automatically only in some environments. Set it explicitly if needed.
    throw new Error("GOOGLE_SERVICE_ACCOUNT_EMAIL is not set");
  }

  const iat = nowSeconds();
  const exp = iat + 3600;

  // OAuth JWT assertion for domain-wide delegation
  const assertionPayload = {
    iss: serviceAccountEmail,
    scope: SCOPES.join(" "),
    aud: "https://oauth2.googleapis.com/token",
    sub: adminSubject, // this is the delegated admin user
    iat,
    exp,
  };

  const signedJwt = await signJwtWithIamCredentials(serviceAccountEmail, assertionPayload);
  const accessToken = await exchangeJwtForAccessToken(signedJwt);

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });

  return google.admin({ version: "directory_v1", auth });
}