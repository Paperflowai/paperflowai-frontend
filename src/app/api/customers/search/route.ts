import { NextResponse } from "next/server";

type SearchCustomerBody = {
  companyName?: string;
  email?: string;
  orgNr?: string;
  phone?: string;
};

function bad(msg: string, code = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status: code });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SearchCustomerBody;
    
    if (!body?.companyName && !body?.email && !body?.orgNr && !body?.phone) {
      return bad("At least one search criteria required");
    }

    // Simulera sökning i kundregister
    // I en riktig app skulle detta vara en databas-sökning
    const searchResults = [];

    // Här skulle vi söka i databasen efter matchande kunder
    // För nu returnerar vi tom array för att simulera att ingen kund hittades
    // Men strukturen är redo för riktig implementering

    return NextResponse.json({
      ok: true,
      customers: searchResults,
      message: searchResults.length > 0 
        ? `${searchResults.length} kund(er) hittade` 
        : "Ingen matchande kund hittades"
    }, { status: 200 });

  } catch (e: any) {
    return bad(e?.message ?? "Unknown error", 500);
  }
}
