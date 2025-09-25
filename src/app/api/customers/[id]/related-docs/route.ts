import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

async function safeSelect(table: string, customerId: string, want: number) {
  try {
    let q = admin.from(table).select("*").eq("customer_id", customerId).order("created_at", { ascending: false }).limit(want);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  } catch (e: any) {
    // Fallback: utan order (om kolumn saknas) eller om tabellen inte finns → tom lista
   try {
      const { data, error } = await admin.from(table).select("*").eq("customer_id", customerId).limit(want);
      if (error) return [];
      return data ?? [];
    } catch {
      return [];
    }
  }
}

function norm(table: "offers"|"orders"|"invoices", rows: any[]) {
  return rows.map((r) => {
    const number = r.number ?? r.no ?? r.invoice_number ?? r.order_number ?? r.offer_number ?? null;
    const date = r.created_at ?? r.date ?? r.issued_at ?? r.invoice_date ?? r.order_date ?? null;
    const amount = r.total_amount ?? r.amount ?? r.total ?? r.grand_total ?? null;
    const status = r.status ?? r.state ?? null;
    const url = r.url ?? r.pdf_url ?? r.file_url ?? null;
    return { id: r.id, table, number, date, amount, status, url };
  });
}

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  const customerId = decodeURIComponent(ctx.params.id);
  const want = 5;
  async function listOfferDocs(customerId: string, want: number) {
    let rows: any[] = [];
    try {
      const q = await admin
        .from("documents")
        .select("*")
        .eq("customer_id", customerId)
        .in("doc_type", ["offer", "offert"])
        .order("created_at", { ascending: false })
        .limit(want);
      if (!q.error) rows = q.data || [];
    } catch {}
    if (!rows.length) {
      try {
        const q2 = await admin
          .from("documents")
          .select("*")
          .eq("customer_id", customerId)
          .in("type", ["offer", "offert"])
          .order("created_at", { ascending: false })
          .limit(want);
        if (!q2.error) rows = q2.data || [];
      } catch {}
    }

    return rows.map((r: any) => {
      let url = r.url || r.file_url || r.pdf_url || null;
      if (!url && r.storage_path) {
        const b = r.bucket || r.bucket_name || "offers";
        const pub = admin.storage.from(b).getPublicUrl(r.storage_path);
        url = pub.data?.publicUrl || null;
      }
      return {
        id: r.id,
        table: "offers",
        number: r.number ?? null,
        date: r.created_at ?? r.date ?? null,
        amount: r.total_amount ?? r.amount ?? null,
        status: r.status ?? "imported",
        url,
      };
    });
  }

  const [offers, orders, invoices] = await Promise.all([
    listOfferDocs(customerId, want),
    safeSelect("orders", customerId, want).then((x) => norm("orders", x)),
    safeSelect("invoices", customerId, want).then((x) => norm("invoices", x)),
  ]);
  return NextResponse.json({ offers, orders, invoices });
}


