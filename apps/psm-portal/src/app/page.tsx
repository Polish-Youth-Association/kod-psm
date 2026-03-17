"use client";

import { useState } from "react";
import Link from "next/link";

export default function Home() {
  const [result, setResult] = useState<string>("");

  async function testExample() {
    setResult("Calling /api/ping...");
    try {
      const res = await fetch("/api/ping", { cache: "no-store" });
      const text = await res.text();
      try {
        setResult(JSON.stringify(JSON.parse(text), null, 2));
      } catch {
        setResult(`Non-JSON response (status ${res.status}):\n\n${text.slice(0, 800)}`);
      }
    } catch (e: any) {
      setResult(`Error: ${e?.message ?? String(e)}`);
    }
  }

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      {/* Hero */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-brand-dark mb-2">PSM Portal</h1>
        <p className="text-brand-gray text-base">
          Internal tools for Polish Youth Association.
        </p>
      </div>

      {/* Tool cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
        <Link
          href="/volunteer-onboarding"
          className="group block p-5 bg-white border border-brand-border rounded-2xl hover:border-brand-red hover:shadow-sm transition-all duration-150"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-brand-red-light flex items-center justify-center text-brand-red font-bold text-sm">
              V
            </div>
            <h2 className="text-base font-semibold text-brand-dark group-hover:text-brand-red transition-colors">
              Volunteer Onboarding
            </h2>
          </div>
          <p className="text-sm text-brand-gray">
            Create Google Workspace accounts, Slack access, and group memberships for new
            volunteers.
          </p>
        </Link>

        <Link
          href="/member-onboarding"
          className="group block p-5 bg-white border border-brand-border rounded-2xl hover:border-brand-red hover:shadow-sm transition-all duration-150"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-brand-red-light flex items-center justify-center text-brand-red font-bold text-sm">
              M
            </div>
            <h2 className="text-base font-semibold text-brand-dark group-hover:text-brand-red transition-colors">
              Member Onboarding
            </h2>
          </div>
          <p className="text-sm text-brand-gray">
            Send a welcome email to a new PSM member with their membership ID and an optional
            certificate attachment.
          </p>
        </Link>
      </div>

      {/* Roadmap note */}
      <p className="text-sm text-brand-gray mb-8">
        Next step: add Google login + admin-only access.
      </p>

      {/* Developer section */}
      <div className="border border-brand-border rounded-xl p-5">
        <h3 className="text-xs font-semibold text-brand-gray uppercase tracking-wide mb-4">
          Developer
        </h3>

        <button
          onClick={testExample}
          className="px-4 py-2 rounded-lg border border-brand-border bg-white text-sm font-medium text-brand-dark hover:bg-gray-50 hover:border-gray-300 transition-colors cursor-pointer"
        >
          Test API Status
        </button>

        {result && (
          <pre className="mt-4 p-4 rounded-xl border border-brand-border bg-gray-50 text-xs text-brand-dark overflow-x-auto leading-relaxed">
            {result}
          </pre>
        )}
      </div>
    </main>
  );
}
