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

    // Build update object from allowed fields
    const updateData: any = {};

    if (body.company_name !== undefined) updateData.company_name = body.company_name;
    if (body.name !== undefined) updateData.name = body.name;
    if (body.email !== undefined) updateData.email = body.email;
    if (body.phone !== undefined) updateData.phone = body.phone;
    if (body.address !== undefined) updateData.address = body.address;
    if (body.zip !== undefined) updateData.zip = body.zip;
    if (body.city !== undefined) updateData.city = body.city;
    if (body.country !== undefined) updateData.country = body.country;
    if (body.contact_person !== undefined) updateData.contact_person = body.contact_person;
    if (body.role !== undefined) updateData.role = body.role;
    if (body.org_nr !== undefined) updateData.org_nr = body.org_nr;
    if (body.orgnr !== undefined) updateData.orgnr = body.orgnr;
    if (body.contact_date !== undefined) updateData.contact_date = body.contact_date;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.customer_number !== undefined) updateData.customer_number = body.customer_number;

    // The three fields that were missing
    if (body.property_designation !== undefined) updateData.property_designation = body.property_designation;
    if (body.association_orgnr !== undefined) updateData.association_orgnr = body.association_orgnr;
    if (body.personal_number !== undefined) updateData.personal_number = body.personal_number;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { ok: false, error: "No fields to update" },
        { status: 400, headers: corsHeaders }
      );
    }

    const { data: customer, error: fetchError } = await supabase
      .from("customers")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !customer) {
      return NextResponse.json(
        { ok: false, error: "Customer not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    const { error: updateError } = await supabase
      .from("customers")
      .update(updateData)
      .eq("id", id);

    if (updateError) {
      return NextResponse.json(
        { ok: false, error: updateError.message },
        { status: 500, headers: corsHeaders }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Customer updated successfully",
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
