"use client";

import React, { useMemo, useState } from "react";

type VolunteerOnboardingRequest = {
  id: string;
  createdAt: string; // ISO
  firstName: string;
  lastName: string;
  personalEmail: string;
  title: string;
  startDate: string; // YYYY-MM-DD or ""
  notes: string;
  suggestedPrimaryEmail: string;
  status: "Draft" | "Submitted" | "Approved" | "Provisioning" | "Completed" | "Rejected";
};

function isEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

function toEmailLocalPart(first: string, last: string) {
  const base = `${first}.${last}`
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9.]/g, "")
    .replace(/\.+/g, ".")
    .replace(/^\.+|\.+$/g, "");
  return base || "";
}

const statusStyles: Record<VolunteerOnboardingRequest["status"], string> = {
  Draft: "bg-gray-100 text-gray-600",
  Submitted: "bg-blue-50 text-blue-700",
  Approved: "bg-green-50 text-green-700",
  Provisioning: "bg-yellow-50 text-yellow-700",
  Completed: "bg-emerald-50 text-emerald-700",
  Rejected: "bg-red-50 text-red-700"
};

export default function VolunteerOnboardingPage() {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    personalEmail: "",
    title: "",
    startDate: "",
    notes: "",
    birthday: "",
    phoneNumber: ""
  });

  const [error, setError] = useState<string | null>(null);
  const [requests, setRequests] = useState<VolunteerOnboardingRequest[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const suggestedPrimaryEmail = useMemo(() => {
    const local = toEmailLocalPart(form.firstName, form.lastName);
    return local ? `${local}@polishyouth.org` : "";
  }, [form.firstName, form.lastName]);

  const canSubmit = useMemo(() => {
    return (
      form.firstName.trim().length > 0 &&
      form.lastName.trim().length > 0 &&
      isEmail(form.personalEmail) &&
      form.title.trim().length > 0 &&
      form.birthday.trim().length > 0 &&
      form.phoneNumber.trim().length > 0
    );
  }, [form]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!canSubmit) {
      setError("Fill in required fields.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        personalEmail: form.personalEmail.trim(),
        title: form.title.trim(),
        startDate: form.startDate.trim(),
        notes: form.notes.trim(),
        birthday: form.birthday.trim(),
        phoneNumber: form.phoneNumber.trim(),
        suggestedPrimaryEmail
      };

      const resp = await fetch("/api/onboarding/volunteer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });

      const text = await resp.text();
      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch {}

      const result = json;
      if (!result?.ok) throw new Error(result?.error ?? "Backend rejected request");

      const record: VolunteerOnboardingRequest = {
        id: result.requestId,
        createdAt: new Date().toISOString(),
        firstName: payload.firstName,
        lastName: payload.lastName,
        personalEmail: payload.personalEmail,
        title: payload.title,
        startDate: payload.startDate,
        notes: payload.notes,
        suggestedPrimaryEmail: payload.suggestedPrimaryEmail,
        status: "Submitted"
      };

      setRequests((prev) => [record, ...prev]);

      setForm({
        firstName: "",
        lastName: "",
        personalEmail: "",
        title: "",
        startDate: "",
        notes: "",
        birthday: "",
        phoneNumber: ""
      });
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="max-w-5xl mx-auto px-6 py-10">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-brand-dark mb-2">Volunteer Onboarding</h1>
        <p className="text-brand-gray text-sm max-w-2xl">
          Create a request to onboard a new volunteer. This will eventually automate: Google
          Workspace account creation (<code className="font-mono bg-gray-100 px-1 rounded text-xs">@polishyouth.org</code>),
          group access, and Slack provisioning.
        </p>
      </div>

      {/* Form card */}
      <section className="bg-white border border-brand-border rounded-2xl p-6 mb-8">
        <h2 className="text-base font-semibold text-brand-dark mb-5">New request</h2>

        <form onSubmit={submit} className="flex flex-col gap-4">
          {/* Row: First + Last */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="First Name *"
              value={form.firstName}
              onChange={(v) => setForm((f) => ({ ...f, firstName: v }))}
              autoComplete="given-name"
            />
            <Field
              label="Last Name *"
              value={form.lastName}
              onChange={(v) => setForm((f) => ({ ...f, lastName: v }))}
              autoComplete="family-name"
            />
          </div>

          {/* Row: Birthday + Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="Birthday *"
              value={form.birthday}
              onChange={(v) => setForm((f) => ({ ...f, birthday: v }))}
              type="date"
              autoComplete="bday"
            />
            <Field
              label="Phone Number *"
              value={form.phoneNumber}
              onChange={(v) => setForm((f) => ({ ...f, phoneNumber: v }))}
              type="tel"
              autoComplete="tel"
              placeholder="+1 929 266 7551"
            />
          </div>

          {/* Row: Personal email + Title */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="Personal Email *"
              value={form.personalEmail}
              onChange={(v) => setForm((f) => ({ ...f, personalEmail: v }))}
              placeholder="name@gmail.com"
              type="email"
              autoComplete="email"
            />
            <Field
              label="Title *"
              value={form.title}
              onChange={(v) => setForm((f) => ({ ...f, title: v }))}
              placeholder="Events / Marketing / Tech..."
            />
          </div>

          {/* Row: Start date + Suggested email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="Start Date (optional)"
              value={form.startDate}
              onChange={(v) => setForm((f) => ({ ...f, startDate: v }))}
              type="date"
            />
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Suggested PSM Email
              </span>
              <div
                className="h-10 flex items-center px-3 rounded-lg border border-brand-border bg-gray-50 text-sm text-gray-500 overflow-hidden text-ellipsis whitespace-nowrap"
                title={suggestedPrimaryEmail || ""}
              >
                {suggestedPrimaryEmail || "—"}
              </div>
            </label>
          </div>

          {/* Notes */}
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Notes (optional)
            </span>
            <textarea
              value={form.notes}
              placeholder="Anything the admin should know..."
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={4}
              className="px-3 py-2 rounded-lg border border-brand-border text-sm resize-y focus:outline-none focus:ring-2 focus:ring-brand-red/30 focus:border-brand-red"
            />
          </label>

          {/* Submit row */}
          <div className="flex items-center gap-4 pt-1">
            <button
              type="submit"
              disabled={!canSubmit || submitting}
              className="px-5 py-2.5 rounded-lg bg-brand-red text-white text-sm font-semibold hover:bg-brand-red-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? "Submitting..." : "Submit request"}
            </button>
            <span className="text-xs text-brand-gray">* required</span>
          </div>

          {error && (
            <p className="text-sm text-red-600 whitespace-pre-wrap">{error}</p>
          )}
        </form>
      </section>

      {/* Recent requests */}
      <section className="bg-white border border-brand-border rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-brand-border">
          <h2 className="text-base font-semibold text-brand-dark">Recent requests</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[1100px]">
            <thead>
              <tr className="bg-gray-50">
                {[
                  "Created",
                  "Request ID",
                  "Name",
                  "Personal Email",
                  "Title",
                  "Start Date",
                  "Suggested PSM Email",
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
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-sm text-brand-gray text-center">
                    No requests yet. Submit a request above to get started.
                  </td>
                </tr>
              ) : (
                requests.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-brand-dark border-b border-brand-border whitespace-nowrap">
                      {new Date(r.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-brand-gray border-b border-brand-border whitespace-nowrap">
                      {r.id}
                    </td>
                    <td className="px-4 py-3 text-sm text-brand-dark border-b border-brand-border whitespace-nowrap font-medium">
                      {r.firstName} {r.lastName}
                    </td>
                    <td className="px-4 py-3 text-sm text-brand-dark border-b border-brand-border whitespace-nowrap">
                      {r.personalEmail}
                    </td>
                    <td className="px-4 py-3 text-sm text-brand-dark border-b border-brand-border whitespace-nowrap">
                      {r.title}
                    </td>
                    <td className="px-4 py-3 text-sm text-brand-dark border-b border-brand-border whitespace-nowrap">
                      {r.startDate || "—"}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-brand-gray border-b border-brand-border whitespace-nowrap">
                      {r.suggestedPrimaryEmail}
                    </td>
                    <td className="px-4 py-3 border-b border-brand-border whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyles[r.status]}`}
                      >
                        {r.status}
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
