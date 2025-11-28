// src/app/preview/offer/page.tsx
"use client";

import { useEffect, useState } from "react";

import OfferTemplate, { OfferRow } from "@/templates/OfferTemplate";

export default function OfferPreviewPage() {
    const customerId = ""; // TODO: fylls på senare
  const [saving, setSaving] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");

  // 🔹 hämta kundinfo från localStorage om vi fick ett customerId
  useEffect(() => {
    if (!customerId) return;

    // 1) nya strukturen (paperflow_customers_v1)
    const all = JSON.parse(localStorage.getItem("paperflow_customers_v1") || "[]");
    const found = all.find((c: any) => String(c.id) === String(customerId));
    if (found) {
      const name = found.companyName || found.contactPerson || "";
      const addrParts = [found.address, found.zip, found.city].filter(Boolean).join("\n");
      setCustomerName(name);
      setCustomerAddress(addrParts);
      return;
    }

    // 2) gamla strukturen: kund_{id}
    const old = localStorage.getItem(`kund_${customerId}`);
    if (old) {
      const parsed = JSON.parse(old);
      const name = parsed.companyName || parsed.contactPerson || "";
      const addrParts = [parsed.address, parsed.zip, parsed.city].filter(Boolean).join("\n");
      setCustomerName(name);
      setCustomerAddress(addrParts);
    }
  }, [customerId]);

  const rows: OfferRow[] = [
    { text: "Rivning av gammal list och förberedelse av vägg", qty: 6, unit: "tim", price: 650, vat: 25 },
    { text: "Nya golvlister (furu vit), inkl. kapning och montering", qty: 22, unit: "m", price: 49, vat: 25 },
    { text: "Resa inom Stockholm (fast pris)", qty: 1, unit: "st", price: 350, vat: 25 },
  ];

  const offerPayload = {
    companyName: "Ditt Företag AB",
    companyOrgNr: "556123-4567",
    companyAddress: "Exempelgatan 1\n123 45 Stockholm",
    companyEmail: "info@dittforetag.se",
    companyPhone: "070-123 45 67",
    // ⬇️ nu fyller vi med kundens namn/adress
    customerName: customerName,
    customerAddress: customerAddress,
    offerNumber: "O-2025-001",
    offerDate: "2025-11-04",
    validUntil: "2025-12-04",
    projectName: "Listbyte vardagsrum",
    rows,
    notes:
      "Eventuellt extraarbete debiteras löpande enligt timpris.\nPriser exkl. moms om inget annat anges.",
    terms: [
      "Betalningsvillkor 15 dagar.",
      "Material debiteras enligt faktisk åtgång.",
      "Offerten är giltig t.o.m. angivet datum.",
    ],
    customerId,
    status: "draft",
  };

  async function handleSave() {
    if (!customerId) {
      alert("Öppna offertmallen via kundkortet (knappen 'Skapa offert') så customerId följer med.");
      return;
    }
    try {
      setSaving(true);
      const res = await fetch("/api/offers/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(offerPayload),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Sparning misslyckades");
      alert(`✅ Sparad! ID: ${json.id}`);
    } catch (e: any) {
      alert(`❌ Fel: ${e?.message || "Okänt fel"}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-dvh bg-gray-100 p-6">
      <div className="max-w-[794px] mx-auto bg-white p-8 shadow-sm border-2 border-blue-700 rounded-lg">
        <OfferTemplate
          companyName={offerPayload.companyName}
          companyOrgNr={offerPayload.companyOrgNr}
          companyAddress={offerPayload.companyAddress}
          companyEmail={offerPayload.companyEmail}
          companyPhone={offerPayload.companyPhone}
          customerName={offerPayload.customerName}
          customerAddress={offerPayload.customerAddress}
          offerNumber={offerPayload.offerNumber}
          offerDate={offerPayload.offerDate}
          validUntil={offerPayload.validUntil}
          projectName={offerPayload.projectName}
          rows={offerPayload.rows}
          notes={offerPayload.notes}
          terms={offerPayload.terms}
        />

        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-gray-600">
            {customerId
              ? `Kopplas till kund-ID: ${customerId}`
              : "Ingen kund vald – öppna mallen via kundkortet."}
          </p>
          <button
            onClick={handleSave}
            disabled={saving || !customerId}
            className={`px-5 py-2 rounded-lg text-white ${saving || !customerId ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700"}`}
          >
            {saving ? "Sparar…" : "Spara som offert"}
          </button>
        </div>
      </div>
    </main>
  );
}
