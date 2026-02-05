import type { Metadata } from "next";
import { TopNav } from "@/components/topNav";
import "./globals.css";

export const metadata: Metadata = {
  title: "PSM Portal",
  description: "Internal tools for Polish Youth Association"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <TopNav />
        {children}
      </body>
    </html>
  );
}