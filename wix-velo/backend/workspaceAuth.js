// backend/workspaceAuth.js
// Port of apps/volunteer-onboarding/src/workspaceAuth.ts.
//
// KEY CHANGE: the old code signed the delegation JWT with GCP's IAM signJwt API (no private key in
// the app). Velo has no GCP ambient identity, so we sign the RS256 JWT LOCALLY with the service
// account's private key, stored as the full JSON key in Wix Secrets Manager (GOOGLE_SA_KEY_JSON).
// Domain-wide-delegation config in the Google Admin console (client id -> scopes) is unchanged.
//
// Security note: a raw private key in Secrets Manager is a posture downgrade vs IAM signing.
// Scope-minimize the SA and rotate the key periodically.

import jwt from 'jsonwebtoken';
import { fetch } from 'wix-fetch';
import { getSecret } from 'wix-secrets-backend';

async function loadKey() {
  const raw = await getSecret('GOOGLE_SA_KEY_JSON');
  if (!raw) throw new Error('GOOGLE_SA_KEY_JSON is not set');
  return JSON.parse(raw);
}

async function exchangeJwtForAccessToken(assertion) {
  const body =
    'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') +
    '&assertion=' + encodeURIComponent(assertion);

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'post',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = await resp.json();
  if (!resp.ok) throw new Error(`token exchange failed: ${resp.status} ${JSON.stringify(json)}`);
  if (!json.access_token) throw new Error('token exchange: missing access_token');
  return json.access_token;
}

/**
 * Obtain a delegated Workspace access token for the given scopes, impersonating `subjectEmail`
 * (defaults to WORKSPACE_IMPERSONATE_ADMIN).
 * @param {string[]} scopes
 * @param {string} [subjectEmail]
 * @returns {Promise<string>}
 */
export async function getDelegatedAccessToken(scopes, subjectEmail) {
  const key = await loadKey();
  const subject = (subjectEmail || (await getSecret('WORKSPACE_IMPERSONATE_ADMIN')) || '').trim();
  if (!subject) throw new Error('no impersonation subject (WORKSPACE_IMPERSONATE_ADMIN)');

  const iat = Math.floor(Date.now() / 1000);
  const claims = {
    iss: key.client_email,
    sub: subject,
    scope: scopes.join(' '),
    aud: 'https://oauth2.googleapis.com/token',
    iat,
    exp: iat + 3600,
  };

  const assertion = jwt.sign(claims, key.private_key, {
    algorithm: 'RS256',
    keyid: key.private_key_id,
  });
  return exchangeJwtForAccessToken(assertion);
}
