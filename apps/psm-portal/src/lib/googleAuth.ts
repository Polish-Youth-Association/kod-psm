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

declare global {
  interface Window {
    google?: any;
  }
}

function decodeEmail(idToken: string): string | null {
  try {
    const payload = JSON.parse(atob(idToken.split(".")[1]));
    return payload.email ?? null;
  } catch {
    return null;
  }
}

/** Load the GIS script once and initialize with our client id. */
export function initGoogleAuth(onSignedIn?: (email: string) => void): void {
  if (typeof window === "undefined") return;
  const boot = () => {
    window.google.accounts.id.initialize({
      client_id: CLIENT_ID,
      hosted_domain: HOSTED_DOMAIN,
      callback: (resp: { credential: string }) => {
        currentToken = resp.credential;
        currentEmail = decodeEmail(resp.credential);
        if (resolveToken) { resolveToken(currentToken); resolveToken = null; }
        if (onSignedIn && currentEmail) onSignedIn(currentEmail);
      },
    });
    window.google.accounts.id.prompt();
  };

  if (window.google?.accounts?.id) return boot();
  const s = document.createElement("script");
  s.src = "https://accounts.google.com/gsi/client";
  s.async = true;
  s.defer = true;
  s.onload = boot;
  document.head.appendChild(s);
}

export function getCurrentEmail(): string | null {
  return currentEmail;
}

/** Render the official Google sign-in button into the given element. */
export function renderSignInButton(el: HTMLElement): void {
  if (typeof window === "undefined") return;
  const draw = () => {
    window.google.accounts.id.renderButton(el, {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "signin_with",
      shape: "pill",
    });
  };
  if (window.google?.accounts?.id) draw();
  else initGoogleAuth(); // loads the script; button re-render happens on next call
}

/** Resolve the current ID token, prompting for sign-in if we don't have one yet. */
export function getIdToken(): Promise<string> {
  if (currentToken) return Promise.resolve(currentToken);
  return new Promise<string>((resolve) => {
    resolveToken = resolve;
    if (typeof window !== "undefined" && window.google?.accounts?.id) {
      window.google.accounts.id.prompt();
    } else {
      initGoogleAuth();
    }
  });
}
