// src/lib/wixApi.ts
// Client for the Wix Velo `http-functions` backend, used once the portal is a static site on
// GitHub Pages (plan phase P5). Replaces the Next.js /api/* proxy routes. Every call sends the
// Google Sign-In ID token as a Bearer token; the Velo `assertPsmStaff` gate enforces access.
//
// Set NEXT_PUBLIC_WIX_FUNCTIONS_BASE to your site's functions base, e.g.
//   https://<your-wix-site>/_functions
// (Wix also exposes a /_functions-dev base for the sandbox.)

import { getIdToken } from "@/lib/googleAuth";

const BASE = (process.env.NEXT_PUBLIC_WIX_FUNCTIONS_BASE || "").replace(/\/$/, "");

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = await getIdToken();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as any)?.error || `HTTP ${res.status}`);
  return json as T;
}

// Mirrors the old /api/* surface 1:1.
export const wixApi = {
  chat: (history: { role: string; text: string }[], message: string) =>
    call<{ ok: boolean; reply?: string; error?: string }>("POST", "/chat", { history, message }),

  listQueue: () => call<{ ok: boolean; members: any[] }>("GET", "/queue"),

  deleteFromQueue: (docId: string) =>
    call<{ ok: boolean }>("DELETE", `/queue?docId=${encodeURIComponent(docId)}`),

  approve: (docId: string, firstNamePolish: string, memberId: string) =>
    call<{ ok: boolean; memberId?: string; emailSent?: boolean }>("POST", "/approve", {
      docId,
      firstNamePolish,
      memberId,
    }),

  sendMemberEmail: (payload: Record<string, unknown>) =>
    call<{ ok: boolean; message?: string }>("POST", "/member", payload),

  provisionVolunteer: (payload: Record<string, unknown>) =>
    call<{ ok: boolean; requestId: string; user: any; tempPassword: string }>("POST", "/volunteer", payload),

  finishVolunteer: (requestId: string) =>
    call<{ ok: boolean }>("POST", "/volunteerFinish", { requestId }),
};
