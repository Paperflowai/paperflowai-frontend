import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get("customerId");

    if (!customerId) {
      return NextResponse.json({ ok: false, error: "Missing customerId parameter" }, { status: 400 });
    }

    // Hämta alla dokument för kunden
    const { data, error } = await supabaseAdmin
      .from("documents")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Document fetch error:", error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      documents: data || []
    });

  } catch (error) {
    console.error("Document fetch error:", error);
    return NextResponse.json({ 
      ok: false, 
      error: `Server error: ${error instanceof Error ? error.message : String(error)}` 
    }, { status: 500 });
  }
}
