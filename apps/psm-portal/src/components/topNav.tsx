"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";

const links = [
  { href: "/", label: "Home" },
  { href: "/volunteer-onboarding", label: "Volunteer Onboarding" },
  { href: "/member-onboarding", label: "Member Onboarding" },
];

export function TopNav({
  aiOpen,
  onAiToggle,
}: {
  aiOpen?: boolean;
  onAiToggle?: () => void;
}) {
  const pathname = usePathname();
  const onChatPage = pathname === "/chat";
  return (
    <header className="sticky top-0 z-10 bg-white border-b border-brand-border">
      <nav className="h-16 max-w-7xl mx-auto px-6 flex items-center gap-4">
        <div className="flex items-center shrink-0">
          <Image
            src="https://static.wixstatic.com/media/d7f1c6_4692e1506cb8406798ac7defaf85bed1~mv2.png"
            alt="Polish Youth Association"
            width={140}
            height={40}
            className="h-10 w-auto"
            priority
          />
        </div>

        <div className="flex items-center gap-1 ml-4 flex-1">
          {links.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={[
                  "px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150",
                  active
                    ? "bg-brand-red-light text-brand-red"
                    : "text-gray-600 hover:bg-gray-100 hover:text-brand-dark",
                ].join(" ")}
              >
                {l.label}
              </Link>
            );
          })}
        </div>

        {/* AI toggle button */}
        <button
          onClick={onAiToggle}
          disabled={onChatPage}
          className={[
            "ml-auto shrink-0 px-3 py-1.5 rounded-lg text-sm font-semibold border transition-all duration-150",
            onChatPage
              ? "bg-white text-gray-300 border-brand-border cursor-not-allowed"
              : aiOpen
              ? "bg-brand-red text-white border-brand-red shadow-sm"
              : "bg-white text-brand-gray border-brand-border hover:border-brand-red hover:text-brand-red",
          ].join(" ")}
          aria-label="Toggle AI assistant"
        >
          AI
        </button>
      </nav>
    </header>
  );
}
