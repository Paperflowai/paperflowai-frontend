// src/templates/OfferTemplate.tsx
import React from "react";

/** Typer för datan som matar mallen */
export type OfferRow = {
  description: string;
  qty: number;
  unit: string;
  unitPrice: number;   // exkl. moms
  vatRate: number;     // t.ex. 25 för 25%
};

export type OfferData = {
  company: {
    name: string;
    address1?: string;
    zipCity?: string;
    email?: string;
    phone?: string;
    orgnr?: string;
  };
  customer: {
    name: string;
    address1?: string;
    zipCity?: string;
  };
  project?: {
    name?: string;
  };
  meta: {
    number: string;    // Offertnr
    date: string;      // YYYY-MM-DD
    validUntil?: string;
  };
  rows: OfferRow[];
  currency?: string;   // "kr" som default
};

function kr(n: number) {
  return n.toLocaleString("sv-SE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function OfferTemplate({ data }: { data: OfferData }) {
  const currency = data.currency ?? "kr";
  const subTotal = data.rows.reduce((s, r) => s + r.qty * r.unitPrice, 0);
  const vatTotal = data.rows.reduce((s, r) => s + r.qty * r.unitPrice * (r.vatRate / 100), 0);
  const grandTotal = subTotal + vatTotal;

  return (
    <div className="bg-white text-black mx-auto max-w-[794px] min-h-[1123px] p-10 print:p-8">
      {/* Topp */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{data.company.name}</h1>
          {data.company.address1 && <div>{data.company.address1}</div>}
          {data.company.zipCity && <div>{data.company.zipCity}</div>}
          {data.company.email && <div>{data.company.email}</div>}
          {data.company.phone && <div>{data.company.phone}</div>}
          {data.company.orgnr && <div>Org.nr: {data.company.orgnr}</div>}
        </div>
        <div className="text-right">
          <div className="text-xl font-bold tracking-wide">OFFERT</div>
          <div>Offertnr: {data.meta.number}</div>
          <div>Datum: {data.meta.date}</div>
          {data.meta.validUntil && <div>Giltig till: {data.meta.validUntil}</div>}
        </div>
      </div>

      {/* Kund / Projekt */}
      <div className="grid grid-cols-2 gap-8 mt-8">
        <div>
          <div className="font-semibold">Kund</div>
          <div>{data.customer.name}</div>
          {data.customer.address1 && <div>{data.customer.address1}</div>}
          {data.customer.zipCity && <div>{data.customer.zipCity}</div>}
        </div>
        <div>
          <div className="font-semibold">Projekt</div>
          <div>{data.project?.name ?? "-"}</div>
        </div>
      </div>

      {/* Tabell */}
      <div className="mt-8 border-t">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-3">Beskrivning</th>
              <th className="text-right py-3 w-16">Antal</th>
              <th className="text-left py-3 w-20">Enhet</th>
              <th className="text-right py-3 w-28">à-pris</th>
              <th className="text-right py-3 w-20">Moms</th>
              <th className="text-right py-3 w-32">Radbelopp</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r, i) => {
              const rowExVat = r.qty * r.unitPrice;
              return (
                <tr key={i} className="border-b align-top">
                  <td className="py-3 pr-4">{r.description}</td>
                  <td className="py-3 text-right">{r.qty}</td>
                  <td className="py-3">{r.unit}</td>
                  <td className="py-3 text-right">{kr(r.unitPrice)} {currency}</td>
                  <td className="py-3 text-right">{r.vatRate}%</td>
                  <td className="py-3 text-right">{kr(rowExVat)} {currency}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Summering */}
      <div className="mt-6 ml-auto w-full max-w-sm">
        <div className="flex justify-between py-1">
          <div>Delsumma</div>
          <div>{kr(subTotal)} {currency}</div>
        </div>
        <div className="flex justify-between py-1">
          <div>Moms</div>
          <div>{kr(vatTotal)} {currency}</div>
        </div>
        <div className="flex justify-between py-2 border-t mt-2 text-lg font-semibold">
          <div>Att betala</div>
          <div>{kr(grandTotal)} {currency}</div>
        </div>
      </div>

      {/* Villkor (exempel) */}
      <div className="mt-10 text-xs leading-relaxed text-gray-700">
        <div className="font-semibold mb-1">Villkor</div>
        <ul className="list-disc pl-5 space-y-1">
          <li>Betalningsvillkor 15 dagar.</li>
          <li>Material debiteras enligt faktisk åtgång.</li>
          <li>Offerten är giltig t.o.m. angivet datum.</li>
        </ul>
      </div>
    </div>
  );
}
