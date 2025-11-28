export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import {
  supabaseAdmin as admin,
  supabaseAdminConfigured,
} from "@/lib/supabaseServer";
import { upsertFlowStatusServer } from "@/lib/flowStatusServer";

function json(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

export async function GET() {
  return json({ ok: true, ping: "offers/send" });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as any;
    const customerId: string | undefined = body?.customerId;
    const offerPath: string | undefined = body?.offerPath;
    const bucketName: string = body?.bucket || "paperflow-files";

    if (!customerId) {
      return json(
        { ok: false, where: "input", message: "customerId krävs" },
        400
      );
    }

    const sentAt = new Date().toISOString();

    if (supabaseAdminConfigured) {
      try {
        const selector = admin
          .from("documents")
          .update({
            status: "sent",
            updated_at: sentAt,
            sent_at: sentAt,
          })
          .eq("customer_id", customerId)
          .in("type", ["offer", "offert"])
          .order("created_at", { ascending: false })
          .limit(1);

        const target = offerPath
          ? selector.eq("storage_path", offerPath)
          : selector;

        const update = await target.select();
        if (update.error) {
          console.warn("[offer-send] documents update warn", update.error.message);
        }
      } catch (err: any) {
        console.warn("[offer-send] documents update failed", err?.message || err);
      }

      await upsertFlowStatusServer(customerId, { offerSent: true });
    }

    return json({
      ok: true,
      sentAt,
      mode: supabaseAdminConfigured ? "supabase" : "local",
      bucket: bucketName,
      offerPath: offerPath ?? null,
    });
  } catch (err: any) {
    console.error("[offer-send] exception:", err);
    return json(
      {
        ok: false,
        where: "exception",
        message: err?.message || String(err),
      },
      500
    );
  }
}
