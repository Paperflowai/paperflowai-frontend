import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get("customerId");

    if (!customerId) {
      return NextResponse.json({ ok: false, error: "Missing customerId parameter" }, { status: 400 });
    }

    const { data: card, error } = await supabaseAdmin
      .from("customers")
      .select("id,name,orgnr,email,phone,address,zip,city,country,updated_at")
      .eq("id", customerId)
      .single();

    if (error && error.code !== "PGRST116") { // PGRST116 = no rows found
      console.error("Error fetching customer card:", error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, card: card || null }, { status: 200 });
  } catch (e: any) {
    console.error("Customer card API error:", e);
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}