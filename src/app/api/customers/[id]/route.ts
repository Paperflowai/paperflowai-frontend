import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await req.json();
    const newCompanyName = body.company_name?.trim();

    if (!newCompanyName) {
      return NextResponse.json(
        { ok: false, error: "No company name provided" },
        { status: 400, headers: corsHeaders }
      );
    }

    const { data: customer, error: fetchError } = await supabase
      .from("customers")
      .select("company_name")
      .eq("id", id)
      .single();

    if (fetchError || !customer) {
      return NextResponse.json(
        { ok: false, error: "Customer not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    if (
      customer.company_name &&
      customer.company_name !== "OKÄNT FÖRETAG"
    ) {
      return NextResponse.json(
        { ok: false, error: "Customer already has a real name" },
        { status: 409, headers: corsHeaders }
      );
    }

    const { error: updateError } = await supabase
      .from("customers")
      .update({ company_name: newCompanyName })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json(
        { ok: false, error: updateError.message },
        { status: 500, headers: corsHeaders }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Customer company name updated",
    }, { headers: corsHeaders });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request" },
      { status: 400, headers: corsHeaders }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    await supabase
      .from("offers")
      .delete()
      .eq("customer_id", id);

    await supabase
      .from("customer_cards")
      .delete()
      .eq("customer_id", id);

    const { error } = await supabase
      .from("customers")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500, headers: corsHeaders }
      );
    }

    return NextResponse.json({ ok: true }, { headers: corsHeaders });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Failed to delete customer" },
      { status: 500, headers: corsHeaders }
    );
  }
}
