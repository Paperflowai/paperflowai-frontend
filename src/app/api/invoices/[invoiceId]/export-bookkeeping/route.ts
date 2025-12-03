import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { exportInvoiceToBookkeeping } from "@/lib/bookkeeping";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
const SERVICE_ROLE =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

export async function POST(_req: Request, context: any) {
  const invoiceId = decodeURIComponent(context?.params?.invoiceId ?? "");
  if (!invoiceId) {
    return NextResponse.json({ error: "Invoice ID required" }, { status: 400 });
  }

  try {
    // Hämta faktura
    const { data: invoice, error: fetchError } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .single();

    if (fetchError || !invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Hämta kund (valfritt)
    const { data: customer } = await supabase
      .from("customers")
      .select("name AS company_name, contact_person")
      .eq("id", invoice.customer_id)
      .maybeSingle();

    // Paketera data till export
    const invoiceData = {
      id: invoice.id,
      number: invoice.number,
      customer_name: customer?.company_name || "",
      contact_person: customer?.contact_person || "",
      total: invoice.total ?? invoice.grand_total ?? null,
      vat_total: invoice.vat_total ?? null,
      due_date: invoice.due_date ?? null,
      pdf_url: invoice.pdf_url ?? invoice.url ?? null,
      data: invoice.data ?? null,
    };

    // Exportera till bokföring
    const exportResult = await exportInvoiceToBookkeeping(invoiceData);
    if (!exportResult?.ok) {
      return NextResponse.json(
        { error: "Failed to export to bookkeeping" },
        { status: 500 }
      );
    }

    // Uppdatera status på fakturan
    const { data: updatedInvoice, error: updateError } = await supabase
      .from("invoices")
      .update({ status: "exported" })
      .eq("id", invoiceId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to update invoice status" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, invoice: updatedInvoice });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
