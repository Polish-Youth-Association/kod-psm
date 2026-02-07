import { google } from "googleapis";
import { IAMCredentialsClient } from "@google-cloud/iam-credentials";

const SCOPES = ["https://www.googleapis.com/auth/admin.directory.user"];

function b64url(s: string) {
  return Buffer.from(s)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function signJwt(unsignedJwt: string, serviceAccountEmail: string) {
  const iam = new IAMCredentialsClient();
  const [resp] = await iam.signJwt({
    name: `projects/-/serviceAccounts/${serviceAccountEmail}`,
    payload: unsignedJwt
  });
  if (!resp.signedJwt) throw new Error("signJwt: empty signedJwt");
  return resp.signedJwt;
}

async function exchangeJwtForAccessToken(assertion: string) {
  const form = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion
  });

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form
  });

  const json: any = await resp.json();
  if (!resp.ok) throw new Error(`token exchange failed: ${resp.status} ${JSON.stringify(json)}`);
  if (!json.access_token) throw new Error("token exchange: missing access_token");
  return json.access_token as string;
}

export async function getDirectoryClient() {
  const subject = process.env.WORKSPACE_IMPERSONATE_ADMIN?.trim();
  if (!subject) throw new Error("WORKSPACE_IMPERSONATE_ADMIN is not set");

  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  if (!serviceAccountEmail) throw new Error("GOOGLE_SERVICE_ACCOUNT_EMAIL is not set");

  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 3600;

  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccountEmail,
    sub: subject,
    scope: SCOPES.join(" "),
    aud: "https://oauth2.googleapis.com/token",
    iat,
    exp
  };

  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const signed = await signJwt(unsigned, serviceAccountEmail);
  const accessToken = await exchangeJwtForAccessToken(signed);

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });

  return google.admin({ version: "directory_v1", auth });
}