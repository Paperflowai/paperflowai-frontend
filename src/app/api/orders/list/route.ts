import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get("customerId");

    // Hämta orders från orders-tabellen
    let query = supabaseAdmin
      .from("orders")
      .select("id, created_at, status, customer_id, pdf_url, storage_path, bucket_name, number, total, vat_total")
      .order("created_at", { ascending: false });

    const { data, error } = customerId
      ? await query.eq("customer_id", customerId)
      : await query.limit(25);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    // Mappa orders till format som matchar det som UI förväntar sig
    const items = (data ?? []).map((order: any) => ({
      id: order.id,
      created_at: order.created_at,
      status: order.status,
      customer_id: order.customer_id,
      file_url: order.pdf_url,
      storage_path: order.storage_path,
      bucket_name: order.bucket_name,
      filename: order.number ? `${order.number}.pdf` : null,
      number: order.number,
    }));

    return NextResponse.json({ ok: true, items }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}

