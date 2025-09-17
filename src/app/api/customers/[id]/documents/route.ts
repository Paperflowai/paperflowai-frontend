import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

function bad(msg: string, code = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status: code });
}

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const customerId = params.id;
    if (!customerId) return bad("Missing customer ID");

    // Hämta alla offerter för kunden
    const { data: offers, error: offersError } = await supabaseAdmin
      .from("offers")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });

    if (offersError) {
      return bad(`Failed to fetch offers: ${offersError.message}`, 500);
    }

    // Hämta alla orderbekräftelser för kunden (från storage)
    const { data: orderFiles, error: orderError } = await supabaseAdmin.storage
      .from("paperflow-files")
      .list(`customers/${customerId}/orders`, {
        limit: 100,
        sortBy: { column: "created_at", order: "desc" }
      });

    if (orderError) {
      console.warn("Could not fetch order confirmations:", orderError.message);
    }

    // Hämta alla fakturor för kunden (från storage)
    const { data: invoiceFiles, error: invoiceError } = await supabaseAdmin.storage
      .from("paperflow-files")
      .list(`customers/${customerId}/invoices`, {
        limit: 100,
        sortBy: { column: "created_at", order: "desc" }
      });

    if (invoiceError) {
      console.warn("Could not fetch invoices:", invoiceError.message);
    }

    // Formatera dokumenten
    const documents = [];

    // Lägg till offerter
    offers?.forEach(offer => {
      documents.push({
        id: offer.id,
        type: "offert",
        title: offer.title || "Offert",
        amount: offer.amount,
        currency: offer.currency || "SEK",
        file_url: offer.file_url,
        created_at: offer.created_at,
        status: offer.status,
        needs_print: offer.needs_print
      });
    });

    // Lägg till orderbekräftelser
    orderFiles?.forEach(file => {
      if (file.name.endsWith('.pdf')) {
        const { data: urlData } = supabaseAdmin.storage
          .from("paperflow-files")
          .getPublicUrl(`customers/${customerId}/orders/${file.name}`);
        
        documents.push({
          id: file.id,
          type: "orderbekräftelse",
          title: "Orderbekräftelse",
          amount: null,
          currency: null,
          file_url: urlData.publicUrl,
          created_at: file.created_at,
          status: "completed",
          needs_print: false
        });
      }
    });

    // Lägg till fakturor
    invoiceFiles?.forEach(file => {
      if (file.name.endsWith('.pdf')) {
        const { data: urlData } = supabaseAdmin.storage
          .from("paperflow-files")
          .getPublicUrl(`customers/${customerId}/invoices/${file.name}`);
        
        documents.push({
          id: file.id,
          type: "faktura",
          title: "Faktura",
          amount: null,
          currency: null,
          file_url: urlData.publicUrl,
          created_at: file.created_at,
          status: "completed",
          needs_print: false
        });
      }
    });

    // Sortera efter datum (nyaste först)
    documents.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return NextResponse.json({
      ok: true,
      documents,
      summary: {
        total: documents.length,
        offers: offers?.length || 0,
        orders: orderFiles?.length || 0,
        invoices: invoiceFiles?.length || 0
      }
    }, { status: 200 });

  } catch (e: any) {
    return bad(e?.message ?? "Unknown error", 500);
  }
}
