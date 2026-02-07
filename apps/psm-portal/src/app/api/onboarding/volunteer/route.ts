import { NextResponse } from "next/server";
import { GoogleAuth } from "google-auth-library";

export async function POST(req: Request) {
  const base = process.env.VOLUNTEER_ONBOARDING_BASE;

  if (!base) {
    return NextResponse.json(
      { ok: false, error: "VOLUNTEER_ONBOARDING_BASE is not set" },
      { status: 500 }
    );
  }

  const payload = await req.json();
  const url = `${base.replace(/\/$/, "")}/v1/onboarding/volunteers`;

  try {
    const headers: Record<string, string> = {
        "content-type": "application/json"
      };
      
      const auth = new GoogleAuth();
      const client = await auth.getIdTokenClient(base.trim());
      const authHeaders = await client.getRequestHeaders();
      console.log("Auth headers", authHeaders);
      Object.assign(headers, authHeaders);
      console.log("headers", headers);

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

    /// RM after debugging
    console.log("proxy config", {
        base,
        url,
        authHeader: headers.authorization,
      });
///////////
    return NextResponse.json(
      { ok: upstream.ok, upstream: { url, status: upstream.status }, body },
      { status: upstream.ok ? 200 : upstream.status }
    );
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, upstream: { url }, error: err?.message ?? String(err) },
      { status: 502 }
    );
  }
}