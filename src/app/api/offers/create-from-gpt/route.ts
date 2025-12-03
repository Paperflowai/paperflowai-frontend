import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import crypto from "crypto";
import { buildDocument } from "@/lib/pdf/buildDocument";
import { extractOfferFields } from "@/utils/extractOfferFields";

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

    // ============ EXTRAHERA KUNDDATA ============
    // 1) Från textData med extractOfferFields
    const extracted = extractOfferFields(textData || "");
    console.log("[create-from-gpt] extracted:", extracted);

    // 2) Merga jsonData.kund och extractOfferFields (jsonData prioriteras)
    const companyName =
      kund.namn ||
      kund.name ||
      kund.foretag ||
      safeJson.kundnamn ||
      extracted.companyName ||
      extractCustomerNameFromText(textData || "") ||
      "Ny kund";

    const contactPerson =
      kund.kontaktperson ||
      kund.contactPerson ||
      extracted.contactPerson ||
      null;

    const email =
      kund.epost ||
      kund.email ||
      extracted.email ||
      null;

    const phone =
      kund.telefon ||
      kund.phone ||
      extracted.phone ||
      null;

    const address =
      kund.adress ||
      kund.address ||
      extracted.address ||
      null;

    const zip =
      kund.postnummer ||
      kund.zip ||
      extracted.zip ||
      null;

    const city =
      kund.ort ||
      kund.city ||
      extracted.city ||
      null;

    const orgNr =
      kund.orgnr ||
      kund.org_nr ||
      extracted.orgNr ||
      null;

    const country =
      kund.land ||
      kund.country ||
      extracted.country ||
      "Sverige";

    const customerNumber =
      extracted.offerNumber ||
      safeJson.offertnummer ||
      null;

    const contactDate =
      extracted.date ||
      safeJson.datum ||
      null;

    // 3) Sätt kund-ID
    if (!customerId) {
      // Ny kund → skapa id
      customerId = crypto.randomUUID();
      console.log("[create-from-gpt] Creating new customer:", customerId);
    } else {
      console.log("[create-from-gpt] Updating existing customer:", customerId);
    }

    // 4) Upsert i public.customers (gamla strukturen)
    const customerRow = {
      id: customerId,
      name: companyName ?? "Ny kund",   // OBS: name, inte company_name
      orgnr: orgNr ?? null,            // OBS: orgnr, inte org_nr
      email: email ?? null,
      phone: phone ?? null,
      address: address ?? null,
      zip: zip ?? null,
      city: city ?? null,
      country: country ?? "Sverige",
      updated_at: new Date().toISOString(),
    };

    console.log("[create-from-gpt] customerRow:", customerRow);

    const { error: customerError } = await supabaseAdmin
      .from("customers")
      .upsert(customerRow, { onConflict: "id" });

    if (customerError) {
      console.error("[create-from-gpt] Customer upsert error:", customerError);
      return bad("Customer upsert failed: " + customerError.message, 500);
    }

    console.log("[create-from-gpt] ✅ Customer data saved:", {
      customerId,
      companyName,
      email,
    });

    // 5) Upsert i public.customer_cards
    const customerDataCards = {
      customer_id: customerId,
      name: companyName ?? "Ny kund",
      orgnr: orgNr ?? null,
      email: email ?? null,
      phone: phone ?? null,
      address: address ?? null,
    };

    const { error: cardsError } = await supabaseAdmin
      .from("customer_cards")
      .upsert(customerDataCards, { onConflict: "customer_id" });

    if (cardsError) {
      console.warn("[create-from-gpt] customer_cards upsert warning:", cardsError.message);
      // Fortsätt ändå - customer_cards är inte kritisk
    } else {
      console.log("[create-from-gpt] ✅ Customer cards saved");
    }

    // 6) Generera PDF
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

    // 7) Lagra PDF i Storage
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

    // 8) Spara rad i documents
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

    // 9) Spara själva offerten i offers-tabellen, inklusive file_url
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
        // ✅ Inkludera customerData för autofyll på frontend
        customerData: {
          companyName,
          orgNr,
          contactPerson,
          email,
          phone,
          address,
          zip,
          city,
          country,
          customerNumber,
          contactDate,
        },
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("create-from-gpt error:", e);
    return bad(e?.message || "Unknown error", 500);
  }
}
