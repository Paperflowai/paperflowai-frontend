// src/app/preview/offer/page.tsx
"use client";

import { Suspense } from "react";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type Offer = {
  id: string | number;
  customer_id?: string | number;
  status?: string;
  file_url?: string | null;
  created_at?: string;
};

export default function OfferPreviewPage() {
  return (
    <Suspense fallback={<OfferPreviewFallback text="Laddar förhandsgranskning…" />}>
      <OfferPreviewInner />
    </Suspense>
  );
}

function OfferPreviewFallback({
  text,
  textClass = "text-sm text-gray-600",
}: {
  text: string;
  textClass?: string;
}) {
  return (
    <main className="min-h-dvh bg-gray-100 p-6">
      <div className="max-w-3xl mx-auto bg-white p-6 rounded-xl shadow-sm">
        <p className={textClass}>{text}</p>
      </div>
    </main>
  );
}

function OfferPreviewInner() {
  const searchParams = useSearchParams();
  const customerId = searchParams.get("customerId") || "";

  const [latestOffer, setLatestOffer] = useState<Offer | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!customerId) {
      setErr("Ingen kund vald. Öppna förhandsgranskningen via kundkortet.");
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      setErr("");
      try {
        const res = await fetch(
          `/api/offers/list?customerId=${encodeURIComponent(customerId)}`,
          { cache: "no-store" }
        );
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
            new Date(b.created_at || 0).getTime() -
            new Date(a.created_at || 0).getTime()
        );

        const first = arr[0] || null;
        setLatestOffer(first || null);
        if (!first || !first.file_url) {
          setErr(
            "Ingen PDF-offert hittades för den här kunden. Skapa en offert via GPT först."
          );
        }
      } catch (e) {
        console.error(e);
        setErr("Kunde inte hämta offert.");
      } finally {
        setLoading(false);
      }
    })();
  }, [customerId]);

  if (loading) {
    return <OfferPreviewFallback text="Laddar förhandsgranskning…" />;
  }

  if (err) {
    return (
      <OfferPreviewFallback
        text={err}
        textClass="text-sm text-red-600"
      />
    );
  }

  if (!latestOffer || !latestOffer.file_url) {
    return (
      <OfferPreviewFallback text="Ingen PDF-offert hittades för den här kunden." />
    );
  }

  return (
    <main className="min-h-dvh bg-gray-100 p-6">
      <div className="max-w-5xl mx-auto bg-white p-4 rounded-xl shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold">Förhandsgranska offert</h1>
          <a
            href={latestOffer.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm rounded-lg bg-black text-white px-3 py-2"
          >
            Öppna som PDF i ny flik
          </a>
        </div>
        <div className="border rounded-lg overflow-hidden h-[80vh]">
          <iframe
            src={latestOffer.file_url}
            className="w-full h-full"
            title="Offert PDF"
          />
        </div>
      </div>
    </main>
  );
}
