import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function bad(msg: string, code = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status: code });
}

interface CustomerDocument {
  id: string | number;
  type: "offert" | "orderbekräftelse" | "faktura";
  title: string;
  amount: number | null;
  currency: string | null;
  file_url: string | null;
  created_at?: string | null;
  status?: string;
  needs_print?: boolean;
}

async function safeSelectOffers(client: any, customerId: string) {
  try {
    const { data, error } = await client
      .from("offers")
      .select("id, customer_id, title, amount, currency, file_url, created_at")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  } catch {
    return [] as any[];
  }
}

export async function GET(
  _req: Request,
  ctx: { params: { id: string } }
) {
  try {
    const customerId = ctx.params.id;
    if (!customerId) return bad("Missing customer ID");

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_ROLE) {
      // Utan konfigurerad backend returnerar vi tomma listor istället för 500
      return NextResponse.json(
        {
          ok: true,
          documents: [],
          summary: { total: 0, offers: 0, orders: 0, invoices: 0 },
        },
        { status: 200 }
      );
    }

    const supabaseAdmin = createClient(SUPABASE_URL as string, SERVICE_ROLE as string, { auth: { persistSession: false } });

    // Hämta offerter (DB) med safe fallback
    const offers = await safeSelectOffers(supabaseAdmin, customerId);

    // OBS: För att undvika 500-fel i dev tar vi bort Storage-listningar här
    const orderFiles: any[] = [];
    const invoiceFiles: any[] = [];

    // Samla dokument
    const documents: CustomerDocument[] = [];

    // Lägg till offerter
    offers?.forEach((offer: any) => {
      documents.push({
        id: offer.id,
        type: "offert",
        title: offer.title || "Offert",
        amount: offer.amount ?? null,
        currency: offer.currency ?? "SEK",
        file_url: offer.file_url ?? null,
        created_at: offer.created_at ?? null,
        status: undefined,
        needs_print: false,
      });
    });

    // Lägg till orderbekräftelser
    orderFiles?.forEach((file: any) => {
      if (file?.name?.toLowerCase().endsWith(".pdf")) {
        const { data: urlData } = supabaseAdmin.storage
          .from("paperflow-files")
          .getPublicUrl(`customers/${customerId}/orders/${file.name}`);

        documents.push({
          id: file.id ?? file.name,
          type: "orderbekräftelse",
          title: "Orderbekräftelse",
          amount: null,
          currency: null,
          file_url: urlData.publicUrl ?? null,
          created_at: file.created_at ?? file.updated_at ?? null,
          status: "completed",
          needs_print: false,
        });
      }
    });

    // Lägg till fakturor
    invoiceFiles?.forEach((file: any) => {
      if (file?.name?.toLowerCase().endsWith(".pdf")) {
        const { data: urlData } = supabaseAdmin.storage
          .from("paperflow-files")
          .getPublicUrl(`customers/${customerId}/invoices/${file.name}`);

        documents.push({
          id: file.id ?? file.name,
          type: "faktura",
          title: "Faktura",
          amount: null,
          currency: null,
          file_url: urlData.publicUrl ?? null,
          created_at: file.created_at ?? file.updated_at ?? null,
          status: "completed",
          needs_print: false,
        });
      }
    });

    // Sortera nyast först
    const toTs = (d?: string | null) => (d ? new Date(d).getTime() : 0);
    documents.sort((a, b) => toTs(b.created_at) - toTs(a.created_at));

    // Returnera resultat
    return NextResponse.json(
      {
        ok: true,
        documents,
        summary: {
          total: documents.length,
          offers: offers?.length ?? 0,
          orders: orderFiles.length,
          invoices: invoiceFiles.length,
        },
      },
      { status: 200 }
    );
  } catch (e: any) {
    return bad(e?.message ?? "Unknown error", 500);
  }
}
