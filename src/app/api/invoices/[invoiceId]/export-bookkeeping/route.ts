import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { exportInvoiceToBookkeeping } from "@/lib/bookkeeping";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(
  request: NextRequest,
  { params }: { params: { invoiceId: string } }
) {
  try {
    const { invoiceId } = params;
    
    if (!invoiceId) {
      return NextResponse.json({ error: "Invoice ID required" }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get invoice details
    const { data: invoice, error: fetchError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single();

    if (fetchError || !invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Get customer details
    const { data: customer } = await supabase
      .from('customers')
      .select('company_name, contact_person')
      .eq('id', invoice.customer_id)
      .single();

    const invoiceData = {
      id: invoice.id,
      number: invoice.number,
      customer_name: customer?.company_name || '',
      contact_person: customer?.contact_person || '',
      total: invoice.total,
      vat_total: invoice.vat_total,
      due_date: invoice.due_date,
      pdf_url: invoice.pdf_url,
      data: invoice.data,
    };

    // Export to bookkeeping
    const exportResult = await exportInvoiceToBookkeeping(invoiceData);

    if (!exportResult.ok) {
      return NextResponse.json({ error: "Failed to export to bookkeeping" }, { status: 500 });
    }

    // Update invoice status
    const { data: updatedInvoice, error: updateError } = await supabase
      .from('invoices')
      .update({ status: 'exported' })
      .eq('id', invoiceId)
      .select()
      .single();

    if (updateError) {
      console.error('Update error:', updateError);
      return NextResponse.json({ error: "Failed to update invoice status" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, invoice: updatedInvoice });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
