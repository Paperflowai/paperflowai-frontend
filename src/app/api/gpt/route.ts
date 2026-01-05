import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // 🔴 DEN HÄR LOGGEN SKA DU SE VARJE GÅNG GPT ANROPAR API:ET
  console.log("🔥 /api/gpt ROUTE HIT");

  let body: any = null;

  try {
    body = await req.json();
  } catch (e) {
    console.log("❌ Kunde inte läsa JSON-body");
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // 🔴 DEN HÄR ÄR DEN VIKTIGA LOGGEN
  console.log("📦 GPT PAYLOAD >>>", JSON.stringify(body, null, 2));

  return NextResponse.json({
    ok: true,
    received: body,
  });
}

export async function GET() {
  return NextResponse.json({ ok: true });
}
