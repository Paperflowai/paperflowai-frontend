"use client";
import { useEffect, useState } from "react";

type Card = {
  id: string;
  name?: string | null;
  orgnr?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  zip?: string | null;
  city?: string | null;
  country?: string | null;
  updated_at?: string | null;
};

export default function CustomerCardInfo({ customerId }: { customerId: string }) {
  const [card, setCard] = useState<Card | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/customer-cards/get?customerId=${encodeURIComponent(customerId)}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) setCard(json.card ?? null);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Fel vid hämtning");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [customerId]);

  if (loading) return <div className="text-sm text-gray-500">Hämtar kunduppgifter…</div>;
  if (error)   return <div className="text-sm text-red-600">Fel: {error}</div>;
  if (!card)   return <div className="text-sm text-gray-500">Inga kunduppgifter sparade ännu.</div>;

  return (
    <div className="rounded-lg border bg-white p-3 text-sm">
      <div className="font-semibold mb-2">Kunduppgifter</div>
      <div className="grid grid-cols-1 gap-1">
        <div><span className="text-gray-500">Namn:</span> {card.name ?? "-"}</div>
        <div><span className="text-gray-500">Org.nr:</span> {card.orgnr ?? "-"}</div>
        <div><span className="text-gray-500">E-post:</span> {card.email ?? "-"}</div>
        <div><span className="text-gray-500">Telefon:</span> {card.phone ?? "-"}</div>
        <div><span className="text-gray-500">Adress:</span> {card.address ?? "-"}</div>
        <div><span className="text-gray-500">Postnr:</span> {card.zip ?? "-"}</div>
        <div><span className="text-gray-500">Ort:</span> {card.city ?? "-"}</div>
        <div><span className="text-gray-500">Land:</span> {card.country ?? "-"}</div>
      </div>
    </div>
  );
}
