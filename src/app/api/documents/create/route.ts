import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import crypto from "crypto";

export const runtime = "nodejs";

type DocumentType = "offert" | "order" | "faktura";

type CreateDocumentBody = {
  customerId: string;
  type: DocumentType;
  title: string;
  amount: number;
  currency: string;
  dataJson: any;
};

function bad(msg: string, code = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status: code });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CreateDocumentBody;
    const { customerId, type, title, amount, currency, dataJson } = body;

    if (!customerId || !type || !title) {
      return bad("Missing required fields: customerId, type, title");
    }

    // Generera unikt ID för dokumentet
    const documentId = crypto.randomUUID();

    // Spara dokument i Supabase
    const { data, error } = await supabaseAdmin
      .from("documents")
      .insert({
        id: documentId,
        customer_id: customerId,
        type: type,
        title: title,
        amount: amount || 0,
        currency: currency || "SEK",
        data_json: dataJson,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error("Document creation error:", error);
      return bad(`Failed to create document: ${error.message}`);
    }

    return NextResponse.json({
      ok: true,
      document: data,
      message: `${type} skapad framgångsrikt`
    });

  } catch (error) {
    console.error("Document creation error:", error);
    return bad(`Server error: ${error instanceof Error ? error.message : String(error)}`);
  }
}
