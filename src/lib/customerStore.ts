// src/lib/customerStore.ts
"use client";

import type { Customer, Offer, OfferPayload } from "@/types/offert";

const KEY = "paperflow_customers_v1";

function loadAll(): Customer[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveAll(customers: Customer[]) {
  localStorage.setItem(KEY, JSON.stringify(customers));
}

function normalizeOrgNr(v?: string) {
  return (v || "").replace(/\s+/g, "").toUpperCase();
}
function normalizeEmail(v?: string) {
  return (v || "").trim().toLowerCase();
}

export function upsertCustomerWithOffer(customerData: Omit<Customer, "offers">, offer: Offer) {
  const customers = loadAll();

  const targetOrg = normalizeOrgNr(customerData.orgNr);
  const targetEmail = normalizeEmail(customerData.email);

  const idx = customers.findIndex((c) => {
    const sameOrg = targetOrg && normalizeOrgNr(c.orgNr) === targetOrg;
    const sameEmail = targetEmail && normalizeEmail(c.email) === targetEmail;
    return sameOrg || sameEmail;
  });

  if (idx >= 0) {
    const existing = customers[idx];
    const offers = existing.offers ?? [];
    const already = offers.find((o) => o.offerId === offer.offerId);

    customers[idx] = {
      ...existing,
      ...customerData,
      offers: already ? offers : [...offers, offer],
    };
  } else {
    const newCustomer: Customer = {
      ...customerData,
      id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now()),
      offers: [offer],
    };
    customers.push(newCustomer);
  }

  saveAll(customers);
}

// Hjälper vid klick i chatten
export function saveOfferPayload(payload: OfferPayload) {
  upsertCustomerWithOffer(payload.customer, payload.offer);
}
