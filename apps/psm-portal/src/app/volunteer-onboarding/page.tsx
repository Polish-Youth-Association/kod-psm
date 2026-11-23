"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { wixApi, type WorkflowRun } from "@/lib/wixApi";
import { Field, PageHeader, Spinner } from "@/components/field";
import { useToast } from "@/components/toast";
import { IconRefresh, IconUserPlus } from "@/components/icons";

function isEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

function toEmailLocalPart(first: string, last: string) {
  const base = `${first}.${last}`
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9.]/g, "")
    .replace(/\.+/g, ".")
    .replace(/^\.+|\.+$/g, "");
  return base || "";
}

// Workflow step -> what the admin sees.
const stepLabels: Record<string, string> = {
  sendAgreement: "Sending agreement",
  awaitSignature: "Waiting for signature",
  createAccount: "Creating account",
  setSignature: "Setting up mailbox",
  welcomePsmInbox: "Sending welcome email",
};

function runBadge(w: WorkflowRun): { label: string; style: string } {
  if (w.status === "Failed") return { label: "Failed", style: "bg-red-50 text-red-700" };
  if (w.status === "Done") {
    if (w.outcome === "Completed") return { label: "Completed", style: "bg-emerald-50 text-emerald-700" };
    return { label: w.outcome === "Declined" ? "Declined" : "Agreement voided", style: "bg-gray-100 text-gray-600" };
  }
  if (w.step === "awaitSignature") return { label: "Awaiting signature", style: "bg-blue-50 text-blue-700" };
  return { label: w.lastError ? "Retrying" : "In progress", style: "bg-yellow-50 text-yellow-700" };
}

export default function VolunteerOnboardingPage() {
  const toast = useToast();
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
  const [submitting, setSubmitting] = useState(false);
  const [runs, setRuns] = useState<WorkflowRun[] | null>(null);
  const [runsError, setRunsError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);

  const loadRuns = useCallback(async () => {
    try {
      const res = await wixApi.listWorkflows("volunteer");
      setRuns(res.workflows);
      setRunsError(null);
    } catch (err: any) {
      setRunsError(err?.message ?? String(err));
    }
  }, []);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

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

      // Records the request and sends the DocuSign agreement. The account itself is created by the
      // backend workflow once the volunteer signs.
      const result = await wixApi.provisionVolunteer(payload);
      if (!result?.ok) throw new Error((result as any)?.error ?? "Backend rejected request");

      if (result.docusign?.status === "Sent") {
        toast("success", "Agreement sent", `${payload.personalEmail}. The account is created once they sign.`);
      } else {
        toast("error", "Saved, but the agreement didn't send yet", result.docusign?.error ?? "It's retried automatically.");
      }
      loadRuns();

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
      toast("error", "Couldn't start onboarding", err?.message ?? String(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function retry(id: string) {
    setRetrying(id);
    try {
      await wixApi.retryWorkflow(id);
      await loadRuns();
    } catch (err: any) {
      toast("error", "Retry failed", err?.message ?? String(err));
    } finally {
      setRetrying(null);
    }
  }

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <PageHeader eyebrow="Volunteers" title="Volunteer Onboarding">
        Sends the volunteer agreement through DocuSign. Once they sign, their{" "}
        <span className="font-mono text-sm text-brand-ink">@polishyouth.org</span> Google Workspace account is created,
        their login details are emailed and their Gmail signature is set automatically.
      </PageHeader>

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
              hint="The agreement and login details are sent here"
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
              {submitting ? "Sending…" : "Send agreement"}
            </button>
            <span className="text-xs text-gray-500">
              <span className="text-brand-red">*</span> required
            </span>
          </div>

          {error && <p className="text-sm text-red-600 whitespace-pre-wrap">{error}</p>}
        </form>
      </section>

      {/* Onboarding runs */}
      <section className="card overflow-hidden animate-fade-up" style={{ animationDelay: "160ms" }}>
        <div className="px-6 py-4 border-b border-black/[0.06] flex items-center justify-between gap-3">
          <h2 className="text-base font-bold text-brand-ink">Onboarding</h2>
          <button
            onClick={loadRuns}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-brand-ink"
          >
            <IconRefresh className="w-4 h-4" /> Refresh
          </button>
        </div>

        {runsError ? (
          <p className="px-6 py-6 text-sm text-red-600">{runsError}</p>
        ) : runs === null ? (
          <div className="px-6 py-12 flex justify-center">
            <Spinner />
          </div>
        ) : runs.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="mx-auto mb-3 w-12 h-12 rounded-2xl bg-gray-100 text-gray-400 flex items-center justify-center">
              <IconUserPlus className="w-6 h-6" />
            </div>
            <p className="text-sm text-gray-500">No volunteers in onboarding yet.</p>
          </div>
        ) : (
          <ul className="divide-y divide-black/[0.06]">
            {runs.map((w) => {
              const badge = runBadge(w);
              const canRetry = w.status === "Failed" || (w.status === "Running" && !!w.lastError);
              return (
                <li key={w.id} className="px-6 py-4 flex items-center gap-4">
                  <div className="w-10 h-10 shrink-0 rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white font-bold flex items-center justify-center">
                    {(w.label || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-brand-ink truncate">{w.label || w.key}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {w.status === "Done" ? "Finished" : stepLabels[w.step] ?? w.step}
                      {" · started "}
                      {new Date(w.createdAt).toLocaleDateString()}
                    </p>
                    {w.lastError && w.status !== "Done" && (
                      <p className="text-xs text-red-600 truncate" title={w.lastError}>
                        {w.lastError}
                      </p>
                    )}
                  </div>
                  {canRetry && (
                    <button
                      onClick={() => retry(w.id)}
                      disabled={retrying === w.id}
                      className="h-8 px-3 rounded-lg border border-black/10 text-xs font-semibold hover:bg-gray-50"
                    >
                      {retrying === w.id ? <Spinner /> : "Retry"}
                    </button>
                  )}
                  <span className={`badge ${badge.style}`}>{badge.label}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
