import type { Metadata } from "next";
import { headers } from "next/headers";
import { ClientShell } from "@/components/clientShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "PSM Portal",
  description: "Internal tools for Polish Youth Association"
};

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  // IAP injects this as "accounts.google.com:<email>"; strip the prefix
  const raw = headersList.get("x-goog-authenticated-user-email");
  const userEmail = raw ? raw.replace(/^accounts\.google\.com:/, "") : null;

  return (
    <html lang="en">
      <body className="antialiased bg-white text-brand-dark font-sans">
        <ClientShell userEmail={userEmail}>{children}</ClientShell>
      </body>
    </html>
  );
}
