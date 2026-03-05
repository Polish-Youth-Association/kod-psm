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
  // good-enough validation for UI
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

function toEmailLocalPart(first: string, last: string) {
  const base = `${first}.${last}`
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[^a-z0-9.]/g, "") // keep a-z 0-9 .
    .replace(/\.+/g, ".")
    .replace(/^\.+|\.+$/g, "");

  return base || "";
}

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
      form.phoneNumber.trim().length > 0 &&
      form.startDate.trim().length > 0 &&
      form.notes.trim().length > 0
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
    <main style={{ padding: 24 }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 26, margin: 0 }}>Volunteer Onboarding</h1>
        <p style={{ marginTop: 6, opacity: 0.7, maxWidth: 820 }}>
          Create a request to onboard a new volunteer. This will eventually automate: Google
          Workspace account creation (<code>@polishyouth.org</code>), group access, and Slack
          provisioning.
        </p>
      </header>

      <section
        style={{
          padding: 16,
          border: "1px solid rgba(0,0,0,0.12)",
          borderRadius: 12,
          maxWidth: 900
        }}
      >
        <h2 style={{ fontSize: 16, margin: 0, marginBottom: 12 }}>New request</h2>

        <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
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

          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
          <Field
            label="Birthday *"
            value={form.birthday}
            onChange={(v) => setForm((f) => ({ ...f, birthday: v }))}
            type="date"
            autoComplete="bday"
            />

            <Field
            label="Phone number *"
            value={form.phoneNumber}
            onChange={(v) => setForm((f) => ({ ...f, phoneNumber: v }))}
            type="tel"
            autoComplete="tel"
            placeholder="+1 929 266 7551"
            />
          </div>

          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
            <Field
              label="Personal email *"
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

          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
            <Field
              label="Start date (optional)"
              value={form.startDate}
              onChange={(v) => setForm((f) => ({ ...f, startDate: v }))}
              type="date"
            />

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, opacity: 0.75 }}>Suggested PSM email</span>
              <div
                style={{
                  height: 36,
                  display: "flex",
                  alignItems: "center",
                  padding: "0 10px",
                  borderRadius: 10,
                  border: "1px solid rgba(0,0,0,0.12)",
                  background: "rgba(0,0,0,0.02)",
                  fontSize: 13,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap"
                }}
                title={suggestedPrimaryEmail || ""}
              >
                {suggestedPrimaryEmail || "—"}
              </div>
            </label>
          </div>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, opacity: 0.75 }}>Notes (optional)</span>
            <textarea
              value={form.notes}
              placeholder="Anything the admin should know..."
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={4}
              style={{
                padding: 10,
                borderRadius: 10,
                border: "1px solid rgba(0,0,0,0.2)",
                resize: "vertical"
              }}
            />
          </label>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              type="submit"
              disabled={!canSubmit || submitting}
              style={{
                height: 38,
                padding: "0 14px",
                borderRadius: 10,
                border: "1px solid rgba(0,0,0,0.2)",
                background: submitting ? "rgba(0,0,0,0.05)" : "white",
                cursor: !canSubmit || submitting ? "not-allowed" : "pointer"
              }}
            >
              {submitting ? "Submitting..." : "Submit request"}
            </button>

            <span style={{ fontSize: 12, opacity: 0.7 }}>* required</span>
          </div>

          {error ? (
            <p style={{ margin: 0, color: "crimson", whiteSpace: "pre-wrap" }}>{error}</p>
          ) : null}
        </form>
      </section>

      <section style={{ marginTop: 22 }}>
        <h2 style={{ fontSize: 16, margin: 0 }}>Recent requests</h2>

        <div style={{ marginTop: 10, overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", minWidth: 1120 }}>
            <thead>
              <tr>
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
                    style={{
                      textAlign: "left",
                      fontSize: 12,
                      padding: "8px 10px",
                      borderBottom: "1px solid rgba(0,0,0,0.15)",
                      opacity: 0.7
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: 12, opacity: 0.7 }}>
                    No requests yet.
                  </td>
                </tr>
              ) : (
                requests.map((r) => (
                  <tr key={r.id}>
                    <td style={cellStyle}>{new Date(r.createdAt).toLocaleString()}</td>
                    <td style={cellStyle}>{r.id}</td>
                    <td style={cellStyle}>
                      {r.firstName} {r.lastName}
                    </td>
                    <td style={cellStyle}>{r.personalEmail}</td>
                    <td style={cellStyle}>{r.title}</td>
                    <td style={cellStyle}>{r.startDate || ""}</td>
                    <td style={cellStyle}>{r.suggestedPrimaryEmail}</td>
                    <td style={cellStyle}>{r.status}</td>
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
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 12, opacity: 0.75 }}>{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        type={type ?? "text"}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        style={{
          height: 36,
          padding: "0 10px",
          borderRadius: 10,
          border: "1px solid rgba(0,0,0,0.2)"
        }}
      />
    </label>
  );
}
const cellStyle: React.CSSProperties = {
  padding: "10px 10px",
  borderBottom: "1px solid rgba(0,0,0,0.08)",
  fontSize: 13,
  whiteSpace: "nowrap"
};