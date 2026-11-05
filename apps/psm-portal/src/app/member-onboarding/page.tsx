"use client";

import React, { useMemo, useState } from "react";
import { wixApi } from "@/lib/wixApi";
import { Field, PageHeader, Spinner } from "@/components/field";
import { useToast } from "@/components/toast";
import { IconAward, IconSend } from "@/components/icons";

type MemberOnboardingRecord = {
  id: string;
  sentAt: string;
  firstNamePolish: string;
  fullName: string;
  email: string;
  memberId: string;
  certStatus: string;
};

function isEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

// Mirrors the backend's normalizeMemberId: letters + digits only, uppercase.
function normalizeMemberId(s: string) {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

const EMPTY = { firstNamePolish: "", firstNameEnglish: "", lastName: "", email: "", memberId: "" };

export default function MemberOnboardingPage() {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [attachCertificate, setAttachCertificate] = useState(true);
  const [records, setRecords] = useState<MemberOnboardingRecord[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = useMemo(() => {
    return (
      form.firstNamePolish.trim().length > 0 &&
      form.firstNameEnglish.trim().length > 0 &&
      isEmail(form.email) &&
      normalizeMemberId(form.memberId).length > 0 &&
      (!attachCertificate || form.lastName.trim().length > 0)
    );
  }, [form, attachCertificate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) {
      toast("error", "Missing info", "Fill in all required fields.");
      return;
    }

    setSubmitting(true);
    try {
      const memberId = normalizeMemberId(form.memberId);
      // The backend renders the certificate (same template as the queue's Approve), saves it to
      // the Membership Certificates Drive folder, and attaches it to the email.
      const json = await wixApi.sendMemberEmail({
        firstNamePolish: form.firstNamePolish.trim(),
        firstNameEnglish: form.firstNameEnglish.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        memberId,
        attachCertificate,
      });

      if (!json?.ok) {
        throw new Error((json as any)?.error ?? "Backend rejected the request");
      }

      const certStatus = attachCertificate ? json.certStatus ?? "generated" : "skipped";
      setRecords((prev) => [
        {
          id: `rec_${Math.random().toString(36).slice(2, 10)}`,
          sentAt: new Date().toISOString(),
          firstNamePolish: form.firstNamePolish.trim(),
          fullName: `${form.firstNameEnglish.trim()} ${form.lastName.trim()}`.trim(),
          email: form.email.trim(),
          memberId,
          certStatus,
        },
        ...prev,
      ]);

      toast(
        certStatus === "failed" ? "error" : "success",
        certStatus === "failed" ? "Email sent, certificate failed" : "Welcome email sent",
        certStatus === "failed" && json.certError ? json.certError : `${memberId} → ${form.email.trim()}`
      );
      setForm(EMPTY);
    } catch (err: any) {
      toast("error", "Couldn't send the email", err?.message ?? String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <PageHeader eyebrow="Members" title="Member Onboarding">
        Send a welcome email to a new member with their membership ID. Their certificate is generated
        and attached automatically, and saved to the Membership Certificates Drive.
      </PageHeader>

      {/* Form card */}
      <section className="card p-6 sm:p-8 mb-8 animate-fade-up" style={{ animationDelay: "80ms" }}>
        <form onSubmit={submit} className="flex flex-col gap-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Field
              label="First name (Polish)"
              required
              value={form.firstNamePolish}
              onChange={(v) => setForm((f) => ({ ...f, firstNamePolish: v }))}
              placeholder="Michał"
              hint="Used in the email greeting"
            />
            <Field
              label="First name (English)"
              required
              value={form.firstNameEnglish}
              onChange={(v) => setForm((f) => ({ ...f, firstNameEnglish: v }))}
              placeholder="Michael"
              autoComplete="given-name"
            />
            <Field
              label="Last name"
              required={attachCertificate}
              value={form.lastName}
              onChange={(v) => setForm((f) => ({ ...f, lastName: v }))}
              placeholder="Kowalski"
              autoComplete="family-name"
              hint="Printed on the certificate"
            />
            <Field
              label="Member ID"
              required
              value={form.memberId}
              onChange={(v) => setForm((f) => ({ ...f, memberId: v }))}
              placeholder="DNY62120899"
              hint={
                form.memberId && normalizeMemberId(form.memberId) !== form.memberId
                  ? `Will be sent as ${normalizeMemberId(form.memberId)}`
                  : "Letters and digits only, no dashes"
              }
            />
          </div>
          <Field
            label="Recipient email"
            required
            value={form.email}
            onChange={(v) => setForm((f) => ({ ...f, email: v }))}
            type="email"
            placeholder="member@example.com"
            autoComplete="email"
          />

          {/* Certificate toggle */}
          <button
            type="button"
            role="switch"
            aria-checked={attachCertificate}
            onClick={() => setAttachCertificate((v) => !v)}
            className={[
              "flex items-center gap-4 p-4 rounded-2xl border text-left transition-all duration-200",
              attachCertificate
                ? "border-brand-red/30 bg-brand-red-light/70"
                : "border-gray-200 bg-white hover:border-gray-300",
            ].join(" ")}
          >
            <div
              className={[
                "w-10 h-10 shrink-0 rounded-xl flex items-center justify-center transition-colors",
                attachCertificate ? "bg-gradient-to-br from-brand-red to-brand-rose text-white" : "bg-gray-100 text-gray-400",
              ].join(" ")}
            >
              <IconAward className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-brand-ink">Attach membership certificate</p>
              <p className="text-xs text-gray-600">Generated from the official template with today&apos;s date</p>
            </div>
            <span
              className={[
                "relative w-11 h-6 shrink-0 rounded-full transition-colors",
                attachCertificate ? "bg-brand-red" : "bg-gray-300",
              ].join(" ")}
            >
              <span
                className={[
                  "absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform",
                  attachCertificate ? "translate-x-5" : "",
                ].join(" ")}
              />
            </span>
          </button>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
            <button type="submit" disabled={!canSubmit || submitting} className="btn-primary w-full sm:w-auto">
              {submitting ? <Spinner /> : <IconSend className="w-4 h-4" />}
              {submitting ? "Sending…" : "Send welcome email"}
            </button>
            <span className="text-xs text-gray-500">
              <span className="text-brand-red">*</span> required · CC&apos;d to records@
            </span>
          </div>
        </form>
      </section>

      {/* Recent sends */}
      <section className="card overflow-hidden animate-fade-up" style={{ animationDelay: "160ms" }}>
        <div className="px-6 py-4 border-b border-black/[0.06] flex items-center justify-between">
          <h2 className="text-base font-bold text-brand-ink">Sent this session</h2>
          {records.length > 0 && <span className="badge bg-gray-100 text-gray-700">{records.length}</span>}
        </div>

        {records.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="mx-auto mb-3 w-12 h-12 rounded-2xl bg-gray-100 text-gray-400 flex items-center justify-center">
              <IconSend className="w-6 h-6" />
            </div>
            <p className="text-sm text-gray-500">Nothing sent yet. Emails you send show up here.</p>
          </div>
        ) : (
          <ul className="divide-y divide-black/[0.06]">
            {records.map((r) => (
              <li key={r.id} className="px-6 py-4 flex items-center gap-4 animate-fade-up">
                <div className="w-10 h-10 shrink-0 rounded-full bg-gradient-to-br from-brand-red to-brand-rose text-white font-bold flex items-center justify-center">
                  {r.firstNamePolish.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-brand-ink truncate">
                    {r.fullName} <span className="font-mono font-medium text-gray-500">· {r.memberId}</span>
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {r.email} · {new Date(r.sentAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  </p>
                </div>
                <span
                  className={[
                    "badge",
                    r.certStatus === "failed"
                      ? "bg-red-50 text-red-700"
                      : r.certStatus === "skipped"
                      ? "bg-gray-100 text-gray-600"
                      : "bg-emerald-50 text-emerald-700",
                  ].join(" ")}
                >
                  {r.certStatus === "failed" ? "Cert failed" : r.certStatus === "skipped" ? "No cert" : "Sent + cert"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
