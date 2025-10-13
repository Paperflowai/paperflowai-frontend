import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Tillåt båda varianterna av env-namn
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
const SERVICE_ROLE =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

// Viktigt i Next 15: 2:a argumentet typas som "any"
export async function DELETE(req: Request, context: any) {
  const params = context?.params ?? {};
  const customerId = decodeURIComponent(String(params.id ?? params.customerId ?? ""));
  const docId = decodeURIComponent(String(params.docId ?? params.id ?? ""));

  if (!docId) {
    return NextResponse.json({ error: "missing docId" }, { status: 400 });
  }

  try {
    // Body kan saknas
    let body: any = null;
    try {
      body = await req.json();
    } catch {}

    const candidateUrl: string | undefined = body?.url;

    // 1) Hämta dokumentraden (för att kunna ta bort filen i Storage)
    let { data: doc, error: getErr } = await admin
      .from("documents")
      .select("id, customer_id, storage_path, bucket, bucket_name")
      .eq("id", docId)
      .maybeSingle();

    if ((!doc || getErr) && candidateUrl) {
      // Försök hitta via URL-fält som fallback
      const tryFields = ["url", "file_url", "pdf_url"] as const;
      for (const f of tryFields) {
        const q = await admin
          .from("documents")
          .select("id, customer_id, storage_path, bucket, bucket_name")
          .eq(f as any, candidateUrl)
          .maybeSingle();
        if (!q.error && q.data) {
          doc = q.data as any;
          break;
        }
      }
      if (!doc) {
        return NextResponse.json(
          { error: getErr?.message || "document not found" },
          { status: 404 }
        );
      }
    }

    // 2) Säkerhetskoll: kund-id måste matcha om det finns
    if (
      customerId &&
      (doc as any).customer_id &&
      String((doc as any).customer_id) !== String(customerId)
    ) {
      return NextResponse.json({ error: "customer mismatch" }, { status: 403 });
    }

    // 3) Ta bort fil i Storage om uppgifter finns
    const storagePath = (doc as any)?.storage_path as string | undefined;
    const bucket = ((doc as any)?.bucket ||
      (doc as any)?.bucket_name) as string | undefined;

    if (storagePath && bucket) {
      try {
        await admin.storage.from(bucket).remove([storagePath]);
      } catch {
        // Ignorera storage-fel – raden raderas ändå nedan
      }
    }

    // 4) Radera dokumentraden
    const { error: delErr } = await admin
      .from("documents")
      .delete()
      .eq("id", docId);

    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "delete failed" },
      { status: 500 }
    );
  }
}
