import { NextResponse } from "next/server";

type AddInvoiceBody = {
  customerId: string;
  invoiceUrl: string;
  title: string;
  amount: number | null;
  currency: string | null;
  created_at: string;
};

function bad(msg: string, code = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status: code });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as AddInvoiceBody;
    if (!body?.customerId) return bad("Missing customerId");
    if (!body?.invoiceUrl) return bad("Missing invoiceUrl");
    if (!body?.title) return bad("Missing title");

    // Hämta befintliga bokföringsposter från localStorage (via API)
    // I en riktig applikation skulle detta vara en databas
    const bookkeepingEntries = JSON.parse(
      localStorage.getItem('bookkeeping_entries') || '[]'
    );

    // Skapa ny bokföringspost
    const newEntry = {
      id: `invoice-${Date.now()}`,
      type: 'invoice' as const,
      customerId: body.customerId,
      customerName: body.title, // Använd fakturatitel som kundnamn
      invoiceNo: `F-${Date.now().toString().slice(-6)}`,
      supplierName: 'Egen faktura',
      invoiceDate: new Date(body.created_at).toISOString().split('T')[0], // YYYY-MM-DD
      amountInclVat: body.amount || 0,
      vatAmount: body.amount ? Math.round((body.amount * 0.25) * 100) / 100 : 0, // 25% moms
      fileKey: `invoice-${body.customerId}-${Date.now()}`,
      fileMime: 'application/pdf',
      status: 'Att bokföra' as const,
      createdAt: new Date().toISOString()
    };

    // Lägg till i listan
    bookkeepingEntries.push(newEntry);

    // Spara tillbaka till localStorage
    localStorage.setItem('bookkeeping_entries', JSON.stringify(bookkeepingEntries));

    console.log(`Faktura tillagd i bokföring:`, newEntry);

    return NextResponse.json(
      { 
        ok: true, 
        entry: newEntry,
        message: "Faktura tillagd i bokföringen"
      }, 
      { status: 200 }
    );
  } catch (e: any) {
    return bad(e?.message ?? "Unknown error", 500);
  }
}
