import { IAMCredentialsClient } from "@google-cloud/iam-credentials";

async function signClaims(claims: object, serviceAccountEmail: string) {
  const iam = new IAMCredentialsClient();
  const [resp] = await iam.signJwt({
    name: `projects/-/serviceAccounts/${serviceAccountEmail}`,
    payload: JSON.stringify(claims),
  });
  if (!resp.signedJwt) throw new Error("signJwt: empty signedJwt");
  return resp.signedJwt;
}

async function exchangeJwtForAccessToken(assertion: string) {
  const form = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form,
  });

  const json: any = await resp.json();
  if (!resp.ok) throw new Error(`token exchange failed: ${resp.status} ${JSON.stringify(json)}`);
  if (!json.access_token) throw new Error("token exchange: missing access_token");
  return json.access_token as string;
}

export async function getDelegatedAccessToken(scopes: string[]) {
  const subject = process.env.WORKSPACE_IMPERSONATE_ADMIN?.trim();
  if (!subject) throw new Error("WORKSPACE_IMPERSONATE_ADMIN is not set");

  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  if (!serviceAccountEmail) throw new Error("GOOGLE_SERVICE_ACCOUNT_EMAIL is not set");

  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 3600;

  const claims = {
    iss: serviceAccountEmail,
    sub: subject,
    scope: scopes.join(" "),
    aud: "https://oauth2.googleapis.com/token",
    iat,
    exp,
  };

  const signedJwt = await signClaims(claims, serviceAccountEmail);
  return await exchangeJwtForAccessToken(signedJwt);
}