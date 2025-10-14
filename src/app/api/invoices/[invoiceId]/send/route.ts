import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: NextRequest, context: any) {
  try {
    const invoiceId = decodeURIComponent(context?.params?.invoiceId ?? "");

    if (!invoiceId) {
      return NextResponse.json({ error: "Invoice ID required" }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Hämta fakturan
    const { data: invoice, error: fetchError } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .single();

    if (fetchError || !invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Hämta kundens e-post
    const { data: customer } = await supabase
      .from("customers")
      .select("email, company_name, contact_person")
      .eq("id", invoice.customer_id)
      .single();

    if (!customer?.email) {
      return NextResponse.json({ error: "Customer email not found" }, { status: 400 });
    }

    // Skicka e-post via befintligt /api/sendEmail
    const subject = `Här kommer din faktura från oss - ${invoice.number}`;
    const text = `Hej ${customer.contact_person || "kund"},\n\nHär kommer din faktura ${invoice.number}.\nBelopp: ${invoice.total} kr\nFörfallodatum: ${invoice.due_date}\n\nLänk: ${invoice.pdf_url}`;

    const emailResponse = await fetch(`${req.nextUrl.origin}/api/sendEmail`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: customer.email,
        subject,
        text,
      }),
    });

    if (!emailResponse.ok) {
      return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
    }

    // Uppdatera status
    const { data: updatedInvoice, error: updateError } = await supabase
      .from("invoices")
      .update({ status: "sent" })
      .eq("id", invoiceId)
      .select()
      .single();

    if (updateError) {
      console.error("Update error:", updateError);
      return NextResponse.json({ error: "Failed to update invoice status" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, invoice: updatedInvoice });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
