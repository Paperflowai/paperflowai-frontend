import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

function bad(msg: string, code = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status: code });
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get("customerId");
    if (!customerId) return bad("Missing customerId");

    const { data, error } = await supabaseAdmin
      .from("customer_cards")
      .select("customer_id,name,orgnr,email,phone,address,updated_at")
      .eq("customer_id", customerId)
      .maybeSingle();

    if (error) return bad(`DB error: ${error.message}`, 500);

    return NextResponse.json({ ok: true, card: data ?? null }, { status: 200 });
  } catch (e: any) {
    return bad(e?.message ?? "Unknown error", 500);
  }
}
