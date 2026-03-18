"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { TopNav } from "./topNav";
import { AiSidebar } from "./aiSidebar";
import { UserContext, type Message } from "./userContext";

export function ClientShell({ children, userEmail }: { children: React.ReactNode; userEmail: string | null }) {
  const [aiOpen, setAiOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const pathname = usePathname();
  const storageKey = `psm-chat:${userEmail ?? "anonymous"}`;

  // Load history from sessionStorage after hydration
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) setMessages(JSON.parse(saved));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist history on every change
  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(messages));
    } catch {}
  }, [messages, storageKey]);

  useEffect(() => {
    if (pathname === "/chat") setAiOpen(false);
  }, [pathname]);

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
