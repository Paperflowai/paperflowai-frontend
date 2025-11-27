// src/app/api/offers/save/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const payload = await req.json();

    if (!payload || typeof payload !== "object") {
      return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
    }

    // Viktigt: kundkoppling krävs
    const customerId = payload.customerId;
    if (!customerId) {
      return NextResponse.json({ ok: false, error: "Saknar customerId" }, { status: 400 });
    }

    const status = payload.status ?? "draft";

    // Skapa offerten. Triggern i DB sätter offer_number automatiskt.
    const { data, error } = await supabaseAdmin
      .from("offers")
      .insert([
        {
          customer_id: customerId,
          status,
          data: payload, // spara hela offerPayload för spårbarhet
        },
      ])
      .select("id, offer_number")
      .single();

    if (error) {
      console.error("Insert error:", error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { ok: true, id: data.id, offerNumber: data.offer_number },
      { status: 201 }
    );
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
