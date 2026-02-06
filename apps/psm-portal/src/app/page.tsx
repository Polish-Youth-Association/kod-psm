"use client";

import { useState } from "react";

export default function Home() {
  const [result, setResult] = useState<string>("");

  async function testExample() {
    setResult("Calling example service...");
    try {
      const res = await fetch("/api/ping", { cache: "no-store" });
      const json = await res.json();
      setResult(JSON.stringify(json, null, 2));
    } catch (e: any) {
      setResult(`Error: ${e?.message ?? String(e)}`);
    }
  }
  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>PSM Portal</h1>
      <p style={{ marginTop: 0, opacity: 0.8 }}>
        Internal tools for Polish Youth Association.
      </p>

      <div style={{ marginTop: 24, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <a href="/volunteer-onboarding">Volunteer onboarding</a>
      </div>

      <p style={{ marginTop: 24, opacity: 0.6 }}>
        Next step: add Google login + admin-only access.
      </p>

      <div style={{ marginTop: 24, display: "grid", gap: 10, maxWidth: 700 }}>
        <button
          onClick={testExample}
          style={{
            height: 38,
            padding: "0 14px",
            borderRadius: 10,
            border: "1px solid rgba(0,0,0,0.2)",
            background: "white",
            cursor: "pointer",
            width: "fit-content"
          }}
        >
          Test API
        </button>

        {result ? (
          <pre
            style={{
              margin: 0,
              padding: 12,
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.12)",
              background: "rgba(0,0,0,0.03)",
              overflowX: "auto"
            }}
          >
            {result}
          </pre>
        ) : null}
      </div>
    </main>
  );
}