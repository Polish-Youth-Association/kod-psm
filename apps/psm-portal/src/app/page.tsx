export default function Home() {
  return (
    <main style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>PSM Portal</h1>
      <p style={{ marginTop: 0, opacity: 0.8 }}>
        Internal tools for Polish Youth Association.
      </p>

      <div style={{ marginTop: 24, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <a href="/volunteer-onboarding">Volunteer onboarding</a>
        <a href="/reimbursements">Reimbursements</a>
      </div>

      <p style={{ marginTop: 24, opacity: 0.6 }}>
        Next step: add Google login + admin-only access.
      </p>
    </main>
  );
}