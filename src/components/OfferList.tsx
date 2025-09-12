"use client";
import { useEffect, useState } from "react";
type Offer = {
  id: string; title: string | null; amount: number | null; currency: string | null;
  file_url: string; needs_print: boolean; created_at: string;
};
export default function OfferList({ customerId }: { customerId: string }) {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let ok = true;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/offers/list?customerId=${encodeURIComponent(customerId)}`, { cache: "no-store" });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || "Kunde inte hämta offerter");
        if (ok) setOffers(data.offers ?? []);
      } catch (e:any) { if (ok) setError(e.message || "Något gick fel"); }
      finally { if (ok) setLoading(false); }
    })();
    return () => { ok = false; };
  }, [customerId]);
  if (!customerId) return <div className="text-red-600">Saknar customerId</div>;
  if (loading) return <div>Laddar offerter…</div>;
  if (error) return <div className="text-red-600">Fel: {error}</div>;
  if (offers.length === 0) return <div>Inga offerter ännu.</div>;
  return (
    <div className="space-y-3">
      {offers.map(o => (
        <div key={o.id} className="border rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-semibold">{o.title ?? "Offert"}</div>
              <div className="text-sm text-gray-600">
                {(o.amount ?? 0)} {(o.currency ?? "SEK")} · {new Date(o.created_at).toLocaleString()}
              </div>
              {o.needs_print && (
                <span className="inline-block mt-1 text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                  Markerad för utskrift
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <button className="px-3 py-1.5 rounded-lg border hover:bg-gray-50"
                onClick={() => window.open(o.file_url, "_blank")}>Öppna / skriv ut</button>
              <a className="px-3 py-1.5 rounded-lg border hover:bg-gray-50" href={o.file_url} download>Ladda ner</a>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}