// src/app/api/offers/create/route.tsx
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import React from "react";
import { Document, Page, Text, View, StyleSheet, pdf } from "@react-pdf/renderer";

export const runtime = "nodejs";

// --- Supabase server-klient (service role key) ---
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,       // t.ex. https://xxxx.supabase.co
  process.env.SUPABASE_SERVICE_ROLE_KEY!       // server-hemlis
);

// --- Typer för payload ---
type Payload = {
  customerId: string;               // ex "kalles-bygg-123"
  title?: string;                   // "Takrenovering"
  amount?: number;                  // 12000
  currency?: string;                // "SEK"
  data?: Record<string, any>;       // hela offertdatan
};

// --- Enkel PDF-komponent (fallback) ---
// Vill du använda din egen OfferPdf senare? Byt bara ut innehållet i <Page> här.
const styles = StyleSheet.create({
  page: { padding: 24 },
  h1: { fontSize: 18, marginBottom: 8 },
  p: { fontSize: 12, marginBottom: 4 },
  item: { fontSize: 12, marginLeft: 8 }
});

function OfferPdfDoc(props: Required<Pick<Payload, "customerId" | "data" | "title" | "amount" | "currency">>) {
  const items = (props.data?.items as Array<any>) || [];
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Offert: {props.title}</Text>
        <Text style={styles.p}>Kund-ID: {props.customerId}</Text>
        {props.data?.customer && <Text style={styles.p}>Kund: {String(props.data.customer)}</Text>}
        <View style={{ marginTop: 8, marginBottom: 8 }}>
          <Text style={styles.p}>Rader:</Text>
          {items.map((it, i) => (
            <Text key={i} style={styles.item}>• {String(it?.name ?? "Rad")} — {String(it?.price ?? "")} {props.currency}</Text>
          ))}
        </View>
        <Text style={styles.p}>Summa: {props.amount} {props.currency}</Text>
        <Text style={[styles.p, { marginTop: 12 }]}>Genererad av PaperflowAI</Text>
      </Page>
    </Document>
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<Payload>;
    if (!body.customerId) {
      return json({ ok: false, error: "customerId saknas" }, 400);
    }

    const row = {
      customer_id: body.customerId,
      title: body.title ?? null,
      amount: body.amount ?? null,
      currency: body.currency ?? "SEK",
      data: body.data ?? {},
      file_url: null as string | null
    };

    // 1) Skapa posten i DB (för att få id)
    const { data: created, error: insertErr } = await supabase
      .from("offers")
      .insert(row)
      .select()
      .single();

    if (insertErr || !created) {
      throw new Error(insertErr?.message || "Kunde inte spara offert i databasen");
    }

    // 2) Rendera PDF
    const pdfElement = (
      <OfferPdfDoc
        customerId={created.customer_id}
        data={(created.data ?? {}) as Record<string, any>}
        title={created.title ?? "Offert"}
        amount={Number(created.amount ?? 0)}
        currency={created.currency ?? "SEK"}
      />
    );
    const instance = pdf(pdfElement);
    const blob = await instance.toBlob();
    const arrayBuffer = await blob.arrayBuffer();

    // 3) Ladda upp till Supabase Storage (bucket: offers)
    //    Filväg: offers/{customerId}/{offerId}.pdf
    const filePath = `${created.customer_id}/${created.id}.pdf`;
    const { error: uploadErr } = await supabase
      .storage
      .from("offers")
      .upload(filePath, arrayBuffer, {
        contentType: "application/pdf",
        upsert: true
      });

    if (uploadErr) {
      throw new Error(uploadErr.message || "Kunde inte ladda upp PDF till Storage");
    }

    // 4) Hämta publik URL & uppdatera posten
    const { data: pub } = supabase.storage.from("offers").getPublicUrl(filePath);
    const file_url = pub?.publicUrl ?? null;

    const { data: updated, error: updateErr } = await supabase
      .from("offers")
      .update({ file_url })
      .eq("id", created.id)
      .select()
      .single();

    if (updateErr || !updated) {
      throw new Error(updateErr?.message || "Kunde inte uppdatera offert med file_url");
    }

    // 5) Klart
    return json({ ok: true, offer: updated }, 200);

  } catch (e: any) {
    return json({ ok: false, error: e?.message ?? "Serverfel" }, 500);
  }
}

// Hjälpfunktion för JSON-svar
function json(payload: any, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
