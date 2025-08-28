// src/app/api/sendEmail/uploads/route.ts
import { NextResponse } from "next/server";

// Gör POST tillgänglig (så filen blir en "modul" med en export)
export async function POST(_req: Request) {
  // TODO: ersätt med riktig uppladdning senare
  return NextResponse.json({ ok: true });
}

// Valfritt: blockera GET tills vidare (undviker att route används fel)
export function GET() {
  return NextResponse.json({ error: "Method Not Allowed" }, { status: 405 });
}
