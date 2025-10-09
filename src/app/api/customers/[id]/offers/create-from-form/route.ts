import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildDocument } from "@/lib/pdf/buildDocument";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: customerId } = params;
    const body = await request.json();
    
    if (!customerId) {
      return NextResponse.json({ error: "Customer ID required" }, { status: 400 });
    }

    // Generate offer number
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const currentYear = new Date().getFullYear();
    
    // Get next offer number for this year
    const { data: lastOffer } = await supabase
      .from('offers')
      .select('number')
      .like('number', `O-${currentYear}-%`)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    let offerNumber = `O-${currentYear}-0001`;
    if (lastOffer?.number) {
      const match = lastOffer.number.match(/O-(\d+)-(\d+)/);
      if (match) {
        const year = parseInt(match[1]);
        const num = parseInt(match[2]);
        if (year === currentYear) {
          const newNum = String(num + 1).padStart(4, '0');
          offerNumber = `O-${currentYear}-${newNum}`;
        }
      }
    }

    // Prepare document data
    const documentData = {
      customer: {
        companyName: body.companyName || '',
        contactPerson: body.contactPerson || '',
        email: body.email || '',
        phone: body.phone || '',
        address: body.address || '',
        zip: body.zip || '',
        city: body.city || '',
        orgNr: body.orgNr || '',
      },
      details: {
        totalSum: body.totalSum || '',
        vatPercent: body.vatPercent || '',
        vatAmount: body.vatAmount || '',
        validityDays: body.validityDays || '',
        offerText: body.offerText || '',
      },
      number: offerNumber,
    };

    // Generate PDF
    const pdfBuffer = await buildDocument({ type: "offer", data: documentData });

    // Upload to Supabase Storage
    const fileName = `${currentYear}/${customerId}/${offerNumber}.pdf`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(`offers/${fileName}`, pdfBuffer, {
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
      .getPublicUrl(`offers/${fileName}`);

    // Create offer record
    const { data: offer, error } = await supabase
      .from('offers')
      .insert({
        customer_id: customerId,
        number: offerNumber,
        status: 'draft',
        data: documentData,
        pdf_url: urlData.publicUrl,
      })
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: "Failed to create offer" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, offer });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

