import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import crypto from "crypto";

export const runtime = "nodejs";

type CreateFromGptBody = {
  customerId: string;
  jsonData: any;
  textData: string;
  documentType?: string;
};

function bad(msg: string, code = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status: code });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CreateFromGptBody;
    const { customerId, jsonData, textData, documentType } = body;

    if (!customerId || !jsonData) {
      return bad("Missing required fields: customerId, jsonData");
    }

    // Generera unikt ID för dokumentet
    const documentId = crypto.randomUUID();

    // Spara dokument i documents-tabellen
    const { data, error } = await supabaseAdmin
      .from("documents")
      .insert({
        id: documentId,
        customer_id: customerId,
        type: jsonData.documentType ?? "offert",
        title: jsonData.title ?? "Offert",
        amount: jsonData.amount ?? 0,
        currency: jsonData.currency ?? "SEK",
        data_json: jsonData.dataJson ?? {},
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error("Document creation error:", error);
      return bad(`Failed to create document: ${error.message}`);
    }

    // Generera PDF-URL (placeholder för nu)
    const pdfUrl = `/api/documents/${documentId}/pdf`;

    return NextResponse.json({
      ok: true,
      document: data,
      pdfUrl: pdfUrl,
      message: "Dokument sparad framgångsrikt"
    });

  } catch (error) {
    console.error("Document creation error:", error);
    return bad(`Server error: ${error instanceof Error ? error.message : String(error)}`);
  }
}
