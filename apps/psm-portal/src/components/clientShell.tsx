"use client";

import { useState } from "react";
import { TopNav } from "./topNav";
import { AiSidebar } from "./aiSidebar";

export function ClientShell({ children }: { children: React.ReactNode }) {
  const [aiOpen, setAiOpen] = useState(false);

  return (
    <>
      <TopNav aiOpen={aiOpen} onAiToggle={() => setAiOpen((v) => !v)} />
      {children}
      <AiSidebar open={aiOpen} onClose={() => setAiOpen(false)} />
    </>
  );
}
