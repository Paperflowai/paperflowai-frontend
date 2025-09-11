// src/app/api/offers/create/route.ts
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// Service-klient (server-side) – använder service role key
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,        // ex: https://xxxxx.supabase.co
  process.env.SUPABASE_SERVICE_ROLE_KEY!        // hemlig key (server)
);

type Payload = {
  customerId: string;            // t.ex. "kalles-bygg-123"
  title?: string;                // valfritt
  amount?: number;               // valfritt
  currency?: string;             // valfritt, ex "SEK"
  data?: Record<string, any>;    // hela offertdatan från GPT
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<Payload>;

    if (!body.customerId) {
      return new Response(
        JSON.stringify({ ok: false, error: "customerId saknas" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const row = {
      customer_id: body.customerId,
      title: body.title ?? null,
      amount: body.amount ?? null,
      currency: body.currency ?? "SEK",
      data: body.data ?? {},
    };

    const { data, error } = await supabase
      .from("offers")
      .insert(row)
      .select()
      .single();

    if (error) {
      return new Response(
        JSON.stringify({ ok: false, error: error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true, offer: data }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ ok: false, error: e?.message ?? "Serverfel" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
