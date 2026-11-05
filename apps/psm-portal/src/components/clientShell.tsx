"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { TopNav } from "./topNav";
import { SectionTabs } from "./sectionTabs";
import { ToastProvider } from "./toast";
import { AiSidebar } from "./aiSidebar";
import { UserContext, type Message } from "./userContext";
import { initGoogleAuth, renderSignInButton, getCurrentEmail } from "@/lib/googleAuth";

export function ClientShell({ children }: { children: React.ReactNode }) {
  const [aiOpen, setAiOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const signInRef = useRef<HTMLDivElement>(null);
  const reSignInRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const storageKey = `psm-chat:${userEmail ?? "anonymous"}`;

  // Google Sign-In: replaces the old IAP header. The backend (Velo assertPsmStaff) is the real
  // security boundary; this gate is a UX convenience + gives us the user's email.
  useEffect(() => {
    initGoogleAuth(
      (email) => {
        setUserEmail(email);
        setSessionExpired(false);
      },
      () => setSessionExpired(true)
    );
    setUserEmail(getCurrentEmail());
    setAuthReady(true);
  }, []);

  // Render the sign-in button whenever we're showing the gate.
  useEffect(() => {
    if (authReady && !userEmail && signInRef.current) {
      renderSignInButton(signInRef.current);
    }
  }, [authReady, userEmail]);

  // Session expired mid-use: show the button in an overlay (keeps the page and any typed form intact).
  useEffect(() => {
    if (sessionExpired && reSignInRef.current) renderSignInButton(reSignInRef.current);
  }, [sessionExpired]);

  // Load history from sessionStorage after hydration
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) setMessages(JSON.parse(saved));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userEmail]);

  // Persist history on every change
  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(messages));
    } catch {}
  }, [messages, storageKey]);

  useEffect(() => {
    if (pathname.replace(/\/+$/, "") === "/chat") setAiOpen(false);
  }, [pathname]);

  // Auth gate: block the app until a @polishyouth.org account is signed in.
  if (authReady && !userEmail) {
    return (
      <div className="relative min-h-screen grid lg:grid-cols-2">
        <Aurora />
        {/* Brand panel */}
        <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-red via-[#d4163a] to-brand-rose p-12 text-white">
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black/20 to-transparent" />
          <p className="relative text-sm font-semibold tracking-[0.2em] uppercase text-white/80">Polskie Stowarzyszenie Młodzieży</p>
          <div className="relative">
            <h2 className="text-5xl font-extrabold leading-[1.05] tracking-tight">
              Everything PSM,
              <br />
              one place.
            </h2>
            <p className="mt-5 text-lg text-white/85 max-w-md">
              Onboard members and volunteers, work the queue, and ask the assistant, all from here.
            </p>
          </div>
          <p className="relative text-xs text-white/70">Staff only · polishyouth.org</p>
        </div>

        {/* Sign-in card */}
        <div className="flex items-center justify-center p-6">
          <div className="card w-full max-w-sm px-8 py-10 flex flex-col items-center gap-6 text-center animate-fade-up">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://static.wixstatic.com/media/d7f1c6_4692e1506cb8406798ac7defaf85bed1~mv2.png"
              alt="Polish Youth Association"
              className="h-12 w-auto"
            />
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-brand-ink">
                Welcome to <span className="gradient-text">PSM Portal</span>
              </h1>
              <p className="mt-2 text-sm text-gray-600">
                Sign in with your <span className="font-semibold text-brand-ink">@polishyouth.org</span> Google account to continue.
              </p>
            </div>
            <div ref={signInRef} className="min-h-[44px]" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <UserContext.Provider value={{ userEmail, messages, setMessages }}>
     <ToastProvider>
      <Aurora />
      <div className="flex h-screen overflow-hidden">
        {/* Main content — shrinks when sidebar opens */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <TopNav aiOpen={aiOpen} onAiToggle={() => setAiOpen((v) => !v)} />
          <main className="flex-1 overflow-y-auto">
            <SectionTabs />
            {children}
          </main>
        </div>

        {/* Sidebar: pushes content left on desktop, slides over it full-width on phones. */}
        <div
          className={[
            "overflow-hidden transition-[width,transform] duration-300 ease-in-out",
            "fixed inset-y-0 right-0 z-40 w-full sm:w-[420px] lg:static lg:shrink-0",
            aiOpen ? "translate-x-0 lg:w-[420px]" : "translate-x-full lg:translate-x-0 lg:w-0",
          ].join(" ")}
          inert={!aiOpen}
        >
          <AiSidebar open={aiOpen} onClose={() => setAiOpen(false)} />
        </div>
      </div>

      {sessionExpired && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-6">
          <div className="card w-full max-w-sm px-8 py-8 flex flex-col items-center gap-4 text-center animate-fade-up">
            <p className="text-lg font-bold text-brand-ink">Session expired</p>
            <p className="text-sm text-gray-600">
              Google sign-ins last an hour. Sign in again and we&apos;ll pick up where you left off.
            </p>
            <div ref={reSignInRef} />
          </div>
        </div>
      )}
     </ToastProvider>
    </UserContext.Provider>
  );
}

/** Slow drifting colour blobs behind the app (decorative). */
function Aurora() {
  return (
    <div className="aurora" aria-hidden="true">
      <span className="w-[42rem] h-[42rem] -top-60 -left-40 bg-brand-red/[0.07]" />
      <span className="w-[36rem] h-[36rem] top-1/3 -right-48 bg-brand-rose/[0.08]" style={{ animationDelay: "-6s" }} />
      <span className="w-[30rem] h-[30rem] -bottom-40 left-1/3 bg-amber-300/[0.08]" style={{ animationDelay: "-12s" }} />
    </div>
  );
}
