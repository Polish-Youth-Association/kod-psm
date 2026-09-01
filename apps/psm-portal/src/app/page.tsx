"use client";

import Link from "next/link";

export default function Home() {
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

        <Link
          href="/chat"
          className="group block p-5 bg-white border border-brand-border rounded-2xl hover:border-brand-red hover:shadow-sm transition-all duration-150"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-brand-red-light flex items-center justify-center text-brand-red font-bold text-sm">
              AI
            </div>
            <h2 className="text-base font-semibold text-brand-dark group-hover:text-brand-red transition-colors">
              PSM Assistant
            </h2>
          </div>
          <p className="text-sm text-brand-gray">
            Gemini-powered assistant for PSM operations, onboarding questions, and more.
          </p>
        </Link>
      </div>

    </main>
  );
}
