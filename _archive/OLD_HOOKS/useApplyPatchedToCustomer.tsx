"use client";

import { useCallback } from "react";

// Försök importera ev. global store om den finns (t.ex. Zustand)
let useCustomerStore: any = null;
try {
  // justera sökvägen om din store ligger annanstans
  // ex: "../customerStore" eller "../../customerStore"
  // @ts-ignore
  useCustomerStore = require("../customerStore").useCustomerStore;
} catch {
  /* no store found, we fallback to DOM-patch */
}

export function useApplyPatchedToCustomer() {
  return useCallback((patched: any) => {
    if (!patched || typeof patched !== "object") return;

    const map: Record<string, string[]> = {
      name: ["name","namn","företagsnamn","company_name"],
      email: ["email","e_post","e-post","epost"],
      phone: ["phone","telefon","tel"],
      adress: ["address","adress","gata","street"],
      postnummer: ["postal_code","postnummer","postnr","zip"],
      ort: ["city","ort","stad"],
      org_nr: ["org_nr","orgnr","organisationsnummer","organisation_nr"],
      customer_number: ["customer_number","kundnummer","kundnr","offertnummer_ref"],
    };

    const semanticKeys = new Set(Object.keys(map));
    const keys = Object.keys(patched || {});
    const looksDirect = keys.some((k) => !semanticKeys.has(k));

    const writeDirect = (obj: Record<string, any>) => {
      try {
        const storeApi = useCustomerStore?.getState?.();
        const setField = storeApi?.setField || storeApi?.setCustomerField || storeApi?.updateField;
        if (setField) {
          for (const [target, val] of Object.entries(obj)) {
            if (val == null) continue;
            try { setField(target, val); } catch {}
          }
          return true;
        }
      } catch {}
      for (const [target, val] of Object.entries(obj)) {
        if (val == null) continue;
        const sel = [
          `input[name="${target}"]`,
          `input[id="${target}"]`,
          `[data-field="${target}"]`,
          `textarea[name="${target}"]`,
          `textarea[id="${target}"]`,
        ].join(", ");
        const el = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(sel);
        if (el) {
          el.value = String(val);
          el.dispatchEvent(new Event("input", { bubbles: true }));
        }
      }
      return true;
    };

    if (looksDirect) {
      writeDirect(patched);
      return;
    }

    const direct: Record<string, any> = {};
    for (const [k, variants] of Object.entries(map)) {
      const v = (patched as any)[k];
      if (v == null) continue;
      for (const target of variants) {
        direct[target] = v;
      }
    }
    writeDirect(direct);
  }, []);
}
