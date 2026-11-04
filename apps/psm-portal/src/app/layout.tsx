import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { ClientShell } from "@/components/clientShell";
import "./globals.css";

// Self-hosted at build time by next/font, so the static export makes no runtime font requests.
const sans = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "PSM Portal",
  description: "Internal tools for Polish Youth Association"
};

// Static export: no server, no IAP header. Auth (and the signed-in user's email) is handled
// client-side via Google Sign-In in ClientShell.
export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={sans.variable}>
      <body className="antialiased text-brand-dark font-sans">
        <ClientShell>{children}</ClientShell>
      </body>
    </html>
  );
}
