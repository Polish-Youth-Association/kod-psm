"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { TopNav } from "./topNav";
import { AiSidebar } from "./aiSidebar";
import { UserContext, type Message } from "./userContext";
import { initGoogleAuth, renderSignInButton, getCurrentEmail } from "@/lib/googleAuth";

export function ClientShell({ children }: { children: React.ReactNode }) {
  const [aiOpen, setAiOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const signInRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const storageKey = `psm-chat:${userEmail ?? "anonymous"}`;

  // Google Sign-In: replaces the old IAP header. The backend (Velo assertPsmStaff) is the real
  // security boundary; this gate is a UX convenience + gives us the user's email.
  useEffect(() => {
    initGoogleAuth((email) => setUserEmail(email));
    setUserEmail(getCurrentEmail());
    setAuthReady(true);
  }, []);

  // Render the sign-in button whenever we're showing the gate.
  useEffect(() => {
    if (authReady && !userEmail && signInRef.current) {
      renderSignInButton(signInRef.current);
    }
  }, [authReady, userEmail]);

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
    if (pathname === "/chat") setAiOpen(false);
  }, [pathname]);

  // Auth gate: block the app until a @polishyouth.org account is signed in.
  if (authReady && !userEmail) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="bg-white border border-brand-border rounded-2xl shadow-sm px-8 py-10 flex flex-col items-center gap-5 max-w-sm text-center">
          <h1 className="text-xl font-bold text-brand-dark">PSM Portal</h1>
          <p className="text-sm text-brand-gray">
            Sign in with your <span className="font-medium">@polishyouth.org</span> Google account to continue.
          </p>
          <div ref={signInRef} />
        </div>
      </div>
    );
  }

  return (
    <UserContext.Provider value={{ userEmail, messages, setMessages }}>
      <div className="flex h-screen overflow-hidden">
        {/* Main content — shrinks when sidebar opens */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <TopNav aiOpen={aiOpen} onAiToggle={() => setAiOpen((v) => !v)} />
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>

        {/* Sidebar — animates width to push content left */}
        <div
          className="shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out"
          style={{ width: aiOpen ? "420px" : "0px" }}
          inert={!aiOpen}
        >
          <AiSidebar open={aiOpen} onClose={() => setAiOpen(false)} />
        </div>
      </div>
    </UserContext.Provider>
  );
}
