import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import crypto from "crypto";

export const runtime = "nodejs";

type ExtractAndParseBody = {
  pdfBase64: string;
  customerId: string;
};

function bad(msg: string, code = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status: code });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ExtractAndParseBody;
    const { pdfBase64, customerId } = body;

    if (!pdfBase64 || !customerId) {
      return bad("Missing pdfBase64 or customerId");
    }

    // 1. Extrahera text från PDF (simulera för nu - i riktig app skulle du använda pdf-parse)
    const extractedText = await extractTextFromPDF(pdfBase64);

    if (!extractedText || extractedText.trim().length === 0) {
      return bad("No text found in PDF");
    }

    // 2. Skicka till GPT för att få strukturerade uppgifter
    const gptResponse = await fetch(`${req.nextUrl.origin}/api/gpt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: "passthrough",
        messages: [
          {
            role: "user",
            content: `Extrahera följande uppgifter från denna offert-text och returnera som JSON:

{
  "customerName": "företagsnamn",
  "orgNr": "organisationsnummer",
  "address": "adress",
  "email": "e-postadress", 
  "phone": "telefonnummer",
  "offerTitle": "offerttitel",
  "amount": belopp_som_nummer,
  "currency": "valuta"
}

Offert-text:
${extractedText}`
          }
        ],
        systemPrompt: "Du är en expert på att extrahera strukturerad information från offerter. Returnera endast giltig JSON utan ytterligare text."
      })
    });

    if (!gptResponse.ok) {
      throw new Error('GPT API failed');
    }

    const gptData = await gptResponse.json();
    let parsedData;
    
    try {
      parsedData = JSON.parse(gptData.text);
    } catch {
      // Fallback parsing om GPT inte returnerade ren JSON
      parsedData = {
        customerName: "",
        orgNr: "",
        address: "",
        email: "",
        phone: "",
        offerTitle: "",
        amount: 0,
        currency: "SEK"
      };
    }

    // 3. Spara i Supabase offers tabellen
    const offerId = crypto.randomUUID();
    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("offers")
      .insert({
        id: offerId,
        customer_id: customerId,
        title: parsedData.offerTitle || "Offert från PDF",
        amount: parsedData.amount || 0,
        currency: parsedData.currency || "SEK",
        needs_print: false,
        data_json: JSON.stringify({
          extractedText,
          parsedData,
          source: "pdf_upload"
        })
      })
      .select()
      .single();

    if (insErr) {
      console.error("Supabase insert error:", insErr);
      return bad(`Failed to save offer: ${insErr.message}`, 500);
    }

    return NextResponse.json({ 
      ok: true, 
      offer: inserted,
      parsedData 
    }, { status: 200 });

  } catch (e: any) {
    console.error("PDF extract and parse error:", e);
    return bad(e?.message ?? "Unknown error", 500);
  }
}

async function extractTextFromPDF(pdfBase64: string): Promise<string> {
  // Simulera PDF-text extraktion
  // I en riktig app skulle du använda pdf-parse eller liknande
  return `OFFERT

Kund: Test Företag AB
Org.nr: 556123-4567
Adress: Testgatan 123, 123 45 Stockholm
E-post: info@testforetag.se
Telefon: 08-123 45 67

Offerttitel: Webbutveckling
Belopp: 50000 SEK

Detaljer:
- Systemutveckling: 40 timmar
- Design: 20 timmar
- Testning: 10 timmar

Totalsumma: 50000 SEK exkl. moms`;
}
