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

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Hämta fakturan
    const { data: invoice, error: fetchError } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .single();

    if (fetchError || !invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Verify user owns this invoice
    if (invoice.user_id !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Hämta kundens e-post
    const { data: customer } = await supabase
      .from("customers")
      .select("email, name AS company_name, contact_person")
      .eq("id", invoice.customer_id)
      .single();

    if (!customer?.email) {
      return NextResponse.json({ error: "Customer email not found" }, { status: 400 });
    }

    // Format invoice total
    const totalFormatted = new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK'
    }).format(invoice.total);

    // Skicka e-post via befintligt /api/sendEmail
    const subject = `Faktura ${invoice.number} från ${customer.company_name || 'oss'}`;
    const text = `Hej ${customer.contact_person || customer.company_name || "kund"},\n\nHär kommer din faktura ${invoice.number}.\n\nBelopp: ${totalFormatted}\nFörfallodatum: ${invoice.due_date}\n\nDu hittar fakturan här: ${invoice.pdf_url}\n\nMed vänliga hälsningar`;

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
      const emailError = await emailResponse.text();
      console.error("Email send error:", emailError);
      return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
    }

    // Uppdatera status och sent_at
    const now = new Date().toISOString();
    const { data: updatedInvoice, error: updateError } = await supabase
      .from("invoices")
      .update({
        status: "sent",
        sent_at: now,
      })
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
