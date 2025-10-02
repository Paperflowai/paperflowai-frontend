import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { buildDocument } from '@/lib/pdf/buildDocument';

type OrderConfirmationBody = {
  offerId: string;
  customerId: string;
};

function bad(msg: string, code = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status: code });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as OrderConfirmationBody;
    if (!body?.offerId) return bad("Missing offerId");
    if (!body?.customerId) return bad("Missing customerId");

    // Hämta offertdata från databasen
    const { data: offer, error: offerError } = await supabaseAdmin
      .from("offers")
      .select("*")
      .eq("id", body.offerId)
      .eq("customer_id", body.customerId)
      .single();

    if (offerError || !offer) {
      return bad("Offert not found", 404);
    }

    // Hämta kunddata från databasen
    const { data: customer, error: customerError } = await supabaseAdmin
      .from("customers")
      .select("*")
      .eq("id", body.customerId)
      .single();

    if (customerError || !customer) {
      return bad("Customer not found", 404);
    }

    // Skapa PDF för orderbekräftelse med gemensam mall
    
    const orderData = {
      customerId: body.customerId,
      title: 'Orderbekräftelse',
      amount: offer.amount || 0,
      currency: offer.currency || 'SEK',
      needsPrint: false,
      data: { 
        offerId: body.offerId,
        customerName: customer.companyName || customer.name,
        orderNumber: 'ORD-' + Date.now(),
        items: offer.data?.items || [],
        totalAmount: offer.amount || 0,
        deliveryDate: offer.data?.deliveryDate,
        deliveryAddress: customer.address,
        paymentTerms: offer.data?.paymentTerms || '30 dagar netto',
        phone: customer.phone,
        email: customer.email
      }
    };
    
    const pdfBytes = await buildDocument(orderData, 'orderConfirmation');

    // Ladda upp till Supabase Storage
    const bucket = "paperflow-files";
    const fileName = `order-confirmation-${body.offerId}.pdf`;
    const storagePath = `customers/${body.customerId}/orders/${fileName}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(bucket)
      .upload(storagePath, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      return bad(`Storage upload failed: ${uploadError.message}`, 500);
    }

    // Hämta public URL
    const { data: urlData } = supabaseAdmin.storage
      .from(bucket)
      .getPublicUrl(storagePath);

    // Uppdatera offertens status i databasen (lägg till status kolumn om den inte finns)
    const { error: updateError } = await supabaseAdmin
      .from("offers")
      .update({ status: "order_confirmed" })
      .eq("id", body.offerId)
      .eq("customer_id", body.customerId);

    if (updateError) {
      return bad(`Status update failed: ${updateError.message}`, 500);
    }

    return NextResponse.json(
      { 
        ok: true, 
        orderConfirmation: {
          id: `order-${body.offerId}`,
          file_url: urlData.publicUrl,
          created_at: new Date().toISOString(),
        }
      }, 
      { status: 200 }
    );
  } catch (e: any) {
    return bad(e?.message ?? "Unknown error", 500);
  }
}
