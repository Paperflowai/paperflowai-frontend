import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // Minimal validering för test
    if (!body?.customerId || !body?.data) {
      return NextResponse.json({ ok: false, error: "Missing customerId or data" }, { status: 400 });
    }
    const offer = {
      id: "test-offer-id",
      customer_id: String(body.customerId),
      title: String(body.title ?? "Offert"),
      amount: Number(body.amount ?? 0),
      currency: String(body.currency ?? "SEK"),
      file_url: "http://localhost:3000/ping.txt",
      created_at: new Date().toISOString()
    };
    return NextResponse.json({ ok: true, offer }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
