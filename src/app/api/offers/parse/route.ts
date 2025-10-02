export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { extractOfferFields } from "@/utils/extractOfferFields";
import pdf from 'pdf-parse';

function supa() {
  const jar = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (n) => jar.get(n)?.value,
        set: (n, v, o) => jar.set({ name: n, value: v, ...o }),
        remove: (n, o) => jar.set({ name: n, value: "", ...o, expires: new Date(0) }),
      },
    }
  );
}

async function extractTextFromPDF(pdfBuffer: ArrayBuffer): Promise<string> {
  try {
    const data = await pdf(Buffer.from(pdfBuffer));
    return data.text;
  } catch (err) {
    console.warn("PDF text extraction failed:", err);
    return "";
  }
}

export async function POST(req: Request) {
  try {
    const { bucket, path } = await req.json();
    
    if (!bucket || !path) {
      return new Response('Missing bucket or path', { status: 400 });
    }

    const supabase = supa();

    // Download PDF from Storage
    const { data: pdfFile, error: downloadError } = await supabase.storage
      .from(bucket)
      .download(path);

    if (downloadError || !pdfFile) {
      return new Response('Failed to download PDF from storage', { status: 500 });
    }

    // Extract text from PDF
    const pdfBuffer = await pdfFile.arrayBuffer();
    const text = await extractTextFromPDF(pdfBuffer);

    if (!text || text.trim().length === 0) {
      return new Response('No text found in PDF (scanned image?)', { status: 400 });
    }

    // Parse offer fields using the comprehensive parser
    const extracted = extractOfferFields(text);

    // Transform to match frontend expectations
    const customer = {
      companyName: extracted.companyName,
      contactPerson: extracted.contactPerson,
      email: extracted.email,
      phone: extracted.phone,
      address: extracted.address,
      zip: extracted.zip,
      city: extracted.city,
      orgNr: extracted.orgNr,
      country: extracted.country,
    };

    // Transform items to match frontend format
    const lines = extracted.items?.map(item => ({
      text: item.name,
      qty: item.hours ? parseFloat(item.hours) : 1,
      price: item.pricePerHour ? parseFloat(item.pricePerHour.replace(/[^\d.-]/g, '')) : 0,
      amount: item.total ? parseFloat(item.total.replace(/[^\d.-]/g, '')) : 0,
    })) || [];

    const totals = {
      net: extracted.total ? parseFloat(extracted.total.replace(/[^\d.-]/g, '')) : 0,
      vat: extracted.vat ? parseFloat(extracted.vat) : 25,
      gross: extracted.vatAmount ? parseFloat(extracted.vatAmount.replace(/[^\d.-]/g, '')) : 0,
    };

    return Response.json({
      customer,
      lines,
      totals,
      metadata: {
        offerNumber: extracted.offerNumber,
        date: extracted.date,
        validity: extracted.validity,
        notes: extracted.notes,
      }
    });

  } catch (error) {
    console.error('Offer parsing error:', error);
    return new Response(`Server error: ${error instanceof Error ? error.message : String(error)}`, { status: 500 });
  }
}
