import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic"; // undvik cache vid dev

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  try {
    // ⬇️ viktig ändring: vänta in params
    const { id } = await ctx.params;
    const customerId = decodeURIComponent(id || "");

    if (!customerId) {
      return NextResponse.json(
        { ok: false, error: "customerId missing" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("documents")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // hantera både "type" och "doc_type" om ditt schema varierar
    const typeOf = (d: any) => d.type || d.doc_type || "";
    const offers  = (data || []).filter(d => typeOf(d) === "offer"  || typeOf(d) === "offert");
    const orders  = (data || []).filter(d => typeOf(d) === "order");
    const invoices= (data || []).filter(d => typeOf(d) === "invoice");

    return NextResponse.json({ ok: true, offers, orders, invoices });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
