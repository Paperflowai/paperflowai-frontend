import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import crypto from "crypto";
import { buildDocument } from "@/lib/pdf/buildDocument";

export const runtime = "nodejs";

type GPTOfferBody = {
  customerId?: string;      // kan saknas vid ny kund
  jsonData?: any;
  textData: string;
};

function bad(msg: string, code = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status: code });
}

// Försök plocka ut kundnamn ur offerttexten om jsonData inte innehåller namn
function extractCustomerNameFromText(text: string): string | null {
  if (!text) return null;

  // Försök hitta rad efter "Till:"
  const tillIndex = text.indexOf("Till:");
  if (tillIndex !== -1) {
    const afterTill = text.slice(tillIndex + "Till:".length);
    const lines = afterTill.split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length > 0) {
      // t.ex. "Testkunden GPT AB"
      return lines[0];
    }
  }

  // Annars: leta efter en rad som slutar på AB / HB / KB / Aktiebolag
  const lines = text.split("\n").map(l => l.trim());
  for (const line of lines) {
    if (!line) continue;
    if (/(AB|HB|KB|Aktiebolag)\b/.test(line)) {
      return line;
    }
  }

  return null;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as GPTOfferBody;
    let { customerId, jsonData, textData } = body;

    if (!textData) {
      return bad("Missing textData");
    }

    const safeJson = jsonData || {};
    const kund = safeJson.kund || safeJson.customer || {};

    // Försök hitta kundnamn i jsonData eller texten
    const extractedNameFromText = extractCustomerNameFromText(textData || "");
    const kundNamn =
      kund.namn ||
      kund.name ||
      safeJson.kundnamn ||
      extractedNameFromText ||
      "Ny kund";

    // 1) Sätt kund-ID
    if (!customerId) {
      // Ny kund → skapa id
      customerId = crypto.randomUUID();
    }

    // 2) Upsert i public.customers (det är den dashboarden läser från)
    await supabaseAdmin.from("customers").upsert(
      {
        id: customerId,
        name: kundNamn,
        orgnr: kund.orgnr || kund.orgnr || null,
        email: kund.epost || kund.email || null,
        phone: kund.telefon || kund.phone || null,
        address: kund.adress || kund.address || null,
        zip: kund.postnummer || kund.zip || null,
        city: kund.ort || kund.city || null,
        country: kund.land || kund.country || "Sverige",
      },
      { onConflict: "id" }
    );

    // 3) Spegla till public.customer_cards (för framtida logik)
    await supabaseAdmin.from("customer_cards").upsert(
      {
        customer_id: customerId,
        name: kundNamn,
        orgnr: kund.orgnr || null,
        email: kund.epost || kund.email || null,
        phone: kund.telefon || kund.phone || null,
        address: kund.adress || kund.address || null,
      },
      { onConflict: "customer_id" }
    );

    // 4) Generera PDF
    const pdfBytes = await buildDocument(
      {
        customerId,
        title: safeJson.titel || "Offert",
        amount: safeJson.summa || 0,
        currency: safeJson.valuta || "SEK",
        needsPrint: false,
        data: { textData },
      },
      "offer"
    );

    // 5) Lagra PDF i Storage
    const docId = crypto.randomUUID();
    const bucket = "paperflow-files";
    const storagePath = `documents/${customerId}/offers/${docId}.pdf`;

    const { error: upErr } = await supabaseAdmin.storage
      .from(bucket)
      .upload(storagePath, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (upErr) {
      return bad("Upload failed: " + upErr.message, 500);
    }

    const { data: pub } = supabaseAdmin.storage
      .from(bucket)
      .getPublicUrl(storagePath);

    if (!pub?.publicUrl) {
      return bad("Could not generate public URL", 500);
    }

    // 6) Spara rad i documents
    const { data: docRow, error: docErr } = await supabaseAdmin
      .from("documents")
      .insert({
        id: docId,
        customer_id: customerId,
        doc_type: "offer",
        type: "offer",
        filename: safeJson.titel || "Offert",
        storage_path: storagePath,
        file_url: pub.publicUrl,
        bucket,
        bucket_name: bucket,
        status: "created",
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (docErr) {
      return bad("Insert failed: " + docErr.message, 500);
    }

    // 7) Spara själva offerten i offers-tabellen, inklusive file_url
    const { data: offerRow, error: offerErr } = await supabaseAdmin
      .from("offers")
      .insert({
        customer_id: customerId,
        status: "created",
        data: safeJson,
        created_at: new Date().toISOString(),
        currency: safeJson.valuta || "SEK",
        amount: safeJson.summa || null,
        file_url: pub.publicUrl,
        needs_print: false,
        payload: { textData },
      })
      .select("id")
      .single();

    if (offerErr) {
      return bad("Offer insert failed: " + offerErr.message, 500);
    }

    return NextResponse.json(
      {
        ok: true,
        customerId,
        documentId: docRow.id,
        offerId: offerRow.id,
        pdfUrl: pub.publicUrl,
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("create-from-gpt error:", e);
    return bad(e?.message || "Unknown error", 500);
  }
}
