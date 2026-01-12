import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildDocument } from "@/lib/pdf/buildDocument";
import crypto from "crypto";

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

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get offer details
    const { data: offer, error: fetchError } = await supabase
      .from('offers')
      .select('*')
      .eq('id', offerId)
      .single();

    if (fetchError || !offer) {
      return NextResponse.json({ error: "Offer not found" }, { status: 404 });
    }

    // Get customer details from customers table
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('*')
      .eq('id', offer.customer_id)
      .single();

    if (customerError || !customer) {
      console.error('Customer fetch error:', customerError);
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
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

    // Calculate totals from offer data
    const totalSum = parseFloat(offer.data?.details?.totalSum || offer.amount || '0');
    const vatPercent = parseFloat(offer.data?.details?.vatPercent || '25');
    const vatTotal = totalSum * (vatPercent / 100);

    // Kopiera items från offert och sätt som godkända
    const offerItems = offer.data?.details?.items || offer.data?.items || [];
    const rows = offerItems.map((item: any) => ({
      id: item.id || crypto.randomUUID(),
      description: item.description || item.name || "",
      qty: parseFloat(item.qty || item.quantity || 0),
      price: parseFloat(item.price || item.unitPrice || 0),
      source: "offer",
      approved: true,
      approved_at: new Date().toISOString(),
    }));

    // Prepare document data for order with actual customer data from customers table
    const documentData = {
      customer: {
        companyName: customer.company_name,
        orgNr: customer.org_nr || customer.orgnr,
        contactPerson: customer.contact_person,
        role: customer.role,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        zip: customer.zip,
        city: customer.city,
        country: customer.country || "Sverige",
        customerNumber: customer.customer_number,
        contactDate: customer.contact_date,
      },
      details: offer.data?.details || offer.data || {},
      rows,
      number: orderNumber,
    };

    // Generate order PDF
    const pdfBuffer = await buildDocument({ type: "order", data: documentData });

    // Upload to Supabase Storage
    const fileName = `${currentYear}/${offer.customer_id}/${orderNumber}.pdf`;
    const storagePath = `orders/${fileName}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(storagePath, pdfBuffer, {
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
      .getPublicUrl(storagePath);

    // Create order record
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id: userId,
        customer_id: offer.customer_id,
        source_offer_id: offerId,
        number: orderNumber,
        status: 'created',
        data: documentData,
        pdf_url: urlData.publicUrl,
        storage_path: storagePath,
        bucket_name: 'documents',
        total: totalSum,
        vat_total: vatTotal,
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

