import { NextRequest } from "next/server";
import { pdf } from "@react-pdf/renderer";
import React from "react";
import OfferPdf, { OfferData } from "@/lib/pdf/OfferPdf";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { data } = (await req.json()) as { data: OfferData };

    // Skapa JSX-elementet
    const element = <OfferPdf data={data} />;

    // Rendera till PDF med react-pdf
    const instance = pdf(element);
    const buf = await instance.toBuffer();

    // ✅ Gör om Buffer till Uint8Array så Next.js Response accepterar det
    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline; filename=offert.pdf",
      },
    });
  } catch (e: any) {
    return new Response(
      JSON.stringify({ ok: false, error: e?.message || "Render-fel" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
