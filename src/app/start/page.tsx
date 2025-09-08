// src/app/start/page.tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function StartPage() {
  const router = useRouter();
  const [kid, setKid] = useState("");

  const Card = ({
    title,
    desc,
    href,
  }: {
    title: string;
    desc: string;
    href: string;
  }) => (
    <Link
      href={href}
      className="block rounded-2xl border border-gray-200 bg-white/80 p-5 shadow-sm hover:shadow transition"
    >
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-sm text-gray-600 mt-1">{desc}</p>
    </Link>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">START</h1>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card
            title="💬 Chat / Offertskapare"
            desc="Skapa offerter med GPT."
            href="/chat"
          />
          <Card
            title="🧾 Fota kvitto"
            desc="Ladda upp/fota kvitton till bokföringen."
            href="/fota-kvitto"
          />
          <Card
            title="📇 Kundregister"
            desc="Visa och hantera alla kunder."
            href="/dashboard"
          />
          <div className="rounded-2xl border border-gray-200 bg-white/80 p-5 shadow-sm">
            <h3 className="text-lg font-semibold">📁 Kundkort</h3>
            <p className="text-sm text-gray-600 mt-1">Öppna ett specifikt kundkort.</p>
            <div className="mt-3 flex items-center gap-2">
              <input
                value={kid}
                onChange={(e) => setKid(e.target.value)}
                placeholder="Ange kund-ID, t.ex. 1"
                className="border rounded-md px-3 py-2 text-sm w-40"
              />
              <button
                onClick={() => router.push(`/dashboard/kund/${kid || "1"}`)}
                className="px-3 py-2 text-sm rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
              >
                Öppna
              </button>
            </div>
          </div>
          <Card
            title="⏱️ Tidsrapport"
            desc="Registrera arbetstid."
            href="/tidsrapport/rapport"
          />
          <Card
            title="💳 Betala fakturor"
            desc="Hantera inkommande betalningar."
            href="/bills"
          />
          <Card
            title="📚 Bokföring"
            desc="Översikt och export till bokföringssystem."
            href="/dashboard/bookkeepingboard"
          />
        </div>
      </div>
    </div>
  );
}
