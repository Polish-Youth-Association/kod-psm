// backend/auth.js
// Google Sign-In gate. Replaces Cloud Run's domain-restricted invoker + IAP.
//
// The GitHub Pages frontend signs the user in with Google Identity Services and sends the
// resulting ID token as `Authorization: Bearer <id_token>`. Every entrypoint (http-functions
// handler, event handler) MUST call assertPsmStaff() before doing anything else — this is the
// only security boundary now.
//
// We validate via Google's tokeninfo endpoint. It checks the signature and expiry server-side
// and returns the claims. This trades one extra network call for not having to implement JWKS
// verification in Velo; acceptable for a low-traffic internal tool. If you want zero extra
// latency, swap this for local RS256 verification against https://www.googleapis.com/oauth2/v3/certs.

import { fetch } from 'wix-fetch';
import { getSecret } from 'wix-secrets-backend';
import { ALLOWED_DOMAIN } from 'backend/config';

const TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo?id_token=';

export class AuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthError';
    this.status = 401;
  }
}

/**
 * Extracts the bearer token from an http-functions request.
 * @param {import('wix-http-functions').WixHttpFunctionRequest} request
 * @returns {string}
 */
export function bearerFromRequest(request) {
  const header =
    request.headers['authorization'] || request.headers['Authorization'] || '';
  const m = /^Bearer\s+(.+)$/i.exec(header);
  return m ? m[1].trim() : '';
}

/**
 * Verifies a Google ID token and asserts the caller is @polishyouth.org staff.
 * Throws AuthError on any failure. Returns the verified claims on success.
 * @param {string} idToken
 * @returns {Promise<{ email: string, hd?: string, name?: string, sub: string }>}
 */
export async function assertPsmStaff(idToken) {
  if (!idToken) throw new AuthError('missing id token');

  const resp = await fetch(TOKENINFO_URL + encodeURIComponent(idToken), {
    method: 'get',
  });
  if (!resp.ok) throw new AuthError('invalid id token');

  const claims = await resp.json();

  // Expected audience = our Google Sign-In web client id.
  const expectedAud = await getSecret('GOOGLE_OAUTH_CLIENT_ID');
  if (!expectedAud || claims.aud !== expectedAud) {
    throw new AuthError('token audience mismatch');
  }

  const emailVerified = claims.email_verified === true || claims.email_verified === 'true';
  const email = (claims.email || '').toLowerCase();
  const domainOk =
    claims.hd === ALLOWED_DOMAIN || email.endsWith('@' + ALLOWED_DOMAIN);

  if (!email || !emailVerified || !domainOk) {
    throw new AuthError('not authorized for this application');
  }

  return { email, hd: claims.hd, name: claims.name, sub: claims.sub };
}
