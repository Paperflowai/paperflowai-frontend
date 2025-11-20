import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import crypto from "crypto";
import { buildDocument } from "@/lib/pdf/buildDocument";

export const runtime = "nodejs";

type GPTOfferBody = {
  customerId: string;
  jsonData: any;   // Strukturerad offert-data (kund, rader, summa osv.)
  textData: string; // Den snygga textversionen av offerten
};

function bad(msg: string, code = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status: code });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as GPTOfferBody;
    const { customerId, jsonData, textData } = body;

    // 1) Minimikrav
    if (!customerId || !jsonData || !textData) {
      return bad("Missing customerId, jsonData or textData");
    }

    // 2) Upsert kund i customers
    const kund = jsonData.kund || {};
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

    // 3) Skapa PDF via din befintliga PDF-generator
    const pdfBytes = await buildDocument(
      {
        customerId,
        title: jsonData.titel || "Offert",
        amount: Number(jsonData.summa) || 0,
        currency: jsonData.valuta || "SEK",
        needsPrint: false,
        data: { textData },
      },
      "offer"
    );

    // 4) Ladda upp PDF till Supabase Storage
    const docId = crypto.randomUUID();
    const bucket = "paperflow-files";
    const filename = `offert-${Date.now()}.pdf`;
    const storagePath = `offers/${customerId}/${filename}`;

    const { error: upErr } = await supabaseAdmin.storage
      .from(bucket)
      .upload(storagePath, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (upErr) {
      return bad("Upload failed: " + upErr.message, 500);
    }

    // 5) Hämta publik URL
    const { data: pub } = supabaseAdmin
      .storage
      .from(bucket)
      .getPublicUrl(storagePath);

    if (!pub?.publicUrl) {
      return bad("Could not generate public URL", 500);
    }

    const fileUrl = pub.publicUrl;

    // 6) Spara i public.documents (ENBART kolumner som finns!)
    const { error: docErr } = await supabaseAdmin.from("documents").insert({
      id: docId,
      customer_id: customerId,
      doc_type: "offer",      // passerar din CHECK-constraint
      type: "offer",
      filename,
      storage_path: storagePath,
      file_url: fileUrl,
      bucket: bucket,
      bucket_name: bucket,
      total_amount: Number(jsonData.summa) || 0,
      status: "created",
      created_at: new Date().toISOString(),
    });

    if (docErr) {
      return bad("Insert failed: " + docErr.message, 500);
    }

    // 7) Svar tillbaka till GPT / frontend
    return NextResponse.json(
      {
        ok: true,
        id: docId,
        pdfUrl: fileUrl,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return bad(e?.message || "Unknown error", 500);
  }
}
