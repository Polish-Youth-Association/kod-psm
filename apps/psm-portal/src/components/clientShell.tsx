"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { TopNav } from "./topNav";
import { AiSidebar } from "./aiSidebar";

export function ClientShell({ children }: { children: React.ReactNode }) {
  const [aiOpen, setAiOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === "/chat") setAiOpen(false);
  }, [pathname]);

  return (
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
  );
}
