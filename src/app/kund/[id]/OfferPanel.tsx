"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Offer = {
  id: string | number;
  customer_id?: string | number;
  status?: string;
  data?: any;
  created_at?: string;
};

function swStatusLabel(s?: string) {
  const v = (s || "draft").toLowerCase();
  const map: Record<string, string> = {
    draft: "Utkast",
    sent: "Skickad",
    accepted: "Godkänd",
    rejected: "Nekad",
    canceled: "Avbruten",
  };
  return map[v] ?? v;
}
function fmt(iso?: string) {
  return iso ? new Date(iso).toLocaleString("sv-SE") : "—";
}

export default function OfferPanel({ customerId }: { customerId: string }) {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!customerId) return;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const res = await fetch(`/api/offers/list?customerId=${encodeURIComponent(customerId)}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const arr: Offer[] = Array.isArray(json)
          ? json
          : Array.isArray(json?.data)
          ? json.data
          : Array.isArray(json?.items)
          ? json.items
          : [];
        arr.sort(
          (a, b) =>
            new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        );
        setOffers(arr);
      } catch (e) {
        setErr("Kunde inte hämta offerter.");
      } finally {
        setLoading(false);
      }
    })();
  }, [customerId]);

  const latest = useMemo(() => offers[0] || null, [offers]);

  async function sendLatest() {
    if (!latest || (latest.status || "draft") !== "draft") return;
    setSending(true);
    setMsg("");
    try {
      const res = await fetch("/api/offers/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offerId: latest.id, status: "sent" }),
      });
      const json = await res.json();
      if (!res.ok || json?.ok !== true) {
        throw new Error(json?.error || "Misslyckades att skicka.");
      }
      // Uppdatera lokalt så panelen ändras direkt
      setOffers((prev) => {
        if (prev.length === 0) return prev;
        const [first, ...rest] = prev;
        return [{ ...first, status: "sent" }, ...rest];
      });
      setMsg("Offert skickad.");
    } catch (e: any) {
      setMsg(e?.message || "Kunde inte skicka.");
    } finally {
      setSending(false);
      setTimeout(() => setMsg(""), 2000);
    }
  }

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold">🧾 Offert</div>
        <span className="rounded-full bg-yellow-100 text-yellow-800 text-xs px-2 py-0.5">
          {latest ? swStatusLabel(latest.status) : "—"}
        </span>
      </div>

      {msg ? (
        <div className="mb-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
          {msg}
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-gray-500">Laddar…</p>
      ) : err ? (
        <p className="text-sm text-red-600">{err}</p>
      ) : latest ? (
        <>
          <p className="text-sm text-gray-600">
            Senaste offert: <span className="font-medium">{fmt(latest.created_at)}</span>
          </p>
          <div className="mt-3 flex gap-2">
            <Link
              href={`/preview/offer?customerId=${encodeURIComponent(customerId)}`}
              className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
            >
              Förhandsgranska
            </Link>
            <button
              type="button"
              disabled={(latest.status || "draft") !== "draft" || sending}
              title={
                sending
                  ? "Skickar…"
                  : (latest.status || "draft") !== "draft"
                  ? "Redan skickad/godkänd"
                  : ""
              }
              onClick={sendLatest}
              className="rounded-lg bg-black px-3 py-2 text-sm text-white disabled:opacity-40"
            >
              {sending ? "Skickar…" : "Skicka"}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-gray-600">Ingen offert skapad ännu.</p>
          <div className="mt-3">
            <Link
              href={`/preview/offer?customerId=${encodeURIComponent(customerId)}`}
              className="rounded-lg bg-black px-3 py-2 text-sm text-white"
            >
              Skapa ny offert
            </Link>
          </div>
        </>
      )}

     {/* Historik */}
  <div className="mt-4">
    <div className="text-sm text-gray-500 mb-1">Offertshistorik</div>
    {offers.length > 0 && (
      <ul className="divide-y">
        {offers.map((o) => (
          <li
            key={o.id}
            className="py-2 text-sm flex items-center justify-between"
          >
            ...
          </li>
        ))}
      </ul>
    )}
  </div>
    </div>
  );
}
