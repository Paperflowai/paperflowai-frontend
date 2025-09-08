// src/lib/offerJson.ts
"use client";

import type { OfferPayload } from "@/types/offert";

function tryParse(jsonLike: string): any | null {
  try {
    return JSON.parse(jsonLike);
  } catch {
    return null;
  }
}

// Hämta JSON ur ett assistentsvar. Stödjer ```json ... ``` eller ren JSON.
export function extractOfferPayload(text: string): OfferPayload | null {
  if (!text) return null;

  // 1) Först: leta efter ```json ... ```
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  if (fenced && fenced[1]) {
    const obj = tryParse(fenced[1].trim());
    if (obj && obj.offer && obj.customer) return obj as OfferPayload;
  }

  // 2) Testa om hela texten är JSON
  const whole = tryParse(text.trim());
  if (whole && whole.offer && whole.customer) return whole as OfferPayload;

  return null;
}

// En liten flyttolerans för flyttal
const EPS = 0.01;

export function validateOffer(payload: OfferPayload): { ok: boolean; message?: string } {
  if (!payload?.offer || !payload?.customer) {
    return { ok: false, message: "Hittar inte offer/customer i JSON." };
  }

  const o = payload.offer;

  // Grundkrav
  if (!o.offerId) return { ok: false, message: "offer.offerId saknas." };
  if (!o.date) return { ok: false, message: "offer.date saknas." };
  if (typeof o.subtotal !== "number") return { ok: false, message: "offer.subtotal saknas eller är fel." };
  if (typeof o.vatRate !== "number") return { ok: false, message: "offer.vatRate saknas eller är fel." };
  if (typeof o.vatAmount !== "number") return { ok: false, message: "offer.vatAmount saknas eller är fel." };
  if (typeof o.total !== "number") return { ok: false, message: "offer.total saknas eller är fel." };
  if (!Array.isArray(o.items) || o.items.length === 0) return { ok: false, message: "offer.items saknas." };

  // Radkontroll
  const sumLines = o.items.reduce((acc, it) => acc + Number(it.lineTotal || 0), 0);
  if (Math.abs(sumLines - o.subtotal) > EPS) {
    return { ok: false, message: `Radbelopp (${sumLines}) matchar inte subtotal (${o.subtotal}).` };
  }

  // Moms/total-kontroll
  const expectedVat = o.subtotal * o.vatRate;
  if (Math.abs(expectedVat - o.vatAmount) > EPS) {
    return { ok: false, message: `Moms (beräknad ${expectedVat}) matchar inte vatAmount (${o.vatAmount}).` };
  }

  const expectedTotal = o.subtotal + o.vatAmount;
  if (Math.abs(expectedTotal - o.total) > EPS) {
    return { ok: false, message: `Total (beräknad ${expectedTotal}) matchar inte total (${o.total}).` };
  }

  // Minimikrav för kundmatchning (orgNr eller email)
  const c = payload.customer;
  if (!c.orgNr && !c.email) {
    return { ok: false, message: "Kunden måste ha orgNr eller email för matchning." };
  }

  return { ok: true };
}
