import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import crypto from "crypto";

export const runtime = "nodejs";

type GPTOfferBody = {
  customerId: string;
  jsonData: any;  // JSON-delen med kund- och offertfält
  textData: string;  // Text-delen med offertlayouten
};

function bad(msg: string, code = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status: code });
}

async function createPdfFromText(textData: string): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const marginX = 50;
  let y = 800;

  const draw = (text: string, bold = false, size = 12, color = rgb(0, 0, 0)) => {
    const usedFont = bold ? fontBold : font;
    page.drawText(String(text), { x: marginX, y, size, font: usedFont, color });
    y -= size + 8;
  };

  // Dela texten i rader och rita dem
  const lines = textData.split('\n');
  for (const line of lines) {
    if (y < 60) break; // Slut på sidan
    
    // Hantera specialformatering
    if (line.includes('OFFERT') && line.length < 20) {
      draw(line, true, 20);
    } else if (line.includes('🧾') || line.includes('📄')) {
      draw(line, true, 14);
    } else if (line.includes('---') || line.includes('===')) {
      // Ignorera separatorer
      y -= 4;
    } else {
      draw(line, false, 11);
    }
  }

  return pdfDoc.save();
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as GPTOfferBody;
    const { customerId, jsonData, textData } = body;

    // 1) Minikrav
    if (!customerId || !jsonData || !textData) {
      return bad("Missing customerId, jsonData, or textData");
    }

    // 2) Upsert kund i public.customers
    try {
      const kund = jsonData.kund || {};
      const customerPayload = {
        id: customerId,
        name: kund.namn || null,
        orgnr: kund.orgnr || null,
        email: kund.epost || null,
        phone: kund.telefon || null,
        address: kund.adress || null,
        zip: kund.postnummer || null,
        city: kund.ort || null,
        country: kund.land || "Sverige"
      };

      const { error: custErr } = await supabaseAdmin
        .from("customers")
        .upsert(customerPayload, { onConflict: "id" });
      
      if (custErr) {
        console.warn("customers upsert failed:", custErr.message);
      }
    } catch (e: any) {
      console.warn("customers upsert exception:", e?.message || e);
    }

    // 3) Skapa PDF från text
    const pdfBytes = await createPdfFromText(textData);

    // 4) Storage-path
    const offerId = crypto.randomUUID();
    const storageBucket = "paperflow-files";
    const storagePath = `customers/${customerId}/offers/${offerId}.pdf`;

    // 5) Upload PDF
    const { error: upErr } = await supabaseAdmin.storage
      .from(storageBucket)
      .upload(storagePath, pdfBytes, { contentType: "application/pdf", upsert: true });
    
    if (upErr) return bad(`Storage upload failed: ${upErr.message}`, 500);

    // 6) Public URL
    const { data: pub } = supabaseAdmin.storage.from(storageBucket).getPublicUrl(storagePath);
    const file_url = pub?.publicUrl;
    if (!file_url) return bad("Could not generate public URL", 500);

    // 7) Spara i DB
    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("offers")
      .insert({
        id: offerId,
        customer_id: customerId,
        title: jsonData.titel || "GPT-genererad offert",
        amount: jsonData.summa || 0,
        currency: jsonData.valuta || "SEK",
        file_url,
        needs_print: false,
        status: null,
        data_json: JSON.stringify(jsonData)
      })
      .select()
      .single();
    
    if (insErr) return bad(`DB insert failed: ${insErr.message}`, 500);

    // 8) Svar
    return NextResponse.json(
      { 
        ok: true, 
        offer: inserted,
        pdfUrl: file_url,
        textPreview: textData.substring(0, 200) + "..." // Förhandsgranskning
      },
      { status: 200 }
    );
  } catch (e: any) {
    return bad(e?.message ?? "Unknown error", 500);
  }
}
