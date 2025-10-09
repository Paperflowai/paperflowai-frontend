import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

    // Get customer details for email
    const { data: customer } = await supabase
      .from('customers')
      .select('email, company_name, contact_person')
      .eq('id', offer.customer_id)
      .single();

    if (!customer?.email) {
      return NextResponse.json({ error: "Customer email not found" }, { status: 400 });
    }

    // Send email using existing sendEmail API
    const subject = `Här kommer din offert från oss - ${offer.number}`;
    const text = `Hej ${customer.contact_person || 'kund'},\n\nHär kommer din offert ${offer.number}.\n\nLänk: ${offer.pdf_url}`;

    const emailResponse = await fetch(`${request.nextUrl.origin}/api/sendEmail`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        to: customer.email, 
        subject, 
        text 
      }),
    });

    if (!emailResponse.ok) {
      return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
    }

    // Update offer status
    const { data: updatedOffer, error: updateError } = await supabase
      .from('offers')
      .update({ status: 'sent' })
      .eq('id', offerId)
      .select()
      .single();

    if (updateError) {
      console.error('Update error:', updateError);
      return NextResponse.json({ error: "Failed to update offer status" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, offer: updatedOffer });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

