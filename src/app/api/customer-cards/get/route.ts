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

    // If no card or missing basic fields, try derive from latest offer's data_json.kund
    let result = card || null as any;
    const needsFallback = !result || [
      result.name,
      result.email,
      result.phone,
      result.address,
      result.zip,
      result.city,
      result.orgnr,
    ].every((v: any) => v == null || v === "");

    if (needsFallback) {
      const { data: offers, error: offerErr } = await supabaseAdmin
        .from("offers")
        .select("data_json, created_at")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (!offerErr && offers && offers.length > 0) {
        const dj = offers[0]?.data_json as any;
        const kund = dj?.kund || dj?.customer || {};
        result = {
          id: customerId,
          name: kund.namn ?? kund.name ?? result?.name ?? null,
          orgnr: kund.orgnr ?? result?.orgnr ?? null,
          email: kund.epost ?? kund.email ?? result?.email ?? null,
          phone: kund.telefon ?? kund.phone ?? result?.phone ?? null,
          address: kund.adress ?? kund.address ?? result?.address ?? null,
          zip: kund.postnummer ?? kund.zip ?? result?.zip ?? null,
          city: kund.ort ?? kund.city ?? result?.city ?? null,
          country: kund.land ?? result?.country ?? "Sverige",
          updated_at: result?.updated_at ?? null,
        };
      }
    }

    return NextResponse.json({ ok: true, card: result }, { status: 200 });
  } catch (e: any) {
    console.error("Customer card API error:", e);
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}