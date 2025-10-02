import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildDocument } from "@/lib/pdf/buildDocument";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const { orderId } = params;
    
    if (!orderId) {
      return NextResponse.json({ error: "Order ID required" }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get order details
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (fetchError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Generate invoice number
    const currentYear = new Date().getFullYear();
    
    // Get next invoice number for this year
    const { data: lastInvoice } = await supabase
      .from('invoices')
      .select('number')
      .like('number', `F-${currentYear}-%`)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    let invoiceNumber = `F-${currentYear}-0001`;
    if (lastInvoice?.number) {
      const match = lastInvoice.number.match(/F-(\d+)-(\d+)/);
      if (match) {
        const year = parseInt(match[1]);
        const num = parseInt(match[2]);
        if (year === currentYear) {
          const newNum = String(num + 1).padStart(4, '0');
          invoiceNumber = `F-${currentYear}-${newNum}`;
        }
      }
    }

    // Calculate totals and VAT
    const totalSum = parseFloat(order.data.details.totalSum) || 0;
    const vatPercent = parseFloat(order.data.details.vatPercent) || 0;
    const vatTotal = totalSum * (vatPercent / 100);
    const netTotal = totalSum + vatTotal;

    // Calculate due date (30 days from creation)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    // Prepare document data for invoice
    const documentData = {
      customer: order.data.customer,
      details: {
        totalSum: totalSum.toString(),
        vatPercent: order.data.details.vatPercent,
        vatAmount: vatTotal.toString(),
        validityDays: order.data.details.validityDays,
        offerText: order.data.details.offerText,
      },
      number: invoiceNumber,
      dueDate: dueDate.toISOString().split('T')[0],
    };

    // Generate invoice PDF
    const pdfBuffer = await buildDocument({ type: "invoice", data: documentData });

    // Upload to Supabase Storage
    const fileName = `${currentYear}/${order.customer_id}/${invoiceNumber}.pdf`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(`invoices/${fileName}`, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (uploadError) {
      console.error('Supabase upload error:', uploadError);
      return NextResponse.json({ error: "Failed to upload PDF" }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('documents')
      .getPublicUrl(`invoices/${fileName}`);

    // Create invoice record
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        customer_id: order.customer_id,
        number: invoiceNumber,
        status: 'created',
        data: documentData,
        pdf_url: urlData.publicUrl,
        source_order_id: orderId,
        due_date: dueDate.toISOString().split('T')[0],
        total: netTotal,
        vat_total: vatTotal,
      })
      .select()
      .single();

    if (invoiceError) {
      console.error('Database error:', invoiceError);
      return NextResponse.json({ error: "Failed to create invoice" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, invoice });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

