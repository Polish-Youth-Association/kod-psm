"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "./userContext";
import { samePath, sectionOf } from "./sectionTabs";
import { IconHome, IconMail, IconMenu, IconSparkles, IconUserPlus, IconUsers, IconDatabase, IconKey, IconX } from "./icons";

export const NAV_LINKS = [
  { href: "/", label: "Home", Icon: IconHome },
  { href: "/listings", label: "Volunteers", Icon: IconUserPlus, section: "volunteers" },
  { href: "/onboarding-queue", label: "Members", Icon: IconMail, section: "members" },
  { href: "/org", label: "Org", Icon: IconUsers },
  { href: "/data", label: "Data", Icon: IconDatabase },
  { href: "/access", label: "Access", Icon: IconKey },
];

function isActive(pathname: string, link: { href: string; section?: string }) {
  return link.section ? sectionOf(pathname) === link.section : samePath(pathname, link.href);
}

export function TopNav({
  aiOpen,
  onAiToggle,
}: {
  aiOpen?: boolean;
  onAiToggle?: () => void;
}) {
  const pathname = usePathname();
  const { userEmail } = useUser();
  const [menuOpen, setMenuOpen] = useState(false);
  const onChatPage = samePath(pathname, "/chat");
  const initial = (userEmail ?? "?").charAt(0).toUpperCase();

  // Close the mobile menu on navigation.
  useEffect(() => setMenuOpen(false), [pathname]);

  return (
    <header className="sticky top-0 z-30 glass border-x-0 border-t-0 border-b-black/[0.06]">
      <nav className="h-16 max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-3">
        <Link href="/" className="flex items-center shrink-0 mr-2" aria-label="PSM Portal home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://static.wixstatic.com/media/d7f1c6_4692e1506cb8406798ac7defaf85bed1~mv2.png"
            alt="Polish Youth Association"
            width={140}
            height={40}
            className="h-9 sm:h-10 w-auto"
          />
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-1 flex-1">
          {NAV_LINKS.map((link) => {
            const { href, label, Icon } = link;
            const active = isActive(pathname, link);
            return (
              <Link
                key={href}
                href={href}
                title={label}
                className={[
                  "relative flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all duration-200",
                  active
                    ? "text-white bg-gradient-to-br from-brand-red to-brand-rose shadow-glow"
                    : "text-gray-600 hover:text-brand-ink hover:bg-black/[0.04]",
                ].join(" ")}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden lg:inline">{label}</span>
              </Link>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* AI toggle */}
          <button
            onClick={onAiToggle}
            disabled={onChatPage}
            className={[
              "flex items-center gap-1.5 h-9 px-3 rounded-xl text-sm font-semibold border transition-all duration-200",
              onChatPage
                ? "text-gray-300 border-gray-200 cursor-not-allowed"
                : aiOpen
                ? "text-white border-transparent bg-gradient-to-br from-brand-red to-brand-rose shadow-glow"
                : "text-gray-700 bg-white border-gray-200 hover:border-brand-red/40 hover:text-brand-red",
            ].join(" ")}
            aria-label="Toggle AI assistant"
          >
            <IconSparkles className="w-4 h-4" />
            <span className="hidden sm:inline">Ask AI</span>
          </button>

          {userEmail && (
            <div
              title={userEmail}
              className="hidden sm:flex w-9 h-9 rounded-full items-center justify-center text-sm font-bold text-white bg-gradient-to-br from-gray-800 to-gray-600 ring-2 ring-white shadow"
            >
              {initial}
            </div>
          )}

          {/* Mobile menu button */}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="md:hidden w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <IconX className="w-5 h-5" /> : <IconMenu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-black/[0.06] px-4 pb-4 pt-2 animate-fade-up">
          <div className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => {
              const { href, label, Icon } = link;
              const active = isActive(pathname, link);
              return (
                <Link
                  key={href}
                  href={href}
                  className={[
                    "flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold",
                    active
                      ? "text-white bg-gradient-to-br from-brand-red to-brand-rose shadow-glow"
                      : "text-gray-700 hover:bg-black/[0.04]",
                  ].join(" ")}
                >
                  <Icon className="w-5 h-5" />
                  {label}
                </Link>
              );
            })}
            <Link
              href="/chat"
              className={[
                "flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold",
                onChatPage ? "text-white bg-gradient-to-br from-brand-red to-brand-rose" : "text-gray-700 hover:bg-black/[0.04]",
              ].join(" ")}
            >
              <IconSparkles className="w-5 h-5" />
              PSM Assistant
            </Link>
            {userEmail && <p className="px-3 pt-2 text-xs text-gray-500 truncate">Signed in as {userEmail}</p>}
          </div>
        </div>
      )}
    </header>
  );
}
