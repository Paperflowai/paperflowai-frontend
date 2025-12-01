// src/app/api/customers/[id]/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const customerId = params.id;

  if (!customerId) {
    return NextResponse.json(
      { ok: false, error: "Missing customer id" },
      { status: 400 }
    );
  }

  // 1) Ta bort alla offers kopplade till kunden
  const { error: offersError } = await supabaseAdmin
    .from("offers")
    .delete()
    .eq("customer_id", customerId);

  if (offersError) {
    return NextResponse.json(
      { ok: false, error: offersError.message },
      { status: 500 }
    );
  }

  // 2) Ta bort alla kundkort (customer_cards) kopplade till kunden
  const { error: cardsError } = await supabaseAdmin
    .from("customer_cards")
    .delete()
    .eq("customer_id", customerId);

  if (cardsError) {
    return NextResponse.json(
      { ok: false, error: cardsError.message },
      { status: 500 }
    );
  }

  // 3) Ta bort själva kunden
  const { error: customerError } = await supabaseAdmin
    .from("customers")
    .delete()
    .eq("id", customerId);

  if (customerError) {
    return NextResponse.json(
      { ok: false, error: customerError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
