// backend/cors.js
// CORS + JSON helpers for http-functions called cross-origin from the GitHub Pages frontend.
//
// Set FRONTEND_ORIGIN to your published frontend origin (e.g. https://psm.polishyouth.org).
// Using an explicit origin (not "*") is required because the frontend sends an Authorization header.

import { ok, badRequest, serverError, forbidden, created } from 'wix-http-functions';

// TODO: set to your GitHub Pages custom-domain origin once known.
export const FRONTEND_ORIGIN = 'https://psm.polishyouth.org';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': FRONTEND_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '3600',
    'Content-Type': 'application/json',
  };
}

/** Preflight response for OPTIONS handlers. */
export function preflight() {
  return ok({ headers: corsHeaders(), body: '' });
}

/** 200 with JSON body + CORS. */
export function json(body) {
  return ok({ headers: corsHeaders(), body });
}

/** 201 with JSON body + CORS. */
export function jsonCreated(body) {
  return created({ headers: corsHeaders(), body });
}

/** Map a thrown error (incl. AuthError) to the right status with CORS headers. */
export function fail(err) {
  const headers = corsHeaders();
  const body = { ok: false, error: err && err.message ? err.message : String(err) };
  if (err && err.status === 401) return forbidden({ headers, body });
  if (err && err.status === 400) return badRequest({ headers, body });
  return serverError({ headers, body });
}
