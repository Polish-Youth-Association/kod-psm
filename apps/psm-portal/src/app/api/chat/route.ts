import { NextResponse } from "next/server";
import { GoogleAuth } from "google-auth-library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const base = process.env.GEMINI_BASE?.trim();

  if (!base) {
    return NextResponse.json({ ok: false, error: "GEMINI_BASE is not set" }, { status: 500 });
  }

  const url = `${base.replace(/\/$/, "")}/v1/chat`;

  try {
    const payload = await req.json();

    const isLocal = base.includes("localhost") || base.includes("127.0.0.1");
    const headers: Record<string, string> = { "content-type": "application/json" };

    if (!isLocal) {
      const auth = new GoogleAuth();
      const client = await auth.getIdTokenClient(base);
      const authHeaders = await client.getRequestHeaders();
      const token = authHeaders.get("authorization") || authHeaders.get("Authorization");
      if (!token) {
        return NextResponse.json(
          { ok: false, error: "Failed to mint ID token (no authorization header)" },
          { status: 500 }
        );
      }
      headers.authorization = token;
    }

    const upstream = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      cache: "no-store"
    });

    const text = await upstream.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {}

    return NextResponse.json(body, { status: upstream.status });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? String(err) },
      { status: 502 }
    );
  }
}
