import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const newCompanyName = body.company_name?.trim();

    if (!newCompanyName) {
      return NextResponse.json(
        { ok: false, error: "No company name provided" },
        { status: 400 }
      );
    }

    // 1. Hämta nuvarande kund
    const { data: customer, error: fetchError } = await supabase
      .from("customers")
      .select("company_name")
      .eq("id", params.id)
      .single();

    if (fetchError || !customer) {
      return NextResponse.json(
        { ok: false, error: "Customer not found" },
        { status: 404 }
      );
    }

    // 2. Uppdatera ENDAST om placeholder
    if (
      customer.company_name &&
      customer.company_name !== "OKÄNT FÖRETAG"
    ) {
      return NextResponse.json(
        { ok: false, error: "Customer already has a real name" },
        { status: 409 }
      );
    }

    const { error: updateError } = await supabase
      .from("customers")
      .update({ company_name: newCompanyName })
      .eq("id", params.id);

    if (updateError) {
      return NextResponse.json(
        { ok: false, error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Customer company name updated",
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: "Invalid request" },
      { status: 400 }
    );
  }
}
