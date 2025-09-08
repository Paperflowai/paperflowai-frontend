// src/components/SaveOfferButton.tsx
"use client";

import { useState } from "react";
import { extractOfferPayload, validateOffer } from "@/lib/offerJson";
import { saveOfferPayload } from "@/lib/customerStore";

type Props = {
  assistantMessage: string; // hela texten från GPT-svaret som innehåller JSON
};

export default function SaveOfferButton({ assistantMessage }: Props) {
  const [busy, setBusy] = useState(false);

  const handleClick = () => {
    setBusy(true);
    try {
      const payload = extractOfferPayload(assistantMessage);
      if (!payload) {
        alert("Hittar ingen giltig offert-JSON i svaret.");
        return;
      }
      const check = validateOffer(payload);
      if (!check.ok) {
        alert(check.message || "Validering misslyckades.");
        return;
      }
      saveOfferPayload(payload);
      alert("Offerten sparades till kundkortet (localStorage).");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className="inline-flex items-center gap-2 rounded-md px-3 py-2 bg-emerald-600 text-white text-sm hover:bg-emerald-700 disabled:opacity-60"
    >
      {busy ? "Sparar..." : "Spara till kundkort"}
    </button>
  );
}
