import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { parsed } = await req.json();

    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/offers/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    return NextResponse.json({ ok: true, offer: data.offer });
  } catch (err) {
    console.error("save error", err);
    return NextResponse.json({ ok: false, error: "Save failed" }, { status: 500 });
  }
}
