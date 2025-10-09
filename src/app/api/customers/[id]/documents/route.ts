import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Tillåt båda varianterna av env-namn
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
const SERVICE_ROLE =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

// Viktigt: 2:a argumentet typas som "any" för Next 15
export async function GET(req: Request, { params }: any) {
  try {
    const customerId = decodeURIComponent(params?.id ?? "");
    if (!customerId) {
      return NextResponse.json(
        { error: "Customer ID required" },
        { status: 400 }
      );
    }

    // Hämta alla dokumenttyper för kunden
    const { data: offers, error: offersError } = await admin
      .from("offers")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });

    const { data: orders, error: ordersError } = await admin
      .from("orders")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });

    const { data: invoices, error: invoicesError } = await admin
      .from("invoices")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });

    if (offersError || ordersError || invoicesError) {
      return NextResponse.json(
        { error: "Failed to fetch documents" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      offers: offers ?? [],
      orders: orders ?? [],
      invoices: invoices ?? [],
    });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
