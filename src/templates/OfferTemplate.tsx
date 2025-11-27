// src/templates/OfferTemplate.tsx
import React from "react";

export type OfferRow = {
  text: string;
  qty: number;
  unit: string;
  price: number; // à-pris exkl. moms
  vat: number;   // t.ex. 25 för 25%
};

type OfferTemplateProps = {
  // Företag
  companyName: string;
  companyOrgNr: string;
  companyAddress: string; // använd \n för radbrytningar
  companyEmail: string;
  companyPhone: string;

  // Kund & metadata
  customerName: string;
  customerAddress: string; // använd \n för radbrytningar
  offerNumber: string;
  offerDate: string;  // YYYY-MM-DD eller valfritt datumformat
  validUntil: string; // YYYY-MM-DD eller valfritt datumformat
  projectName?: string;

  // Rader + texter
  rows: OfferRow[];
  notes?: string;
  terms?: string[];
};

function sek(n: number) {
  return new Intl.NumberFormat("sv-SE", {
    style: "currency",
    currency: "SEK",
    minimumFractionDigits: 2,
  }).format(n);
}

export default function OfferTemplate(props: OfferTemplateProps) {
  const {
    companyName,
    companyOrgNr,
    companyAddress,
    companyEmail,
    companyPhone,
    customerName,
    customerAddress,
    offerNumber,
    offerDate,
    validUntil,
    projectName,
    rows,
    notes,
    terms,
  } = props;

  const subTotal = rows.reduce((sum, r) => sum + r.qty * r.price, 0);
  const vatTotal = rows.reduce(
    (sum, r) => sum + (r.qty * r.price) * (r.vat / 100),
    0
  );
  const grandTotal = subTotal + vatTotal;

  return (
    <div className="max-w-4xl mx-auto bg-white">
      {/* TOPPSEKTION / HEADER-KORT */}
      <div className="rounded-2xl ring-1 ring-gray-200 overflow-hidden mb-8">
        <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white px-6 py-5 flex items-center justify-between">
          <div className="text-xl sm:text-2xl font-semibold">{companyName}</div>
          <div className="text-sm sm:text-base font-semibold tracking-wider">
            OFFERT
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
          <div>
            <div className="text-sm text-gray-500">Kund</div>
            <div className="font-medium">{customerName}</div>
            <div className="whitespace-pre-line text-sm text-gray-700">
              {customerAddress}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
            <div className="text-gray-500">Offertnr</div>
            <div className="font-medium">{offerNumber}</div>

            <div className="text-gray-500">Datum</div>
            <div className="font-medium">{offerDate}</div>

            <div className="text-gray-500">Giltig till</div>
            <div className="font-medium">{validUntil}</div>

            <div className="text-gray-500">Projekt</div>
            <div className="font-medium">{projectName ?? "—"}</div>
          </div>
        </div>

        <div className="px-6 pb-6">
          <div className="text-sm text-gray-500">Företag</div>
          <div className="font-medium">{companyName}</div>
          <div className="whitespace-pre-line text-sm text-gray-700">
            {companyAddress}
          </div>
          <div className="text-sm text-gray-700">
            {companyEmail} · {companyPhone} · Org.nr: {companyOrgNr}
          </div>
        </div>
      </div>

      {/* TABELL-KORT */}
      <div className="rounded-2xl ring-1 ring-gray-200 overflow-hidden">
        <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Specifikation</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-600">
                <th className="text-left px-6 py-3 font-semibold">Beskrivning</th>
                <th className="text-right px-4 py-3 font-semibold whitespace-nowrap">
                  Antal
                </th>
                <th className="text-left px-4 py-3 font-semibold whitespace-nowrap">
                  Enhet
                </th>
                <th className="text-right px-4 py-3 font-semibold whitespace-nowrap">
                  à-pris
                </th>
                <th className="text-right px-4 py-3 font-semibold whitespace-nowrap">
                  Moms
                </th>
                <th className="text-right px-6 py-3 font-semibold whitespace-nowrap">
                  Radbelopp
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const rowSum = r.qty * r.price; // exkl. moms
                return (
                  <tr key={i} className="border-t border-gray-200 align-top">
                    <td className="px-6 py-3 text-gray-900">{r.text}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {r.qty}
                    </td>
                    <td className="px-4 py-3">{r.unit}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {sek(r.price)}
                    </td>
                    <td className="px-4 py-3 text-right">{r.vat}%</td>
                    <td className="px-6 py-3 text-right font-medium tabular-nums">
                      {sek(rowSum)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* SUMMOR */}
        <div className="p-6 border-t border-gray-200">
          <div className="flex flex-col sm:flex-row gap-6 sm:gap-12 justify-end text-sm">
            <div className="w-full sm:w-80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Delsumma</span>
                <span className="font-medium tabular-nums">{sek(subTotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Moms</span>
                <span className="font-medium tabular-nums">{sek(vatTotal)}</span>
              </div>
              <div className="h-px bg-gray-200 my-2" />
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-900">Att betala</span>
                <span className="font-semibold tabular-nums">
                  {sek(grandTotal)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* NOTERINGAR & VILLKOR */}
      {(notes || (terms && terms.length > 0)) && (
        <div className="mt-8 grid md:grid-cols-2 gap-6">
          {notes && (
            <div className="rounded-2xl ring-1 ring-gray-200 p-6">
              <h4 className="font-semibold mb-2">Noteringar</h4>
              <p className="text-sm text-gray-700 whitespace-pre-line">{notes}</p>
            </div>
          )}
          {terms && terms.length > 0 && (
            <div className="rounded-2xl ring-1 ring-gray-200 p-6">
              <h4 className="font-semibold mb-2">Villkor</h4>
              <ul className="text-sm text-gray-700 list-disc pl-5 space-y-1">
                {terms.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
