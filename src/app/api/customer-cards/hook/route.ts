import { NextResponse } from "next/server";
import { z } from "zod";
import {
  listExternalCustomers,
  upsertExternalCustomer,
  findExternalCustomer,
} from "@/lib/customerHookStore";
import { supabaseAdmin, supabaseAdminConfigured } from "@/lib/supabaseServer";

const payloadSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Företagsnamn krävs"),
  orgnr: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  zip: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  contactPerson: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  customerNumber: z.string().nullable().optional(),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mapDbCustomer(row: any) {
  if (!row) return null;
  return {
    id: String(row.id),
    name: row.name || "",
    orgnr: row.orgnr || null,
    email: row.email || null,
    phone: row.phone || null,
    address: row.address || null,
    zip: row.zip || null,
    city: row.city || null,
    country: row.country || null,
    contactPerson: row.contact_person || row.contactPerson || null,
    notes: row.notes || null,
    customerNumber: row.customer_number || row.customerNumber || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (supabaseAdminConfigured) {
    try {
      if (id) {
        const { data, error } = await supabaseAdmin
          .from("customers")
          .select(
            "id, name, orgnr, email, phone, address, zip, city, country, created_at, updated_at"
          )
          .eq("id", id)
          .maybeSingle();

        if (error) {
          return NextResponse.json(
            { ok: false, error: error.message },
            { status: error.code === "PGRST116" ? 404 : 500 }
          );
        }

        return NextResponse.json({
          ok: true,
          customer: mapDbCustomer(data),
          source: "supabase",
        });
      }

      const { data, error } = await supabaseAdmin
        .from("customers")
        .select(
          "id, name, orgnr, email, phone, address, zip, city, country, created_at, updated_at"
        )
        .order("created_at", { ascending: false });

      if (error) {
        return NextResponse.json(
          { ok: false, error: error.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        ok: true,
        customers: (data || []).map(mapDbCustomer),
        source: "supabase",
      });
    } catch (e: any) {
      console.error("[customer hook] Supabase GET failed", e);
      return NextResponse.json({ ok: false, error: e?.message || "Unknown" }, { status: 500 });
    }
  }

  // Local file-based fallback for demo/dev when Supabase is disabled
  const customers = listExternalCustomers();
  if (id) {
    const match = findExternalCustomer(id);
    if (!match) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, customer: match, source: "file" });
  }

  return NextResponse.json({ ok: true, customers, source: "file" });
}

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const payload = payloadSchema.parse(json);

    if (supabaseAdminConfigured) {
      const now = new Date().toISOString();
      const id = payload.id || (crypto.randomUUID ? crypto.randomUUID() : `hook-${Date.now()}`);

      const { data, error } = await supabaseAdmin
        .from("customers")
        .upsert({
          id,
          name: payload.name,
          orgnr: payload.orgnr ?? null,
          email: payload.email ?? null,
          phone: payload.phone ?? null,
          address: payload.address ?? null,
          zip: payload.zip ?? null,
          city: payload.city ?? null,
          country: payload.country ?? "Sverige",
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();

      if (error) {
        console.error("[customer hook] Failed to upsert supabase customer", error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }

      return NextResponse.json({ ok: true, customer: mapDbCustomer(data), source: "supabase" }, { status: 201 });
    }

    const customer = upsertExternalCustomer(payload);
    return NextResponse.json({ ok: true, customer, source: "file" }, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: "Valideringsfel", details: error.issues },
        { status: 400 }
      );
    }
    console.error("[customer hook] POST failed", error);
    return NextResponse.json({ ok: false, error: error?.message || "Unknown" }, { status: 500 });
  }
}
