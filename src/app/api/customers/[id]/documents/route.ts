import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

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

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id: customerId } = await ctx.params;
    if (!customerId) return bad("Missing customer ID");

    // Hämta offerter (DB)
    const { data: offers, error: offersError } = await supabaseAdmin
      .from("offers")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });

    if (offersError) {
      return bad(`Failed to fetch offers: ${offersError.message}`, 500);
    }

    // Hämta orderbekräftelser (Storage)
    const { data: orderFiles, error: orderError } = await supabaseAdmin.storage
      .from("paperflow-files")
      .list(`customers/${customerId}/orders`, {
        limit: 100,
        sortBy: { column: "created_at", order: "desc" },
      });

    if (orderError) {
      console.warn("Could not fetch order confirmations:", orderError.message);
    }

    // Hämta fakturor (Storage)
    const { data: invoiceFiles, error: invoiceError } =
      await supabaseAdmin.storage
        .from("paperflow-files")
        .list(`customers/${customerId}/invoices`, {
          limit: 100,
          sortBy: { column: "created_at", order: "desc" },
        });

    if (invoiceError) {
      console.warn("Could not fetch invoices:", invoiceError.message);
    }

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
        status: offer.status,
        needs_print: offer.needs_print,
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
          orders: orderFiles?.length ?? 0,
          invoices: invoiceFiles?.length ?? 0,
        },
      },
      { status: 200 }
    );
  } catch (e: any) {
    return bad(e?.message ?? "Unknown error", 500);
  }
}
