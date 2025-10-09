export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { extractOfferFields } from '@/utils/extractOfferFields';

async function supa() {
  const jar = await cookies(); // <-- måste awaitas i Next 15
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (n) => jar.get(n)?.value,
        set: (n, v, o) => jar.set({ name: n, value: v, ...o }),
        remove: (n, o) =>
          jar.set({ name: n, value: '', ...o, expires: new Date(0) }),
      },
    }
  );
}

// Ladda pdf-parse dynamiskt så att Next inte bundlar deras testfil
async function extractTextFromPDF(pdfBuffer: ArrayBuffer): Promise<string> {
  try {
    const { default: pdf }: any = await import('pdf-parse');
    const data = await pdf(Buffer.from(pdfBuffer));
    return data.text || '';
  } catch (err) {
    console.warn('[offers/parse] PDF text extraction failed:', err);
    return '';
  }
}

function bad(where: string, message: string, status = 400) {
  console.error(`[offers/parse][${where}]`, message);
  return Response.json({ ok: false, where, message }, { status });
}

export async function POST(req: Request) {
  try {
    const { bucket, path } = await req.json();

    if (!bucket || !path) {
      return bad('validate', 'Missing bucket or path', 400);
    }

    const supabase = await supa();

    // 1) Ladda ner PDF från Storage
    const { data: pdfFile, error: downloadError } = await supabase.storage
      .from(bucket)
      .download(path);

    if (downloadError || !pdfFile) {
      return bad(
        'download',
        downloadError?.message || 'Failed to download PDF from storage',
        500
      );
    }

    // 2) Extrahera text
    const pdfBuffer = await pdfFile.arrayBuffer();
    const text = await extractTextFromPDF(pdfBuffer);

    if (!text.trim()) {
      return bad('extract', 'No text found in PDF (scanned image?)', 400);
    }

    // 3) Tolka fält
    const extracted = extractOfferFields(text);

    // 4) Mappa till frontendens format
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

    const lines =
      extracted.items?.map((item) => ({
        text: item.name,
        qty: item.hours ? parseFloat(item.hours) : 1,
        price: item.pricePerHour
          ? parseFloat(item.pricePerHour.replace(/[^\d.-]/g, ''))
          : 0,
        amount: item.total
          ? parseFloat(item.total.replace(/[^\d.-]/g, ''))
          : 0,
      })) || [];

    const totals = {
      net: extracted.total
        ? parseFloat(extracted.total.replace(/[^\d.-]/g, ''))
        : 0,
      vat: extracted.vat ? parseFloat(extracted.vat) : 25,
      gross: extracted.vatAmount
        ? parseFloat(extracted.vatAmount.replace(/[^\d.-]/g, ''))
        : 0,
    };

    const metadata = {
      offerNumber: extracted.offerNumber,
      date: extracted.date,
      validity: extracted.validity,
      notes: extracted.notes,
    };

    return Response.json(
      { ok: true, parsed: { customer, lines, totals, metadata } },
      { status: 200 }
    );
  } catch (error) {
    console.error('[offers/parse] Server error:', error);
    return Response.json(
      {
        ok: false,
        where: 'exception',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
