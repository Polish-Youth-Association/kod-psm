// backend/http-functions.js
// Browser-facing HTTP surface, called cross-origin by the GitHub Pages frontend at
//   https://<your-wix-site>/_functions/<name>
// This is the 1:1 replacement for the old psm-portal /api/* proxy routes.
//
// Every handler: (1) answers CORS preflight, (2) verifies the Google Sign-In token via
// assertPsmStaff, (3) delegates to an internal backend module, (4) returns JSON with CORS headers.
// No handler may skip the auth gate — it is the entire security boundary.

import { assertPsmStaff, bearerFromRequest } from 'backend/auth';
import { preflight, json, fail } from 'backend/cors';
import { chat } from 'backend/gemini';
import { listPending, deleteMember } from 'backend/queue';
import { approveMember } from 'backend/approve';
import { sendWelcomeEmailManual } from 'backend/memberEmail';
import { provisionVolunteer, finishProvisioning } from 'backend/volunteer';

// --- CORS preflight (browsers send OPTIONS before POST/DELETE with an Authorization header) ---
export function options_chat() { return preflight(); }
export function options_queue() { return preflight(); }
export function options_approve() { return preflight(); }
export function options_member() { return preflight(); }
export function options_volunteer() { return preflight(); }
export function options_volunteerFinish() { return preflight(); }

// --- POST /_functions/chat  { history, message } ---
export async function post_chat(request) {
  try {
    await assertPsmStaff(bearerFromRequest(request));
    const { history, message } = await request.body.json();
    return json(await chat(history, message));
  } catch (err) {
    return fail(err);
  }
}

// --- GET /_functions/queue  -> pending members ---
export async function get_queue(request) {
  try {
    await assertPsmStaff(bearerFromRequest(request));
    return json(await listPending());
  } catch (err) {
    return fail(err);
  }
}

// --- DELETE /_functions/queue?docId=... ---
export async function delete_queue(request) {
  try {
    await assertPsmStaff(bearerFromRequest(request));
    const docId = request.query && request.query.docId;
    return json(await deleteMember(docId));
  } catch (err) {
    return fail(err);
  }
}

// --- POST /_functions/approve  { docId, firstNamePolish } ---
export async function post_approve(request) {
  try {
    const staff = await assertPsmStaff(bearerFromRequest(request));
    const { docId, firstNamePolish } = await request.body.json();
    return json(await approveMember(docId, firstNamePolish, staff));
  } catch (err) {
    return fail(err);
  }
}

// --- POST /_functions/member  (legacy manual welcome email) ---
export async function post_member(request) {
  try {
    await assertPsmStaff(bearerFromRequest(request));
    const payload = await request.body.json();
    return json(await sendWelcomeEmailManual(payload));
  } catch (err) {
    return fail(err);
  }
}

// --- POST /_functions/volunteer  (provision Workspace account, fast part) ---
export async function post_volunteer(request) {
  try {
    await assertPsmStaff(bearerFromRequest(request));
    const payload = await request.body.json();
    return json(await provisionVolunteer(payload));
  } catch (err) {
    return fail(err);
  }
}

// --- POST /_functions/volunteerFinish  { requestId }  (async best-effort steps) ---
export async function post_volunteerFinish(request) {
  try {
    await assertPsmStaff(bearerFromRequest(request));
    const { requestId } = await request.body.json();
    return json(await finishProvisioning(requestId));
  } catch (err) {
    return fail(err);
  }
}
