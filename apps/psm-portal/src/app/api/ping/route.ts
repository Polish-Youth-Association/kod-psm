import { NextResponse } from "next/server";
import { GoogleAuth } from "google-auth-library";

export async function GET() {
  const base = process.env.API_BASE;
  const auth = new GoogleAuth();
  const client = await auth.getIdTokenClient(base); // audience = service URL
  const headers = await client.getRequestHeaders();
  if (!base) {
    return NextResponse.json(
      { ok: false, error: "API_BASE is not set" },
      { status: 500 }
    );
  }

  const url = `${base.replace(/\/$/, "")}/`;

  try {
    const resp = await fetch(url, { cache: "no-store" });
    const text = await resp.text();

    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {}

    return NextResponse.json({
      ok: resp.ok,
      upstream: { url, status: resp.status },
      body
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, upstream: { url }, error: err?.message ?? String(err) },
      { status: 502 }
    );
  }
}