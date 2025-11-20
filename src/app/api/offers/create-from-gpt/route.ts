import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import crypto from "crypto";
import { buildDocument } from "@/lib/pdf/buildDocument";

export const runtime = "nodejs";

type GPTOfferBody = {
  customerId: string;
  jsonData?: any;     // nu valfritt
  textData: string;
};

function bad(msg: string, code = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status: code });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as GPTOfferBody;
    const { customerId, jsonData, textData } = body;

    // Logga vad som faktiskt kommer in från GPT / API-klienten
    console.log("create-from-gpt body:", body);

    // Enda hårda kraven: kund-id + texten
    if (!customerId || !textData) {
      return bad("Missing customerId or textData");
    }

    // Gör jsonData säkert valfritt
    const safeJson = jsonData || {};
    const kund = safeJson.kund || {};

    // 1) Upsert kund i public.customers
    await supabaseAdmin.from("customers").upsert(
      {
        id: customerId,
        name: kund.namn || null,
        orgnr: kund.orgnr || null,
        email: kund.epost || null,
        phone: kund.telefon || null,
        address: kund.adress || null,
        zip: kund.postnummer || null,
        city: kund.ort || null,
        country: kund.land || "Sverige",
      },
      { onConflict: "id" }
    );

    // 2) Generera PDF från texten
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

    // 🧪 Logga längden på PDF-data
    console.log(
      "create-from-gpt pdfBytes length:",
      pdfBytes ? (pdfBytes as any).length : "no pdfBytes"
    );

    // 3) Lagra PDF i Supabase Storage
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

    // 4) Spara rad i public.documents
    const { error: docErr } = await supabaseAdmin.from("documents").insert({
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
    });

    if (docErr) {
      return bad("Insert failed: " + docErr.message, 500);
    }

    // 5) Svar tillbaka till GPT / klienten
    return NextResponse.json(
      {
        ok: true,
        id: docId,
        pdfUrl: pub.publicUrl,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return bad(e?.message || "Unknown error", 500);
  }
}
