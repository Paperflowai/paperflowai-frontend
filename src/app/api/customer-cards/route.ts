import { NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const supabase: SupabaseClient | null =
  SUPABASE_URL && SUPABASE_ANON
    ? createClient(SUPABASE_URL, SUPABASE_ANON, {
        db: {
          schema: {
            tables: {
              customers: {
                columns: {
                  id: "uuid",
                  name: "text",
                  orgnr: "text",
                  email: "text",
                  phone: "text",
                  address: "text",
                  zip: "text",
                  city: "text",
                  country: "text",
                  created_at: "timestamp",
                  updated_at: "timestamp",
                },
              },
            },
          },
        },
      })
    : null;

function supabaseMissingResponse(status: number = 503) {
  return NextResponse.json(
    {
      ok: status === 200,
      customers: status === 200 ? [] : undefined,
      error: status === 200 ? undefined : "Supabase is not configured",
      message:
        status === 200
          ? "Supabase is not configured; returning an empty list"
          : "Supabase is not configured",
    },
    { status }
  );
}

// Zod-schema för validering av kundkort
const customerCardSchema = z.object({
  name: z.string().min(1, "Företagsnamn är obligatoriskt"),
  orgnr: z.string().nullable().optional(),
  email: z.string().email("Ogiltig e-postadress").nullable().optional(),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  zip: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  country: z.string().default("Sverige").optional(),
  contactPerson: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  customerNumber: z.string().nullable().optional(),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET - Hämta alla kundkort
export async function GET() {
  if (!supabase) return supabaseMissingResponse(200);
  try {
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Kunde inte hämta customers från Supabase:", error.message);
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      customers: data || [],
      message: "Kundkort hämtade från Supabase"
    });
  } catch (error: any) {
    console.error("Serverfel:", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}

// POST - Skapa nytt kundkort
export async function POST(req: Request) {
  if (!supabase) return supabaseMissingResponse();
  try {
    const body = await req.json();
    
    // Validera inkommande data
    const validatedData = customerCardSchema.parse(body);
    
    // Kolla om kund med samma e-post redan finns
    if (validatedData.email) {
      const { data: existing } = await supabase
        .from("customers")
        .select("id")
        .eq("email", validatedData.email)
        .single();
      
      if (existing) {
        return NextResponse.json(
          { 
            ok: false, 
            error: "Kund med denna e-postadress finns redan",
            existingId: existing.id 
          },
          { status: 409 }
        );
      }
    }
    
    // Skapa ny kund
    const { data, error } = await supabase
      .from("customers")
      .insert([{
        id: crypto.randomUUID(),
        name: validatedData.name,
        orgnr: validatedData.orgnr || null,
        email: validatedData.email || null,
        phone: validatedData.phone || null,
        address: validatedData.address || null,
        zip: validatedData.zip || null,
        city: validatedData.city || null,
        country: validatedData.country || "Sverige",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }])
      .select()
      .single();
    
    if (error) {
      console.error("Fel vid skapande av kundkort:", error);
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      ok: true,
      customer: data,
      message: "Kundkort skapat i Supabase"
    }, { status: 201 });
    
  } catch (error: any) {
    console.error("Serverfel:", error);
    
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
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}

// PUT - Uppdatera helt kundkort
export async function PUT(req: Request, context: any) {
  if (!supabase) return supabaseMissingResponse();
  try {
    const { id } = await context.params;
    const customerId = decodeURIComponent(id);
    const body = await req.json();
    
    // Validera inkommande data
    const validatedData = customerCardSchema.parse(body);
    
    // Kontrollera att kunden finns
    const { data: existing } = await supabase
      .from("customers")
      .select("id")
      .eq("id", customerId)
      .single();
    
    if (!existing) {
      return NextResponse.json(
        { 
          ok: false, 
          error: "Kundkortet hittades inte" 
        },
        { status: 404 }
      );
    }
    
    // Uppdatera kund
    const { data, error } = await supabase
      .from("customers")
      .update({
        name: validatedData.name,
        orgnr: validatedData.orgnr,
        email: validatedData.email,
        phone: validatedData.phone,
        address: validatedData.address,
        zip: validatedData.zip,
        city: validatedData.city,
        country: validatedData.country,
        updated_at: new Date().toISOString(),
      })
      .eq("id", customerId)
      .select()
      .single();
    
    if (error) {
      console.error("Fel vid uppdatering av kundkort:", error);
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      ok: true,
      customer: data,
      message: "Kundkort uppdaterat"
    }, { status: 200 });
    
  } catch (error: any) {
    console.error("Serverfel:", error);
    
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
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}

// PATCH - Uppdatera specifika fält i kundkort
export async function PATCH(req: Request, context: any) {
  if (!supabase) return supabaseMissingResponse();
  try {
    const { id } = await context.params;
    const customerId = decodeURIComponent(id);
    const body = await req.json();
    
    // Validera inkommande data
    const validatedData = customerCardSchema.parse(body);
    
    // Kontrollera att kunden finns
    const { data: existing } = await supabase
      .from("customers")
      .select("id")
      .eq("id", customerId)
      .single();
    
    if (!existing) {
      return NextResponse.json(
        { 
          ok: false, 
          error: "Kundkortet hittades inte" 
        },
        { status: 404 }
      );
    }
    
    // Uppdatera endast validerade fält
    const updateData: any = {};
    
    if (validatedData.name !== undefined) updateData.name = validatedData.name;
    if (validatedData.orgnr !== undefined) updateData.orgnr = validatedData.orgnr;
    if (validatedData.email !== undefined) updateData.email = validatedData.email;
    if (validatedData.phone !== undefined) updateData.phone = validatedData.phone;
    if (validatedData.address !== undefined) updateData.address = validatedData.address;
    if (validatedData.zip !== undefined) updateData.zip = validatedData.zip;
    if (validatedData.city !== undefined) updateData.city = validatedData.city;
    if (validatedData.country !== undefined) updateData.country = validatedData.country;
    updateData.updated_at = new Date().toISOString();
    
    const { data, error } = await supabase
      .from("customers")
      .update(updateData)
      .eq("id", customerId)
      .select()
      .single();
    
    if (error) {
      console.error("Fel vid uppdatering av kundkort:", error);
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      ok: true,
      customer: data,
      message: "Kundkort uppdaterat"
    }, { status: 200 });
    
  } catch (error: any) {
    console.error("Serverfel:", error);
    
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
      { ok: false, error: error.message },
        { status: 500 }
    );
  }
}

// DELETE - Ta bort kundkort
export async function DELETE(req: Request, context: any) {
  if (!supabase) return supabaseMissingResponse();
  try {
    const { id } = await context.params;
    const customerId = decodeURIComponent(id);
    
    // Kontrollera att kunden finns
    const { data: existing } = await supabase
      .from("customers")
      .select("id")
      .eq("id", customerId)
      .single();
    
    if (!existing) {
      return NextResponse.json(
        { 
          ok: false, 
          error: "Kundkortet hittades inte" 
        },
        { status: 404 }
      );
    }
    
    // Ta bort kund
    const { error } = await supabase
      .from("customers")
      .delete()
      .eq("id", customerId);
    
    if (error) {
      console.error("Fel vid borttagning av kundkort:", error);
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      ok: true,
      message: "Kundkort borttaget framgångsrikt"
    }, { status: 200 });
    
  } catch (error: any) {
    console.error("Serverfel:", error);
    
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}