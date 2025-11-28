import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET - Hämta alla kundkort
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const search = searchParams.get("search");
    
    let query = supabaseAdmin
      .from("customers")
      .select("id, name, orgnr, email, phone, address, zip, city, country, created_at, updated_at")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    
    // Lägg till sökning om angivet
    if (search) {
      query = query.or(
        `name.ilike.%${search}%,email.ilike.%${search}%,customer_number.ilike.%${search}%,orgnr.ilike.%${search}%`
      );
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error("Fel vid hämtning av kundkort:", error);
      return NextResponse.json(
        { ok: false, error: "Kunde inte hämta kundkort: " + error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { 
        ok: true, 
        customers: data || [],
        pagination: {
          limit,
          offset,
          total: data?.length || 0
        }
      },
      { status: 200 }
    );
    
  } catch (error: any) {
    console.error("API-fel:", error);
    return NextResponse.json(
      { ok: false, error: "Internt serverfel" },
      { status: 500 }
    );
  }
}