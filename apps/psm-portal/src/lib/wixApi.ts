// src/lib/wixApi.ts
// Client for the Wix Velo `http-functions` backend, used once the portal is a static site on
// GitHub Pages (plan phase P5). Replaces the Next.js /api/* proxy routes. Every call sends the
// Google Sign-In ID token as a Bearer token; the Velo `assertPsmStaff` gate enforces access.
//
// Set NEXT_PUBLIC_WIX_FUNCTIONS_BASE to your site's functions base, e.g.
//   https://<your-wix-site>/_functions
// (Wix also exposes a /_functions-dev base for the sandbox.)

import { getIdToken, invalidateIdToken } from "@/lib/googleAuth";

const BASE = (process.env.NEXT_PUBLIC_WIX_FUNCTIONS_BASE || "").replace(/\/$/, "");

async function call<T>(method: string, path: string, body?: unknown, retried = false): Promise<T> {
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
  // Token rejected (expired/revoked between our check and the backend's): get a new one, retry once.
  if ((res.status === 401 || res.status === 403) && /id token/i.test((json as any)?.error ?? "") && !retried) {
    invalidateIdToken();
    return call<T>(method, path, body, true);
  }
  if (!res.ok) throw new Error((json as any)?.error || `HTTP ${res.status}`);
  return json as T;
}

// Mirrors the old /api/* surface 1:1.
export type IssuedId = { memberId: string; prefix: string; number: string; issuedAt: string | null };
export type RecentMemberIds = {
  ok: boolean;
  latest: IssuedId | null;
  recent: IssuedId[];
  prefixes: { prefix: string; count: number; last: { memberId: string; issuedAt: string | null } }[];
  driveError?: string;
};

export type OrgPerson = {
  email: string;
  name: string;
  title: string;
  titleFull: string;
  department: string;
  managerEmail: string | null;
  orgUnit: string;
  lastLogin: string | null;
};

export type CmsField = { key: string; label: string };
export type CmsPage = {
  ok: boolean;
  view: string;
  label: string;
  fields: CmsField[];
  items: Record<string, any>[];
  total: number;
  page: number;
  pageSize: number;
};

export const wixApi = {
  chat: (history: { role: string; text: string }[], message: string) =>
    call<{ ok: boolean; reply?: string; error?: string }>("POST", "/chat", { history, message }),

  listQueue: () => call<{ ok: boolean; members: any[] }>("GET", "/queue"),

  deleteFromQueue: (docId: string) =>
    call<{ ok: boolean }>("DELETE", `/queue?docId=${encodeURIComponent(docId)}`),

  readCms: (params: Record<string, string | number>) =>
    call<CmsPage>(
      "GET",
      `/cms?${new URLSearchParams(Object.entries(params).filter(([, v]) => v !== "").map(([k, v]) => [k, String(v)]))}`
    ),

  listOrg: () => call<{ ok: boolean; people: OrgPerson[] }>("GET", "/org"),

  recentMemberIds: () => call<RecentMemberIds>("GET", "/memberIds"),

  approve: (docId: string, firstNamePolish: string, memberId: string) =>
    call<{ ok: boolean; memberId?: string; emailSent?: boolean; certStatus?: string; certError?: string | null }>("POST", "/approve", {
      docId,
      firstNamePolish,
      memberId,
    }),

  sendMemberEmail: (payload: Record<string, unknown>) =>
    call<{ ok: boolean; message?: string; certStatus?: string; certUrl?: string; certError?: string | null }>("POST", "/member", payload),

  provisionVolunteer: (payload: Record<string, unknown>) =>
    call<{ ok: boolean; requestId: string; user: any; tempPassword: string }>("POST", "/volunteer", payload),

  finishVolunteer: (requestId: string) =>
    call<{ ok: boolean; pending?: boolean }>("POST", "/volunteerFinish", { requestId }),
};
