"use client";

import { useEffect, useMemo, useState } from "react";

type OnboardingType = "member" | "volunteer";

type OnboardingRequest = {
  id: string;
  type: OnboardingType;
  firstName: string;
  lastName: string;
  personalEmail: string;
  team?: string;
  startDate?: string;
  status: string;
  createdAt: string;
};

export function OnboardingPage({
  type,
  title
}: {
  type: OnboardingType;
  title: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requests, setRequests] = useState<OnboardingRequest[]>([]);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    personalEmail: "",
    team: "",
    startDate: ""
  });

  const canSubmit = useMemo(() => {
    return (
      form.firstName.trim() &&
      form.lastName.trim() &&
      form.personalEmail.trim().includes("@")
    );
  }, [form]);

  async function refresh() {
    setError(null);
    const resp = await fetch(`/api/onboarding/requests?type=${type}`, {
      cache: "no-store"
    });
    const json = await resp.json();
    setRequests(json.data ?? []);
  }

  useEffect(() => {
    refresh().catch((e) => setError(String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setError(null);
    try {
      const resp = await fetch("/api/onboarding/requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type, ...form })
      });

      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(txt || `Request failed: ${resp.status}`);
      }

      setForm({
        firstName: "",
        lastName: "",
        personalEmail: "",
        team: "",
        startDate: ""
      });

      await refresh();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 26, margin: 0 }}>{title}</h1>
      <p style={{ marginTop: 6, opacity: 0.7 }}>
        Create an onboarding request and track status.
      </p>

      <section
        style={{
          marginTop: 18,
          padding: 16,
          border: "1px solid rgba(0,0,0,0.12)",
          borderRadius: 12,
          maxWidth: 720
        }}
      >
        <h2 style={{ fontSize: 16, margin: 0, marginBottom: 12 }}>
          New request
        </h2>

        <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
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

          <Field
            label="Personal email *"
            value={form.personalEmail}
            onChange={(v) => setForm((f) => ({ ...f, personalEmail: v }))}
            placeholder="name@gmail.com"
          />

          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
            <Field
              label="Team (optional)"
              value={form.team}
              onChange={(v) => setForm((f) => ({ ...f, team: v }))}
              placeholder="Events / Marketing / Tech..."
            />
            <Field
              label="Start date (optional)"
              value={form.startDate}
              onChange={(v) => setForm((f) => ({ ...f, startDate: v }))}
              placeholder="YYYY-MM-DD"
            />
          </div>

          <button
            type="submit"
            disabled={!canSubmit || loading}
            style={{
              height: 38,
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.2)",
              background: loading ? "rgba(0,0,0,0.05)" : "white",
              cursor: !canSubmit || loading ? "not-allowed" : "pointer"
            }}
          >
            {loading ? "Creating..." : "Create request"}
          </button>

          {error ? (
            <p style={{ margin: 0, color: "crimson", whiteSpace: "pre-wrap" }}>
              {error}
            </p>
          ) : null}
        </form>
      </section>

      <section style={{ marginTop: 22 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <h2 style={{ fontSize: 16, margin: 0 }}>Requests</h2>
          <button
            onClick={() => refresh().catch((e) => setError(String(e)))}
            style={{
              height: 28,
              padding: "0 10px",
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.2)",
              background: "white",
              cursor: "pointer"
            }}
          >
            Refresh
          </button>
        </div>

        <div style={{ marginTop: 10, overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", minWidth: 900 }}>
            <thead>
              <tr>
                {["Created", "ID", "Name", "Email", "Team", "Start", "Status"].map((h) => (
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
                  <td colSpan={7} style={{ padding: 12, opacity: 0.7 }}>
                    No requests yet.
                  </td>
                </tr>
              ) : (
                requests.map((r) => (
                  <tr key={r.id}>
                    <td style={cellStyle}>{new Date(r.createdAt).toLocaleString()}</td>
                    <td style={cellStyle}>{r.id}</td>
                    <td style={cellStyle}>{r.firstName} {r.lastName}</td>
                    <td style={cellStyle}>{r.personalEmail}</td>
                    <td style={cellStyle}>{r.team ?? ""}</td>
                    <td style={cellStyle}>{r.startDate ?? ""}</td>
                    <td style={cellStyle}>{r.status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <p style={{ marginTop: 10, opacity: 0.6 }}>
          Dev note: requests are stored in memory for now (will reset on restart).
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