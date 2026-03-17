import { NextResponse } from "next/server";
import { GoogleAuth } from "google-auth-library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const base = process.env.MEMBER_ONBOARDING_BASE?.trim();

  if (!base) {
    return NextResponse.json(
      { ok: false, error: "MEMBER_ONBOARDING_BASE is not set" },
      { status: 500 }
    );
  }

  const url = `${base.replace(/\/$/, "")}/api/onboard`;

  try {
    const formData = await req.formData();

    for (const field of ["firstNamePolish", "firstNameEnglish", "email", "memberId"]) {
      if (!formData.get(field)) {
        return NextResponse.json(
          { ok: false, error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

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

    // Do NOT set content-type — let fetch set it with the multipart boundary
    const upstream = await fetch(url, {
      method: "POST",
      headers: { authorization: token },
      body: formData,
      cache: "no-store"
    });

    const text = await upstream.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {}

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
