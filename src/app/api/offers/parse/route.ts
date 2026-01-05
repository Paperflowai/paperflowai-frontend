import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import pdfParse from "pdf-parse";

export const runtime = "nodejs";

// Hjälpfunktioner för att extrahera fält från text
const monthNames = [
  "januari", "februari", "mars", "april", "maj", "juni",
  "juli", "augusti", "september", "oktober", "november", "december",
];

function looksLikeDate(text: string): boolean {
  if (!text) return false;
  const t = text.trim().toLowerCase();

  // Format: 2026-01-03
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return true;

  // Format: 3 januari 2026
  if (/^\d{1,2}\s+(januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december)\s+\d{4}$/.test(t)) {
    return true;
  }

  // Om texten innehåller en månad + år → troligt datum
  if (monthNames.some((m) => t.includes(m)) && /\d{4}/.test(t)) {
    return true;
  }

  return false;
}

function cleanText(value: any): string | null {
  if (value === null || value === undefined) return null;
  const t = String(value).trim();
  if (!t) return null;

  // Filtrera bort datum
  if (looksLikeDate(t)) {
    return null;
  }

  return t;
}

// Extrahera fält från PDF-text
function parseFieldsFromText(text: string) {
  const lines = text.split('\n').map(l => l.trim());

  const customer: any = {};
  const metadata: any = {};
  const totals: any = {};

  // Sök efter företagsnamn (undvik rader som börjar med "Kund:" eller "Företag:")
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Företagsnamn (ofta på egen rad, inte ett datum)
    if (line && !looksLikeDate(line) && line.length > 2 && line.length < 60) {
      // Kolla om det ser ut som ett företagsnamn (innehåller bokstäver men inte "Offert", "Datum" etc)
      if (!/^(offert|datum|kund|företag|org\.?nr|kontakt|adress|telefon|e-?post|summa|moms|total):/i.test(line)) {
        // Om vi inte redan har ett namn och denna rad inte är ett vanligt label
        if (!customer.namn && !/^\d+$/.test(line) && line.split(' ').length <= 5) {
          const cleaned = cleanText(line);
          if (cleaned && cleaned !== 'OFFERT') {
            customer.namn = cleaned;
          }
        }
      }
    }

    // Org.nr
    if (/org\.?\s*nr|organisationsnummer/i.test(line)) {
      const match = line.match(/(\d{6}[-\s]?\d{4})/);
      if (match) customer.orgnr = match[1].replace(/\s/g, '');
    }

    // Kontaktperson
    if (/kontaktperson|contact\s*person/i.test(line)) {
      const match = line.match(/:\s*(.+)$/);
      if (match) {
        const cleaned = cleanText(match[1]);
        if (cleaned) customer.kontaktperson = cleaned;
      }
    }

    // E-post
    if (/e-?post|email/i.test(line)) {
      const match = line.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      if (match) customer.epost = match[1];
    }

    // Telefon
    if (/telefon|phone|tel/i.test(line)) {
      const match = line.match(/(\+?\d[\d\s\-()]{7,})/);
      if (match) customer.telefon = match[1].trim();
    }

    // Adress
    if (/^adress|address/i.test(line)) {
      const match = line.match(/:\s*(.+)$/);
      if (match) {
        const cleaned = cleanText(match[1]);
        if (cleaned) customer.adress = cleaned;
      }
    }

    // Postnummer och ort
    if (/postnummer|postal\s*code|zip/i.test(line)) {
      const match = line.match(/(\d{3}\s?\d{2})/);
      if (match) customer.postnummer = match[1];
    }

    if (/^ort|city/i.test(line)) {
      const match = line.match(/:\s*(.+)$/);
      if (match) {
        const cleaned = cleanText(match[1]);
        if (cleaned) customer.ort = cleaned;
      }
    }

    // Land
    if (/^land|country/i.test(line)) {
      const match = line.match(/:\s*(.+)$/);
      if (match) {
        const cleaned = cleanText(match[1]);
        if (cleaned) customer.land = cleaned;
      }
    }

    // Offertnummer
    if (/offert.*nummer|offer.*number/i.test(line)) {
      const match = line.match(/(OFF-\d{4}-\d{4}|\d+)/);
      if (match) metadata.offerNumber = match[1];
    }

    // Datum
    if (/^datum|^date/i.test(line)) {
      const match = line.match(/:\s*(.+)$/);
      if (match) {
        const dateStr = match[1].trim();
        // Försök konvertera till ISO-format
        metadata.date = dateStr;
      }
    }

    // Giltighetstid
    if (/giltighet|validity|giltig\s+i/i.test(line)) {
      const match = line.match(/(\d+)\s*dagar/i);
      if (match) metadata.validity = parseInt(match[1]);
    }

    // Totalsumma
    if (/totalsumma|total|summa/i.test(line) && /\d/.test(line)) {
      const match = line.match(/(\d[\d\s]*)/);
      if (match) {
        const amount = match[1].replace(/\s/g, '');
        totals.net = parseInt(amount);
      }
    }

    // Moms
    if (/moms|vat/i.test(line) && /\d/.test(line)) {
      const percentMatch = line.match(/(\d+)\s*%/);
      if (percentMatch) {
        totals.vatPercent = parseInt(percentMatch[1]);
      }

      const amountMatch = line.match(/(\d[\d\s]+)\s*SEK/);
      if (amountMatch) {
        totals.vatAmount = parseInt(amountMatch[1].replace(/\s/g, ''));
      }
    }
  }

  // Beräkna brutto om vi har netto och moms
  if (totals.net && totals.vatAmount) {
    totals.gross = totals.net + totals.vatAmount;
  }

  return { customer, metadata, totals };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { bucket, path } = body;

    if (!bucket || !path) {
      return NextResponse.json(
        { ok: false, error: "Missing bucket or path" },
        { status: 400 }
      );
    }

    // Ladda ner PDF från Supabase Storage
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from(bucket)
      .download(path);

    if (downloadError || !fileData) {
      console.error("[parse] Download error:", downloadError);
      return NextResponse.json(
        { ok: false, error: "Could not download PDF" },
        { status: 500 }
      );
    }

    // Konvertera blob till buffer
    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extrahera text från PDF
    let pdfData;
    try {
      pdfData = await pdfParse(buffer);
    } catch (parseError) {
      console.error("[parse] PDF parse error:", parseError);
      return NextResponse.json(
        { ok: false, error: "Could not parse PDF" },
        { status: 500 }
      );
    }

    const text = pdfData.text;
    console.log("[parse] Extracted text length:", text.length);

    // Parsa fält från texten
    const parsed = parseFieldsFromText(text);

    console.log("[parse] Parsed data:", JSON.stringify(parsed, null, 2));

    return NextResponse.json({
      ok: true,
      parsed,
      rawText: text, // Inkludera för debugging
    });
  } catch (error) {
    console.error("[parse] Error:", error);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
