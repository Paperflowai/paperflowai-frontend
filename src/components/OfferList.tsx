"use client";

import { useEffect, useState, useCallback } from "react";

type Offer = {
  id: string;
  title: string | null;
  amount: number | null;
  currency: string | null;
  file_url: string;
  created_at: string;
  needs_print?: boolean | null;
  status?: 'sent' | 'order_confirmed' | null;
};

export default function OfferList({ customerId, customerEmail, onEmailUpdate }: { customerId: string; customerEmail?: string; onEmailUpdate?: (email: string) => void }) {
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/offers/list?customerId=${encodeURIComponent(customerId)}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) setOffers(json.offers ?? []);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Fel vid hämtning");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [customerId]);

  const handleDelete = useCallback(async (offerId: string) => {
    if (!confirm("Radera den här offerten?")) return;
    try {
      const res = await fetch("/api/offers/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offerId, customerId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setOffers(prev => (prev ?? []).filter(o => o.id !== offerId));
    } catch (e: any) {
      alert(`Kunde inte radera: ${e?.message ?? "okänt fel"}`);
    }
  }, [customerId]);

  const handleSendToCustomer = useCallback(async (offerId: string, fileUrl: string) => {
    let emailToUse = customerEmail;

    // Om ingen e-postadress finns, fråga användaren
    if (!emailToUse || emailToUse.trim() === "") {
      const manualEmail = prompt("Ingen e-postadress registrerad. Ange kundens e-postadress:");
      if (!manualEmail) return;
      
      if (!manualEmail.includes("@")) {
        alert("Ange en giltig e-postadress");
        return;
      }
      
      emailToUse = manualEmail;
      
      // Spara den nya e-postadressen i kundkortet
      if (onEmailUpdate) {
        onEmailUpdate(manualEmail);
      }
    }

    try {
      const res = await fetch("/api/sendEmail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: emailToUse,
          subject: `Din offert från oss`,
          text: `Hej!\n\nHär kommer din offert.\n\nLänk: ${fileUrl}\n\nMed vänliga hälsningar`,
          offerId,
          customerId
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      // Uppdatera status för offerten i databasen
      await fetch("/api/offers/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offerId, customerId, status: 'sent' }),
      });
      
      // Uppdatera status för offerten lokalt
      setOffers(prev => prev?.map(o => 
        o.id === offerId ? { ...o, status: 'sent' as const } : o
      ) ?? []);
      
      alert(`Offert skickad till ${emailToUse}!`);
    } catch (e: any) {
      alert(`Kunde inte skicka: ${e?.message ?? "okänt fel"}`);
    }
  }, [customerId, customerEmail, onEmailUpdate]);

  const handleCreateOrderConfirmation = useCallback(async (offerId: string) => {
    if (!confirm("Skapa orderbekräftelse för denna offert?")) return;

    try {
      const res = await fetch("/api/offers/create-order-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offerId, customerId }),
      });
      
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      // Uppdatera status för offerten
      setOffers(prev => prev?.map(o => 
        o.id === offerId ? { ...o, status: 'order_confirmed' as const } : o
      ) ?? []);
      
      alert("Orderbekräftelse skapad!");
    } catch (e: any) {
      alert(`Kunde inte skapa orderbekräftelse: ${e?.message ?? "okänt fel"}`);
    }
  }, [customerId]);

  if (loading) return <div className="text-sm text-gray-500">Laddar offerter…</div>;
  if (error)   return <div className="text-sm text-red-600">Fel: {error}</div>;
  if (!offers || offers.length === 0) {
    return <div className="text-sm text-gray-500">Inga offerter ännu.</div>;
  }

  return (
    <div className="space-y-3">
      {offers.map((o) => (
        <div key={o.id} className="border rounded-lg p-3 relative">
          {/* Papperskorg-ikon för mobil */}
          <button
            onClick={() => handleDelete(o.id)}
            className="absolute top-2 right-2 p-1 text-red-600 hover:text-red-800 md:hidden"
            title="Radera offert"
          >
            🗑️
          </button>
          
          <div className="space-y-2 pr-8 md:pr-0">
            <div className="space-y-0.5">
              <div className="font-medium text-sm flex items-center gap-2">
                {o.title ?? "Offert"} • {o.amount ?? 0} {o.currency ?? "SEK"}
                {o.status === 'order_confirmed' && <span className="text-green-600 text-xs">✓ Klar</span>}
                {o.status === 'sent' && <span className="text-orange-600 text-xs">⚠ Skickad</span>}
                {!o.status && <span className="text-red-600 text-xs">✗ Ej skickad</span>}
              </div>
              <div className="text-xs text-gray-500">
                Skapad: {new Date(o.created_at).toLocaleString()}
                {o.needs_print ? " • Markerad för utskrift" : ""}
              </div>
            </div>
            
            {/* Knappar - mindre på mobil */}
            <div className="flex flex-wrap gap-1.5">
              <a
                href={o.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2 py-1 rounded bg-blue-600 text-white text-xs flex-1 min-w-0 text-center"
              >
                Öppna
              </a>
              <a
                href={o.file_url}
                download
                className="px-2 py-1 rounded border text-xs flex-1 min-w-0 text-center"
              >
                Ladda ner
              </a>
              <button
                onClick={() => handleSendToCustomer(o.id, o.file_url)}
                className="px-2 py-1 rounded bg-green-600 text-white text-xs flex-1 min-w-0"
              >
                📧 Skicka
              </button>
              {o.status === 'sent' && (
                <button
                  onClick={() => handleCreateOrderConfirmation(o.id)}
                  className="px-2 py-1 rounded bg-blue-600 text-white text-xs flex-1 min-w-0"
                >
                  📋 Orderbekräftelse
                </button>
              )}
              {/* Desktop radera-knapp */}
              <button
                onClick={() => handleDelete(o.id)}
                className="hidden md:block px-2 py-1 rounded border border-red-600 text-red-700 text-xs flex-1 min-w-0"
              >
                Radera
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}