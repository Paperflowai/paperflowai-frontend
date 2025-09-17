import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

type UpdateStatusBody = {
  offerId: string;
  customerId: string;
  status: 'sent' | 'order_confirmed';
};

function bad(msg: string, code = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status: code });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as UpdateStatusBody;
    if (!body?.offerId) return bad("Missing offerId");
    if (!body?.customerId) return bad("Missing customerId");
    if (!body?.status) return bad("Missing status");

    // Uppdatera offertens status i databasen
    const { error: updateError } = await supabaseAdmin
      .from("offers")
      .update({ status: body.status })
      .eq("id", body.offerId)
      .eq("customer_id", body.customerId);

    if (updateError) {
      return bad(`Status update failed: ${updateError.message}`, 500);
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return bad(e?.message ?? "Unknown error", 500);
  }
}
