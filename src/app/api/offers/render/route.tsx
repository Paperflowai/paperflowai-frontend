import { NextRequest } from "next/server";
import { pdf } from "@react-pdf/renderer";
import OfferPdf, { OfferData } from "@/lib/pdf/OfferPdf";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { data, logoUrl, rotImageUrl } = await req.json() as { data: OfferData; logoUrl?: string; rotImageUrl?: string; };
    
    if (!data) {
      return new Response(JSON.stringify({ ok: false, error: "Data is required" }), { 
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const instance = pdf(<OfferPdf data={data} logoUrl={logoUrl} rotImageUrl={rotImageUrl} />);
    const buf = await instance.toBuffer();
    
    return new Response(buf, {
      status: 200,
      headers: { 
        "Content-Type": "application/pdf", 
        "Content-Disposition": "inline; filename=offert.pdf" 
      },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message || "Render-fel" }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
