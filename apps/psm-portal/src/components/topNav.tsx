"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Home" },
  { href: "/volunteer-onboarding", label: "Volunteer Onboarding" }
  // later: { href: "/member-onboarding", label: "Member Onboarding" },
  // later: { href: "/reimbursements", label: "Reimbursements" },
];

export function TopNav() {
  const pathname = usePathname();

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        background: "white",
        borderBottom: "1px solid rgba(0, 0, 0, 0.08)"
      }}
    >
      <nav
        style={{
          maxWidth: "100%",
          margin: 0,
          padding: "12px 16px",
          display: "flex",
          alignItems: "left",
          gap: 16
        }}
      >
        <div style={{ fontWeight: 650 }}>PSM Portal</div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {links.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                style={{
                  textDecoration: "none",
                  padding: "6px 10px",
                  borderRadius: 10,
                  border: active ? "1px solid rgba(0,0,0,0.25)" : "1px solid transparent",
                  background: active ? "rgba(0,0,0,0.04)" : "transparent",
                  color: "inherit"
                }}
              >
                {l.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}