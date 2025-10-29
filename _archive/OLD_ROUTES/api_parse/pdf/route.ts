import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const PARSE_URL = process.env.NEXT_PUBLIC_PARSE_URL!;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 45000);
  try {
    const form = await req.formData();
    const res = await fetch(`${PARSE_URL}/parse-pdf`, {
      method: "POST",
      body: form,
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
