"use client";

import React, { useMemo, useRef, useState } from "react";
import { wixApi } from "@/lib/wixApi";

type MemberOnboardingRecord = {
  id: string;
  sentAt: string;
  firstNamePolish: string;
  firstNameEnglish: string;
  email: string;
  memberId: string;
  hasCertificate: boolean;
};

function isEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

export default function MemberOnboardingPage() {
  const [form, setForm] = useState({
    firstNamePolish: "",
    firstNameEnglish: "",
    email: "",
    memberId: ""
  });
  const [certificate, setCertificate] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [records, setRecords] = useState<MemberOnboardingRecord[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = useMemo(() => {
    return (
      form.firstNamePolish.trim().length > 0 &&
      form.firstNameEnglish.trim().length > 0 &&
      isEmail(form.email) &&
      form.memberId.trim().length > 0
    );
  }, [form]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!canSubmit) {
      setError("Fill in all required fields.");
      return;
    }

    setSubmitting(true);
    try {
      // NOTE: certificate attachment via this manual form is not yet supported in the static/Wix
      // flow — the cert is delivered through the queue → approve path (which renders + attaches it).
      // To support manual attachment, upload `certificate` to Wix Media and pass its URL as
      // `certFileUrl` to sendMemberEmail.
      const json = await wixApi.sendMemberEmail({
        firstNamePolish: form.firstNamePolish.trim(),
        firstNameEnglish: form.firstNameEnglish.trim(),
        email: form.email.trim(),
        memberId: form.memberId.trim(),
      });

      if (!json?.ok) {
        throw new Error((json as any)?.error ?? "Backend rejected the request");
      }

      setRecords((prev) => [
        {
          id: `rec_${Math.random().toString(36).slice(2, 10)}`,
          sentAt: new Date().toISOString(),
          firstNamePolish: form.firstNamePolish.trim(),
          firstNameEnglish: form.firstNameEnglish.trim(),
          email: form.email.trim(),
          memberId: form.memberId.trim(),
          hasCertificate: !!certificate
        },
        ...prev
      ]);

      setForm({ firstNamePolish: "", firstNameEnglish: "", email: "", memberId: "" });
      setCertificate(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-brand-dark mb-2">Member Onboarding</h1>
        <p className="text-brand-gray text-sm max-w-2xl">
          Send a welcome email to a new PSM member with their membership ID and an optional
          certificate attachment.
        </p>
      </div>

      {/* Form card */}
      <section className="bg-white border border-brand-border rounded-2xl p-6 mb-8">
        <h2 className="text-base font-semibold text-brand-dark mb-5">Send onboarding email</h2>

        <form onSubmit={submit} className="flex flex-col gap-4">
          {/* Row: Polish name + English name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="First Name (Polish) *"
              value={form.firstNamePolish}
              onChange={(v) => setForm((f) => ({ ...f, firstNamePolish: v }))}
              placeholder="Michał"
            />
            <Field
              label="First Name (English) *"
              value={form.firstNameEnglish}
              onChange={(v) => setForm((f) => ({ ...f, firstNameEnglish: v }))}
              placeholder="Michael"
            />
          </div>

          {/* Row: Email + Member ID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="Recipient Email *"
              value={form.email}
              onChange={(v) => setForm((f) => ({ ...f, email: v }))}
              type="email"
              placeholder="member@example.com"
              autoComplete="email"
            />
            <Field
              label="Member ID *"
              value={form.memberId}
              onChange={(v) => setForm((f) => ({ ...f, memberId: v }))}
              placeholder="PSM-2024-001"
            />
          </div>

          {/* Certificate upload */}
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Certificate PDF (optional)
            </span>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              onChange={(e) => setCertificate(e.target.files?.[0] ?? null)}
              className="text-sm text-brand-dark file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-brand-red-light file:text-brand-red file:text-xs file:font-medium hover:file:bg-red-100 cursor-pointer"
            />
            {certificate && (
              <span className="text-xs text-brand-gray">{certificate.name}</span>
            )}
          </label>

          {/* Submit row */}
          <div className="flex items-center gap-4 pt-1">
            <button
              type="submit"
              disabled={!canSubmit || submitting}
              className="px-5 py-2.5 rounded-lg bg-brand-red text-white text-sm font-semibold hover:bg-brand-red-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? "Sending..." : "Send onboarding email"}
            </button>
            <span className="text-xs text-brand-gray">* required</span>
          </div>

          {error && (
            <p className="text-sm text-red-600 whitespace-pre-wrap">{error}</p>
          )}
        </form>
      </section>

      {/* Recent sends */}
      <section className="bg-white border border-brand-border rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-brand-border">
          <h2 className="text-base font-semibold text-brand-dark">Recent sends</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-gray-50">
                {[
                  "Sent",
                  "Member ID",
                  "Polish Name",
                  "English Name",
                  "Recipient Email",
                  "Certificate",
                  "Status"
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-brand-border"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-sm text-brand-gray text-center">
                    No emails sent yet. Fill in the form above to get started.
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-brand-dark border-b border-brand-border whitespace-nowrap">
                      {new Date(r.sentAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-brand-gray border-b border-brand-border whitespace-nowrap">
                      {r.memberId}
                    </td>
                    <td className="px-4 py-3 text-sm text-brand-dark border-b border-brand-border whitespace-nowrap">
                      {r.firstNamePolish}
                    </td>
                    <td className="px-4 py-3 text-sm text-brand-dark border-b border-brand-border whitespace-nowrap">
                      {r.firstNameEnglish}
                    </td>
                    <td className="px-4 py-3 text-sm text-brand-dark border-b border-brand-border whitespace-nowrap">
                      {r.email}
                    </td>
                    <td className="px-4 py-3 text-sm text-brand-dark border-b border-brand-border whitespace-nowrap">
                      {r.hasCertificate ? "Yes" : "—"}
                    </td>
                    <td className="px-4 py-3 border-b border-brand-border whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
                        Sent
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type,
  autoComplete
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: React.HTMLInputTypeAttribute;
  autoComplete?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        type={type ?? "text"}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 px-3 rounded-lg border border-brand-border text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/30 focus:border-brand-red"
      />
    </label>
  );
}
