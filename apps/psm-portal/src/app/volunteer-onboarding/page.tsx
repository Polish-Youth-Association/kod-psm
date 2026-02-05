"use client";

import { useMemo, useState } from "react";

type VolunteerOnboardingRequest = {
  id: string;
  createdAt: string; // ISO
  firstName: string;
  lastName: string;
  personalEmail: string;
  team: string;
  startDate: string;
  notes: string;
  status: "Draft" | "Submitted" | "Approved" | "Provisioning" | "Completed" | "Rejected";
};

function newId() {
  return `req_${Math.random().toString(36).slice(2, 10)}`;
}

export default function VolunteerOnboardingPage() {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    personalEmail: "",
    team: "",
    startDate: "",
    notes: ""
  });

  const [error, setError] = useState<string | null>(null);
  const [requests, setRequests] = useState<VolunteerOnboardingRequest[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = useMemo(() => {
    const emailOk = form.personalEmail.trim().includes("@");
    return (
      form.firstName.trim().length > 0 &&
      form.lastName.trim().length > 0 &&
      emailOk &&
      form.team.trim().length > 0
    );
  }, [form]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!canSubmit) {
      setError("Fill in required fields: first name, last name, personal email, team.");
      return;
    }

    setSubmitting(true);
    try {
      // UI-only for now: just append locally.
      // Later: POST to /api/onboarding/requests (portal route) → onboarding backend.
      const record: VolunteerOnboardingRequest = {
        id: newId(),
        createdAt: new Date().toISOString(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        personalEmail: form.personalEmail.trim(),
        team: form.team.trim(),
        startDate: form.startDate.trim(),
        notes: form.notes.trim(),
        status: "Submitted"
      };

      setRequests((prev) => [record, ...prev]);

      setForm({
        firstName: "",
        lastName: "",
        personalEmail: "",
        team: "",
        startDate: "",
        notes: ""
      });
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 26, margin: 0 }}>Volunteer Onboarding</h1>
        <p style={{ marginTop: 6, opacity: 0.7, maxWidth: 820 }}>
          Create a request to onboard a new volunteer. This will eventually automate:
          Google Workspace account creation (<code>@polishyouth.org</code>), group access,
          and Slack provisioning.
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
              label="First name *"
              value={form.firstName}
              onChange={(v) => setForm((f) => ({ ...f, firstName: v }))}
            />
            <Field
              label="Last name *"
              value={form.lastName}
              onChange={(v) => setForm((f) => ({ ...f, lastName: v }))}
            />
          </div>

          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
            <Field
              label="Personal email *"
              value={form.personalEmail}
              onChange={(v) => setForm((f) => ({ ...f, personalEmail: v }))}
              placeholder="name@gmail.com"
            />
            <Field
              label="Team *"
              value={form.team}
              onChange={(v) => setForm((f) => ({ ...f, team: v }))}
              placeholder="Events / Marketing / Tech..."
            />
          </div>

          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
            <Field
              label="Start date (optional)"
              value={form.startDate}
              onChange={(v) => setForm((f) => ({ ...f, startDate: v }))}
              placeholder="YYYY-MM-DD"
            />
            <Field
              label="Notes (optional)"
              value={form.notes}
              onChange={(v) => setForm((f) => ({ ...f, notes: v }))}
              placeholder="Anything the admin should know..."
            />
          </div>

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

            <span style={{ fontSize: 12, opacity: 0.7 }}>
              * required
            </span>
          </div>

          {error ? (
            <p style={{ margin: 0, color: "crimson", whiteSpace: "pre-wrap" }}>
              {error}
            </p>
          ) : null}
        </form>
      </section>

      <section style={{ marginTop: 22 }}>
        <h2 style={{ fontSize: 16, margin: 0 }}>Recent requests</h2>

        <div style={{ marginTop: 10, overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", minWidth: 980 }}>
            <thead>
              <tr>
                {["Created", "Request ID", "Name", "Personal Email", "Team", "Start Date", "Status"].map(
                  (h) => (
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
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 12, opacity: 0.7 }}>
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
                    <td style={cellStyle}>{r.team}</td>
                    <td style={cellStyle}>{r.startDate || ""}</td>
                    <td style={cellStyle}>{r.status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <p style={{ marginTop: 10, opacity: 0.6 }}>
          Dev note: this page is UI-only for now; requests are not persisted yet.
        </p>
      </section>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 12, opacity: 0.75 }}>{label}</span>
      <input
        value={value}
        placeholder={placeholder}
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
