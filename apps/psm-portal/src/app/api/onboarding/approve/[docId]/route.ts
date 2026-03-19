import { NextResponse } from "next/server";
import { GoogleAuth } from "google-auth-library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ docId: string }> }
) {
  const base = process.env.MEMBER_ONBOARDING_BASE?.trim();

  if (!base) {
    return NextResponse.json(
      { ok: false, error: "MEMBER_ONBOARDING_BASE is not set" },
      { status: 500 }
    );
  }

  const { docId } = await params;
  const url = `${base.replace(/\/$/, "")}/api/members/${docId}/approve`;
  const isLocal = base.includes("localhost");

  try {
    const body = await req.json();

    const headers: Record<string, string> = { "content-type": "application/json" };

    if (!isLocal) {
      const auth = new GoogleAuth();
      const client = await auth.getIdTokenClient(base);
      const authHeaders = await client.getRequestHeaders();
      const token = authHeaders.get("authorization") || authHeaders.get("Authorization");
      if (token) headers["authorization"] = token;
    }

    const upstream = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const json = await upstream.json();
    return NextResponse.json(json, { status: upstream.status });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? String(err) },
      { status: 502 }
    );
  }
}
