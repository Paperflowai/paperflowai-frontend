import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildDocument } from "@/lib/pdf/buildDocument";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(
  request: NextRequest,
  { params }: { params: { offerId: string } }
) {
  try {
    const { offerId } = params;
    
    if (!offerId) {
      return NextResponse.json({ error: "Offer ID required" }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get offer details
    const { data: offer, error: fetchError } = await supabase
      .from('offers')
      .select('*')
      .eq('id', offerId)
      .single();

    if (fetchError || !offer) {
      return NextResponse.json({ error: "Offer not found" }, { status: 404 });
    }

    // Generate order number
    const currentYear = new Date().getFullYear();
    
    // Get next order number for this year
    const { data: lastOrder } = await supabase
      .from('orders')
      .select('number')
      .like('number', `ORD-${currentYear}-%`)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    let orderNumber = `ORD-${currentYear}-0001`;
    if (lastOrder?.number) {
      const match = lastOrder.number.match(/ORD-(\d+)-(\d+)/);
      if (match) {
        const year = parseInt(match[1]);
        const num = parseInt(match[2]);
        if (year === currentYear) {
          const newNum = String(num + 1).padStart(4, '0');
          orderNumber = `ORD-${currentYear}-${newNum}`;
        }
      }
    }

    // Prepare document data for order
    const documentData = {
      customer: offer.data.customer,
      details: offer.data.details,
      number: orderNumber,
    };

    // Generate order PDF
    const pdfBuffer = await buildDocument({ type: "order", data: documentData });

    // Upload to Supabase Storage
    const fileName = `${currentYear}/${offer.customer_id}/${orderNumber}.pdf`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(`orders/${fileName}`, pdfBuffer, {
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
      .getPublicUrl(`orders/${fileName}`);

    // Create order record
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        customer_id: offer.customer_id,
        number: orderNumber,
        status: 'created',
        data: documentData,
        pdf_url: urlData.publicUrl,
        source_offer_id: offerId,
      })
      .select()
      .single();

    if (orderError) {
      console.error('Database error:', orderError);
      return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, order });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

