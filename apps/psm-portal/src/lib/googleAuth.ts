// src/lib/googleAuth.ts
// Google Identity Services (GIS) sign-in for the static GitHub Pages frontend. Replaces the
// IAP header that layout.tsx used to read. The ID token returned here is sent to the Velo
// backend, which verifies it and enforces the @polishyouth.org restriction (backend/auth.js).
//
// Set NEXT_PUBLIC_GOOGLE_CLIENT_ID to the OAuth 2.0 Web client id (same value stored in the Velo
// secret GOOGLE_OAUTH_CLIENT_ID so the `aud` check matches).

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
const HOSTED_DOMAIN = "polishyouth.org";

let currentToken: string | null = null;
let currentEmail: string | null = null;
let resolveToken: ((t: string) => void) | null = null;
let onSignedInCb: ((email: string) => void) | null = null;
let onExpiredCb: (() => void) | null = null;

// Memoized so the GIS script loads once and initialize() runs once.
let gisReady: Promise<void> | null = null;
let initialized = false;

declare global {
  interface Window {
    google?: any;
  }
}

function decodePayload(idToken: string): { email?: string; exp?: number } {
  try {
    return JSON.parse(atob(idToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return {};
  }
}

function decodeEmail(idToken: string): string | null {
  return decodePayload(idToken).email ?? null;
}

// Google ID tokens live 1 hour. Treat one as stale 2 minutes early so a request never races expiry.
function isFresh(idToken: string): boolean {
  const exp = decodePayload(idToken).exp;
  return !!exp && exp * 1000 - 2 * 60 * 1000 > Date.now();
}

function ensureInitialized(): void {
  if (initialized || typeof window === "undefined" || !window.google?.accounts?.id) return;
  window.google.accounts.id.initialize({
    client_id: CLIENT_ID,
    hosted_domain: HOSTED_DOMAIN,
    // Lets One Tap re-issue a token silently for a returning user when the old one expires.
    auto_select: true,
    callback: (resp: { credential: string }) => {
      currentToken = resp.credential;
      currentEmail = decodeEmail(resp.credential);
      if (resolveToken) {
        resolveToken(currentToken);
        resolveToken = null;
      }
      if (onSignedInCb && currentEmail) onSignedInCb(currentEmail);
    },
  });
  initialized = true;
}

// Load the GIS script exactly once; resolve when google.accounts.id is available + initialized.
function loadGis(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (gisReady) return gisReady;
  gisReady = new Promise<void>((resolve) => {
    if (window.google?.accounts?.id) return resolve();
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    document.head.appendChild(s);
  }).then(() => ensureInitialized());
  return gisReady;
}

/**
 * Kick off GIS loading + One Tap prompt. `onSignedIn` fires with the email on every (re)sign-in;
 * `onExpired` fires when a request needs a new token, so the UI can offer the sign-in button.
 */
export function initGoogleAuth(onSignedIn?: (email: string) => void, onExpired?: () => void): void {
  if (onSignedIn) onSignedInCb = onSignedIn;
  if (onExpired) onExpiredCb = onExpired;
  loadGis().then(() => window.google.accounts.id.prompt());
}

export function getCurrentEmail(): string | null {
  return currentEmail;
}

/** Render the official Google sign-in button — waits for GIS to load first (no refresh needed). */
export function renderSignInButton(el: HTMLElement): void {
  loadGis().then(() => {
    window.google.accounts.id.renderButton(el, {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "signin_with",
      shape: "pill",
    });
  });
}

/** Forget the cached token (e.g. the backend rejected it) so the next call fetches a new one. */
export function invalidateIdToken(): void {
  currentToken = null;
}

/**
 * Resolve a fresh ID token. If the cached one is missing or about to expire, ask One Tap for a new
 * one and tell the shell (onExpired) so it can show the sign-in button in case One Tap is suppressed.
 * Pending requests resume as soon as the user is signed back in.
 */
export function getIdToken(): Promise<string> {
  if (currentToken && isFresh(currentToken)) return Promise.resolve(currentToken);
  currentToken = null;
  const hadSession = !!currentEmail;
  return new Promise<string>((resolve) => {
    const prev = resolveToken;
    resolveToken = (t) => {
      prev?.(t);
      resolve(t);
    };
    loadGis().then(() => {
      window.google.accounts.id.prompt();
      if (hadSession) onExpiredCb?.();
    });
  });
}
