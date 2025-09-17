import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

type DeleteBody = {
  offerId: string;
  customerId: string;
};

function bad(msg: string, code = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status: code });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as DeleteBody;
    if (!body?.offerId) return bad("Missing offerId");
    if (!body?.customerId) return bad("Missing customerId");

    const bucket = "paperflow-files";
    const storagePath = `customers/${body.customerId}/offers/${body.offerId}.pdf`;

    // 1) Ta bort PDF i Storage
    const { error: remErr } = await supabaseAdmin.storage
      .from(bucket)
      .remove([storagePath]);
    if (remErr) return bad(`Storage remove failed: ${remErr.message}`, 500);

    // 2) Ta bort DB-raden
    const { error: delErr } = await supabaseAdmin
      .from("offers")
      .delete()
      .eq("id", body.offerId)
      .eq("customer_id", body.customerId);
    if (delErr) return bad(`DB delete failed: ${delErr.message}`, 500);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return bad(e?.message ?? "Unknown error", 500);
  }
}
