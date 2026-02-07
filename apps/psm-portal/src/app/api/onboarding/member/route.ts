import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json();

  // Minimal validation (tighten later)
  if (!body?.firstName || !body?.lastName || !body?.personalEmail || !body?.team) {
    return NextResponse.json(
      { ok: false, error: "Missing required fields" },
      { status: 400 }
    );
  }

  // For now: just echo back with an ID
  const requestId = `req_${Math.random().toString(36).slice(2, 10)}`;

  return NextResponse.json({
    ok: true,
    requestId,
    status: "Submitted"
  });
}