import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const OFFER_URL = process.env.NEXT_PUBLIC_OFFER_URL!;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 30000);
  try {
    const body = await req.json();
    const res = await fetch(`${OFFER_URL}/generate-offer`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message || "Proxy error" }, { status: 500 });
  } finally {
    clearTimeout(t);
  }
}
