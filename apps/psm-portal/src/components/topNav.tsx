"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Home" },
  { href: "/volunteer-onboarding", label: "Volunteer Onboarding" }
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
          height: 56,
          maxWidth: "100%",
          padding: "0 16px",
          display: "flex",
          alignItems: "center",
          gap: 16
        }}
      >
        <div style={{ 
            fontWeight: 650,
            lineHeight: "20px" 
        }}>PSM Portal</div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {links.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                style={{
                    display: "inline-flex",
                    alignItems: "center",
                    height: 36,
                    padding: "0 12px",
                    borderRadius: 12,
                    border: active
                      ? "1px solid rgba(0,0,0,0.30)"
                      : "1px solid transparent",
                    background: active ? "rgba(0,0,0,0.04)" : "transparent",
                    color: "inherit",
                    textDecoration: "none",
                    lineHeight: "20px"
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