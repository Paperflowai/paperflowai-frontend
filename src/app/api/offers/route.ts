// src/app/api/offers/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export async function POST(req: Request) {
  try {
    const payload = await req.json();

    // Enkel koll
    if (!payload || typeof payload !== "object") {
      return NextResponse.json(
        { ok: false, error: "Tom eller felaktig body" },
        { status: 400 }
      );
    }

    // Supabase med användarens session (kräver att du är inloggad)
    const supabase = createRouteHandlerClient({ cookies });

    const { data, error } = await supabase
      .from("offers")
      .insert({
        status: payload.status ?? "draft",
        data: payload, // spara hela offert-objektet i jsonb
      })
      .select("id, created_at")
      .single();

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, id: data.id, created_at: data.created_at });
  } catch (err: any) {
    console.error("❌ /api/offers fel:", err);
    return NextResponse.json({ ok: false, error: "Internt fel" }, { status: 500 });
  }
}
