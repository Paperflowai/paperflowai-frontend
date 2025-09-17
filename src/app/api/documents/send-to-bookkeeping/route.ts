import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const runtime = "nodejs";

type SendToBookkeepingBody = {
  customerId: string;
};

function bad(msg: string, code = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status: code });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SendToBookkeepingBody;
    const { customerId } = body;

    if (!customerId) {
      return bad("Missing required field: customerId");
    }

    // Hämta senaste faktura för kunden
    const { data: invoiceData, error: invoiceError } = await supabaseAdmin
      .from("documents")
      .select("*")
      .eq("customer_id", customerId)
      .eq("type", "faktura")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (invoiceError || !invoiceData) {
      return bad("Faktura hittades inte");
    }

    // Markera fakturan som betald i documents-tabellen
    const { data: updatedInvoice, error: updateError } = await supabaseAdmin
      .from("documents")
      .update({
        paid_at: new Date().toISOString()
      })
      .eq("id", invoiceData.id)
      .select()
      .single();

    if (updateError) {
      console.error("Update error:", updateError);
      return bad("Kunde inte markera faktura som betald");
    }

    // Logga export till konsolen (senare kopplas till bokföringssystem)
    const bookkeepingEntry = {
      invoice_id: invoiceData.id,
      customer_id: customerId,
      amount: invoiceData.amount,
      currency: invoiceData.currency,
      invoice_number: invoiceData.data_json?.invoiceNumber,
      customer_name: invoiceData.data_json?.customer?.name,
      exported_at: new Date().toISOString()
    };

    // Logga för utveckling
    console.log("Faktura skickad till bokföring:", {
      invoiceId,
      customerId,
      amount: invoiceData.amount,
      currency: invoiceData.currency,
      invoiceNumber: invoiceData.data_json?.invoiceNumber
    });

    return NextResponse.json({
      ok: true,
      invoice: updatedInvoice,
      bookkeepingEntry: bookkeepingEntry,
      message: "Faktura markerad som betald och skickad till bokföring"
    });

  } catch (error) {
    console.error("Bookkeeping error:", error);
    return bad(`Server error: ${error instanceof Error ? error.message : String(error)}`);
  }
}
