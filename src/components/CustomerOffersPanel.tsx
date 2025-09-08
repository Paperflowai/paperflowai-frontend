// src/components/CustomerOffersPanel.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import type { Customer, Offer } from "@/types/offert";

type Props = {
  customerId: string; // id från /kund/[id]
};

type StoreCustomer = Customer & { id: string };

export default function CustomerOffersPanel({ customerId }: Props) {
  const [customers, setCustomers] = useState<StoreCustomer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("paperflow_customers_v1");
      const parsed = raw ? (JSON.parse(raw) as StoreCustomer[]) : [];
      setCustomers(parsed);
    } catch {
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const customer = useMemo(
    () => customers.find((c) => String(c.id) === String(customerId)),
    [customers, customerId]
  );

  if (loading) {
    return (
      <div className="w-full bg-white/80 border border-gray-200 rounded-2xl shadow-sm p-4">
        <h3 className="text-base font-semibold mb-2">Offerter</h3>
        <p className="text-sm text-gray-500">Laddar…</p>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="w-full bg-white/80 border border-gray-200 rounded-2xl shadow-sm p-4">
        <h3 className="text-base font-semibold mb-2">Offerter</h3>
        <p className="text-sm text-gray-500">
          Hittar ingen kund i localStorage för id <span className="font-mono">{customerId}</span>.
        </p>
      </div>
    );
  }

  const offers = customer.offers ?? [];

  return (
    <div className="w-full bg-white/80 border border-gray-200 rounded-2xl shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <span>🧾</span> Offerter (sparade från chatten)
        </h3>
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
          {offers.length} st
        </span>
      </div>

      {offers.length === 0 ? (
        <p className="text-sm text-gray-500">
          Inga offerter sparade ännu för denna kund. Gå till Chat och klicka “Spara till kundkort”.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {offers.map((o: Offer) => (
            <li key={o.offerId} className="py-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{o.offerId}</span>
                  <span className="text-xs text-gray-500">({o.date})</span>
                </div>
                <div className="text-sm text-gray-600 truncate">
                  {o.items?.[0]?.name ?? "Offert"} — {o.currency} {formatMoney(o.total)}
                </div>
                {o.validUntil && (
                  <div className="text-xs text-gray-500">Giltig t.o.m. {o.validUntil}</div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {/* Vi kopplar "Skapa orderbekräftelse" i nästa steg */}
                <button
                  type="button"
                  className="text-xs px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
                  onClick={() => alert(`(Nästa steg) Skapa orderbekräftelse från ${o.offerId}`)}
                >
                  Skapa orderbekräftelse
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatMoney(n: number) {
  try {
    return new Intl.NumberFormat("sv-SE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  } catch {
    return String(n);
  }
}
