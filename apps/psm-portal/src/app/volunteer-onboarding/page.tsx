"use client";

import React, { useMemo, useState } from "react";
import { wixApi } from "@/lib/wixApi";
import { Field, PageHeader, Spinner } from "@/components/field";
import { useToast } from "@/components/toast";
import { IconCheck, IconCopy, IconUserPlus } from "@/components/icons";

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
  const toast = useToast();
  const [copied, setCopied] = useState(false);
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
  // Shown once after a successful provision — fallback in case the emailed copy fails.
  const [lastProvision, setLastProvision] = useState<{ email: string; tempPassword: string } | null>(null);

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
      toast("error", "Missing info", "Fill in all required fields.");
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

      const result = await wixApi.provisionVolunteer(payload);
      if (!result?.ok) throw new Error((result as any)?.error ?? "Backend rejected request");

      // Surface the temp password once to the admin — the emailed copy is the primary
      // channel, but if that fails this is the only other place it exists.
      setLastProvision({
        email: result.user?.primaryEmail ?? payload.suggestedPrimaryEmail,
        tempPassword: result.tempPassword,
      });

      // Kick off the async tail. Mailbox-independent steps (personal temp-password email,
      // Slack) run on the first call; mailbox-dependent steps (Gmail signature, PSM-inbox
      // copy) need Google to finish provisioning the mailbox, so while the backend reports
      // `pending`, re-call on a backoff. Fire-and-forget; steps are non-fatal + re-entrant.
      const runFinish = (attempt: number) => {
        wixApi
          .finishVolunteer(result.requestId)
          .then((r) => {
            if (r?.pending && attempt < 4) {
              // ~30s, 90s, 180s after the first call — covers typical mailbox init lag.
              setTimeout(() => runFinish(attempt + 1), attempt === 0 ? 30_000 : 90_000);
            }
          })
          .catch(() => {});
      };
      runFinish(0);

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
      setCopied(false);
      toast("success", "Volunteer account created", record.suggestedPrimaryEmail);

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
      toast("error", "Couldn't create the account", err?.message ?? String(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function copyPassword() {
    if (!lastProvision) return;
    try {
      await navigator.clipboard.writeText(lastProvision.tempPassword);
      setCopied(true);
    } catch {}
  }

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <PageHeader eyebrow="Volunteers" title="Volunteer Onboarding">
        Creates the volunteer&apos;s <span className="font-mono text-sm text-brand-ink">@polishyouth.org</span> Google
        Workspace account, sets their Gmail signature, emails their login details, and kicks off the Slack
        DocuSign workflow.
      </PageHeader>

      {/* One-time temp password reveal (fallback if the emailed copy fails) */}
      {lastProvision && (
        <section className="mb-8 relative overflow-hidden rounded-3xl p-6 sm:p-7 text-white bg-gradient-to-br from-emerald-600 to-teal-500 shadow-[0_20px_40px_-20px_rgba(5,150,105,0.7)] animate-fade-up">
          <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/80 mb-1">Account created</p>
              <p className="text-lg font-bold font-mono break-all">{lastProvision.email}</p>
              <div className="mt-4 flex items-center gap-2 flex-wrap">
                <code className="font-mono text-sm bg-white/15 border border-white/25 rounded-lg px-3 py-1.5 break-all">
                  {lastProvision.tempPassword}
                </code>
                <button
                  onClick={copyPassword}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-white text-emerald-700 text-sm font-semibold hover:bg-emerald-50 transition-colors"
                >
                  {copied ? <IconCheck className="w-4 h-4" /> : <IconCopy className="w-4 h-4" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="text-xs text-white/85 mt-3 max-w-xl">
                Shown only once. It&apos;s also emailed to the volunteer&apos;s personal address; if that email
                fails, this is the only copy. They must change it at first login.
              </p>
            </div>
            <button
              onClick={() => setLastProvision(null)}
              className="h-9 px-3 rounded-lg border border-white/40 text-xs font-semibold hover:bg-white/10 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </section>
      )}

      {/* Form card */}
      <section className="card p-6 sm:p-8 mb-8 animate-fade-up" style={{ animationDelay: "80ms" }}>
        <form onSubmit={submit} className="flex flex-col gap-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Field
              label="First name"
              required
              value={form.firstName}
              onChange={(v) => setForm((f) => ({ ...f, firstName: v }))}
              autoComplete="given-name"
            />
            <Field
              label="Last name"
              required
              value={form.lastName}
              onChange={(v) => setForm((f) => ({ ...f, lastName: v }))}
              autoComplete="family-name"
            />
            <Field
              label="Birthday"
              required
              value={form.birthday}
              onChange={(v) => setForm((f) => ({ ...f, birthday: v }))}
              type="date"
              autoComplete="bday"
            />
            <Field
              label="Phone number"
              required
              value={form.phoneNumber}
              onChange={(v) => setForm((f) => ({ ...f, phoneNumber: v }))}
              type="tel"
              autoComplete="tel"
              placeholder="+1 929 266 7551"
            />
            <Field
              label="Personal email"
              required
              value={form.personalEmail}
              onChange={(v) => setForm((f) => ({ ...f, personalEmail: v }))}
              placeholder="name@gmail.com"
              type="email"
              autoComplete="email"
              hint="Login details are sent here"
            />
            <Field
              label="Title"
              required
              value={form.title}
              onChange={(v) => setForm((f) => ({ ...f, title: v }))}
              placeholder="Events / Marketing / Tech…"
            />
            <Field
              label="Start date"
              value={form.startDate}
              onChange={(v) => setForm((f) => ({ ...f, startDate: v }))}
              type="date"
            />
            <div className="flex flex-col gap-1.5">
              <span className="field-label">New PSM email</span>
              <div
                className={[
                  "h-11 flex items-center px-3.5 rounded-xl border text-sm font-mono overflow-hidden text-ellipsis whitespace-nowrap transition-colors",
                  suggestedPrimaryEmail
                    ? "border-brand-red/30 bg-brand-red-light/60 text-brand-red"
                    : "border-dashed border-gray-300 text-gray-400",
                ].join(" ")}
                title={suggestedPrimaryEmail || ""}
              >
                {suggestedPrimaryEmail || "first.last@polishyouth.org"}
              </div>
            </div>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="field-label">Notes</span>
            <textarea
              value={form.notes}
              placeholder="Anything the admin should know…"
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
              className="field-input h-auto py-2.5 resize-y"
            />
          </label>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
            <button type="submit" disabled={!canSubmit || submitting} className="btn-primary w-full sm:w-auto">
              {submitting ? <Spinner /> : <IconUserPlus className="w-4 h-4" />}
              {submitting ? "Creating account…" : "Create volunteer account"}
            </button>
            <span className="text-xs text-gray-500">
              <span className="text-brand-red">*</span> required
            </span>
          </div>

          {error && <p className="text-sm text-red-600 whitespace-pre-wrap">{error}</p>}
        </form>
      </section>

      {/* Recent requests */}
      <section className="card overflow-hidden animate-fade-up" style={{ animationDelay: "160ms" }}>
        <div className="px-6 py-4 border-b border-black/[0.06] flex items-center justify-between">
          <h2 className="text-base font-bold text-brand-ink">Created this session</h2>
          {requests.length > 0 && <span className="badge bg-gray-100 text-gray-700">{requests.length}</span>}
        </div>

        {requests.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="mx-auto mb-3 w-12 h-12 rounded-2xl bg-gray-100 text-gray-400 flex items-center justify-center">
              <IconUserPlus className="w-6 h-6" />
            </div>
            <p className="text-sm text-gray-500">No accounts yet. New volunteers show up here.</p>
          </div>
        ) : (
          <ul className="divide-y divide-black/[0.06]">
            {requests.map((r) => (
              <li key={r.id} className="px-6 py-4 flex items-center gap-4 animate-fade-up">
                <div className="w-10 h-10 shrink-0 rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white font-bold flex items-center justify-center">
                  {r.firstName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-brand-ink truncate">
                    {r.firstName} {r.lastName} <span className="font-medium text-gray-500">· {r.title}</span>
                  </p>
                  <p className="text-xs text-gray-500 truncate font-mono">{r.suggestedPrimaryEmail}</p>
                </div>
                <span className={`badge ${statusStyles[r.status]}`}>{r.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
