"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./TopNav.module.css";
import Image from "next/image";

const links = [
  { href: "/", label: "Home" },
  { href: "/volunteer-onboarding", label: "Volunteer Onboarding" }
];

export function TopNav() {
  const pathname = usePathname();
  const itemHeight = 48;
  const itemLine = "48px";
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        background: "white",
        borderBottom: "1px solid rgba(0, 0, 0, 0.08)",
        backgroundColor: "rgb(255, 255, 255)",
        color: "Black"
      }}
    >
      <nav
        style={{
          height: 72,
          maxWidth: "100%",
          padding: "0 26px",
          display: "flex",
          alignItems: "center",
          gap: 16
        }}
      >
        <div
        style={{
            height: itemHeight,
            display: "flex",
            alignItems: "center"
        }}
        >
        <Image
            src="https://static.wixstatic.com/media/d7f1c6_4692e1506cb8406798ac7defaf85bed1~mv2.png"
            alt="Polish Youth Association"
            width={140}
            height={40}
            style={{ height: itemHeight, width: "auto" }}
            priority
        />
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {links.map((l) => {
            const active = pathname === l.href;
            return (
            <Link
            key={l.href}
            href={l.href}
            className={`${styles.navLink} ${active ? styles.navLinkActive : ""}`}
            style={{
                height: itemHeight,
                lineHeight: itemLine,
                padding: "0 32px",
                borderRadius: 14,
                textDecoration: "none",
                display: "inline-block"
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