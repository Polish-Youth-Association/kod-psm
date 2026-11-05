"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Pages grouped under one top-nav item get a tab bar above them.
export const SECTIONS = {
  volunteers: [
    { href: "/listings", label: "Listings" },
    { href: "/applicants", label: "Applicants" },
    { href: "/volunteer-onboarding", label: "Onboarding" },
  ],
  members: [
    { href: "/onboarding-queue", label: "Queue" },
    { href: "/member-onboarding", label: "Manual send" },
  ],
};

// trailingSlash export: pathname may come back as "/queue/" — compare without it.
export function samePath(a: string, b: string) {
  const norm = (s: string) => (s.length > 1 ? s.replace(/\/+$/, "") : s);
  return norm(a) === norm(b);
}

export function sectionOf(pathname: string) {
  return (Object.keys(SECTIONS) as (keyof typeof SECTIONS)[]).find((k) => SECTIONS[k].some((t) => samePath(pathname, t.href)));
}

export function SectionTabs() {
  const pathname = usePathname();
  const section = sectionOf(pathname);
  if (!section) return null;
  return (
    <div className="px-4 pt-6 flex justify-center">
      <div className="flex gap-1 p-1 rounded-xl bg-white border border-gray-200 max-w-full overflow-x-auto animate-fade-up">
        {SECTIONS[section].map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={[
              "px-4 h-9 flex items-center rounded-lg text-sm font-semibold whitespace-nowrap transition-all",
              samePath(pathname, t.href)
                ? "text-white bg-gradient-to-br from-brand-red to-brand-rose shadow-glow"
                : "text-gray-600 hover:text-brand-ink",
            ].join(" ")}
          >
            {t.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
