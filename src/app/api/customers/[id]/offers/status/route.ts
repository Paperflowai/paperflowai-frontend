import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const ALLOWED = ["draft", "sent", "accepted", "rejected", "canceled"] as const;
type AllowedStatus = (typeof ALLOWED)[number];

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null) as {
      offerId?: string | number;
      status?: AllowedStatus;
    } | null;

    if (!body || body.offerId == null || !body.status) {
      return NextResponse.json(
        { ok: false, error: "Body must include { offerId, status }" },
        { status: 400 }
      );
    }

    const status = String(body.status).toLowerCase();
    if (!ALLOWED.includes(status as AllowedStatus)) {
      return NextResponse.json(
        { ok: false, error: `Invalid status. Allowed: ${ALLOWED.join(", ")}` },
        { status: 400 }
      );
    }

    // Uppdatera raden
    const { data, error } = await supabaseAdmin
      .from("offers")
      .update({ status })
      .eq("id", body.offerId)
      .select("id, customer_id, status, created_at")
      .single();

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }
    if (!data) {
      return NextResponse.json(
        { ok: false, error: "Offer not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, data }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
