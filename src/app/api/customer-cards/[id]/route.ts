import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { z } from "zod";

// Zod-schema för validering av kundkort (uppdatering - anpassat till DB-schema)
const customerCardUpdateSchema = z.object({
  name: z.string().min(1, "Företagsnamn är obligatoriskt").optional(),
  orgnr: z.string().nullable().optional(),
  email: z.string().email("Ogiltig e-postadress").nullable().optional(),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  // Fält som inte finns i DB valideras men sparas inte
  zip: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  customerNumber: z.string().nullable().optional(),
  contactPerson: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

// GET - Hämta specifikt kundkort
export async function GET(req: Request, context: Context) {
  try {
    const { id } = await context.params;
    const customerId = decodeURIComponent(id);
    
    const { data, error } = await supabaseAdmin
      .from("customers")
      .select("id, name, orgnr, email, phone, address, zip, city, country, created_at, updated_at")
      .eq("id", customerId)
      .single();
    
    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { ok: false, error: "Kundkortet hittades inte" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { ok: false, error: "Kunde inte hämta kundkort: " + error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { ok: true, customer: data },
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

// PUT - Uppdatera helt kundkort
export async function PUT(req: Request, context: Context) {
  try {
    const { id } = await context.params;
    const customerId = decodeURIComponent(id);
    const body = await req.json();
    
    // Validera inkommande data
    const validatedData = customerCardUpdateSchema.parse(body);
    
    // Kontrollera att kunden finns
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from("customers")
      .select("id")
      .eq("id", customerId)
      .single();
    
    if (fetchError || !existing) {
      return NextResponse.json(
        { ok: false, error: "Kundkortet hittades inte" },
        { status: 404 }
      );
    }
    
    // Förbered uppdateringsdata (endast fält som finns i databasen)
    const updateData: any = {};
    
    // Lägg till validerade fält som finns i DB
    if (validatedData.name !== undefined) updateData.name = validatedData.name;
    if (validatedData.orgnr !== undefined) updateData.orgnr = validatedData.orgnr;
    if (validatedData.email !== undefined) updateData.email = validatedData.email;
    if (validatedData.phone !== undefined) updateData.phone = validatedData.phone;
    if (validatedData.address !== undefined) updateData.address = validatedData.address;
    
    // Logga övriga fält för framtida bruk (sparas inte i DB)
    const extraFields = {};
    if (validatedData.zip !== undefined) extraFields.zip = validatedData.zip;
    if (validatedData.city !== undefined) extraFields.city = validatedData.city;
    if (validatedData.country !== undefined) extraFields.country = validatedData.country;
    if (validatedData.customerNumber !== undefined) extraFields.customerNumber = validatedData.customerNumber;
    if (validatedData.contactPerson !== undefined) extraFields.contactPerson = validatedData.contactPerson;
    if (validatedData.notes !== undefined) extraFields.notes = validatedData.notes;
    
    // Uppdatera kund
    const { data, error } = await supabaseAdmin
      .from("customers")
      .update(updateData)
      .eq("id", customerId)
      .select()
      .single();
    
    if (error) {
      console.error("Fel vid uppdatering av kund:", error);
      return NextResponse.json(
        { ok: false, error: "Kunde inte uppdatera kund: " + error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { 
        ok: true, 
        customer: data,
        extraFields: Object.keys(extraFields).length > 0 ? extraFields : undefined,
        message: "Kundkort uppdaterat framgångsrikt"
      },
      { status: 200 }
    );
    
  } catch (error: any) {
    console.error("API-fel:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          ok: false, 
          error: "Valideringsfel",
          details: error.issues.map((e: any) => ({
            field: e.path.join('.'),
            message: e.message
          }))
        },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { ok: false, error: "Internt serverfel" },
      { status: 500 }
    );
  }
}

// PATCH - Uppdatera specifika fält i kundkort
export async function PATCH(req: Request, context: Context) {
  try {
    const { id } = await context.params;
    const customerId = decodeURIComponent(id);
    const body = await req.json();
    
    // Validera inkommande data
    const validatedData = customerCardUpdateSchema.parse(body);
    
    // Kontrollera att kunden finns
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from("customers")
      .select("id")
      .eq("id", customerId)
      .single();
    
    if (fetchError || !existing) {
      return NextResponse.json(
        { ok: false, error: "Kundkortet hittades inte" },
        { status: 404 }
      );
    }
    
    // Förbered uppdateringsdata (endast fält som finns i databasen)
    const updateData: any = {};
    
    // Lägg till validerade fält som finns i DB
    if (validatedData.name !== undefined) updateData.name = validatedData.name;
    if (validatedData.orgnr !== undefined) updateData.orgnr = validatedData.orgnr;
    if (validatedData.email !== undefined) updateData.email = validatedData.email;
    if (validatedData.phone !== undefined) updateData.phone = validatedData.phone;
    if (validatedData.address !== undefined) updateData.address = validatedData.address;
    
    // Logga övriga fält för framtida bruk (sparas inte i DB)
    const extraFields = {};
    if (validatedData.zip !== undefined) extraFields.zip = validatedData.zip;
    if (validatedData.city !== undefined) extraFields.city = validatedData.city;
    if (validatedData.country !== undefined) extraFields.country = validatedData.country;
    if (validatedData.customerNumber !== undefined) extraFields.customerNumber = validatedData.customerNumber;
    if (validatedData.contactPerson !== undefined) extraFields.contactPerson = validatedData.contactPerson;
    if (validatedData.notes !== undefined) extraFields.notes = validatedData.notes;
    
    // Uppdatera kund
    const { data, error } = await supabaseAdmin
      .from("customers")
      .update(updateData)
      .eq("id", customerId)
      .select()
      .single();
    
    if (error) {
      console.error("Fel vid uppdatering av kund:", error);
      return NextResponse.json(
        { ok: false, error: "Kunde inte uppdatera kund: " + error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { 
        ok: true, 
        customer: data,
        extraFields: Object.keys(extraFields).length > 0 ? extraFields : undefined,
        message: "Kundkort uppdaterat framgångsrikt"
      },
      { status: 200 }
    );
    
  } catch (error: any) {
    console.error("API-fel:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          ok: false, 
          error: "Valideringsfel",
          details: error.issues.map((e: any) => ({
            field: e.path.join('.'),
            message: e.message
          }))
        },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { ok: false, error: "Internt serverfel" },
      { status: 500 }
    );
  }
}

// DELETE - Ta bort kundkort
export async function DELETE(req: Request, context: Context) {
  try {
    const { id } = await context.params;
    const customerId = decodeURIComponent(id);
    
    // Kontrollera att kunden finns
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from("customers")
      .select("id")
      .eq("id", customerId)
      .single();
    
    if (fetchError || !existing) {
      return NextResponse.json(
        { ok: false, error: "Kundkortet hittades inte" },
        { status: 404 }
      );
    }
    
    // Ta bort kund
    const { error } = await supabaseAdmin
      .from("customers")
      .delete()
      .eq("id", customerId);
    
    if (error) {
      console.error("Fel vid borttagning av kund:", error);
      return NextResponse.json(
        { ok: false, error: "Kunde inte ta bort kund: " + error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { 
        ok: true, 
        message: "Kundkort borttaget framgångsrikt"
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