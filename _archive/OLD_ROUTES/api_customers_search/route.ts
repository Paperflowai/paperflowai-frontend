import { NextResponse } from "next/server";

function bad(msg: string, code = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status: code });
}

interface Customer {
  id: string;
  companyName?: string;
  orgNr?: string;
  contactPerson?: string;
  role?: string;
  phone?: string;
  email?: string;
  address?: string;
  zip?: string;
  city?: string;
  country?: string;
  notes?: string;
  customerNumber?: string;
  contactDate?: string;
  offers?: any[];
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { query } = body;

    if (!query) {
      return bad("Missing search query");
    }

    // 🔎 Simulerad kundsökning (byt mot riktig databas senare)
    const searchResults: Customer[] = [];

    // Här skulle du söka i databasen efter matchande kunder baserat på `query`
    // Just nu returnerar vi alltid en tom array för att simulera "ingen träff"

    return NextResponse.json(
      {
        ok: true,
        results: searchResults,
        total: searchResults.length,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return bad(e?.message ?? "Unknown error", 500);
  }
}
