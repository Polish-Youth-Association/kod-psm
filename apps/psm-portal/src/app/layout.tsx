import type { Metadata } from "next";
import { ClientShell } from "@/components/clientShell";
import "./globals.css";

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
    <html lang="en">
      <body className="antialiased bg-white text-brand-dark font-sans">
        <ClientShell>{children}</ClientShell>
      </body>
    </html>
  );
}
