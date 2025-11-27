// src/app/tidsrapport/page.tsx
"use client";

import Link from "next/link";
import OpenAccountingCta from "@/components/OpenAccountingCta";

export default function TidsrapportPage() {
  return (
    <main className="min-h-dvh w-full bg-gradient-to-br from-purple-600 to-pink-500 text-white flex flex-col">
      {/* Tillbaka-knappar */}
      <div className="p-4 flex justify-between">
        <div className="flex gap-2">
          <Link
            href="/"
            className="bg-black/30 hover:bg-black/50 px-4 py-2 rounded text-sm"
          >
            ← Tillbaka
          </Link>
          <Link
            href="/start"
            className="bg-green-600/30 hover:bg-green-600/50 px-4 py-2 rounded text-sm"
          >
            🏠 Till Start
          </Link>
        </div>

        {/* Visas bara när användaren är inloggad */}
        <OpenAccountingCta />
      </div>

      {/* Rubrik */}
      <div className="flex flex-col items-center text-center mt-8 px-4">
        <h1 className="text-2xl md:text-4xl font-bold mb-4">
          Tidsrapportering – smart & automatisk
        </h1>
        <p className="max-w-2xl text-sm md:text-base">
          Spåra tid, hantera projekt och få insikter – allt på ett ställe.
        </p>
      </div>

      {/* Kort-rutor */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 px-6 md:px-12 mt-10">
        <div className="bg-white/10 p-6 rounded-2xl shadow-lg">
          <h2 className="font-semibold text-lg mb-2">⏱️ Smart timer</h2>
          <p className="text-sm">
            Automatisk paus vid inaktivitet. Flera timers samtidigt. Fungerar
            offline.
          </p>
        </div>

        <div className="bg-white/10 p-6 rounded-2xl shadow-lg">
          <h2 className="font-semibold text-lg mb-2">📊 Projektbudgetar</h2>
          <p className="text-sm">
            Följ upp kostnader och lönsamhet per projekt. Timpriser och
            budgetvarningar.
          </p>
        </div>

        <div className="bg-white/10 p-6 rounded-2xl shadow-lg">
          <h2 className="font-semibold text-lg mb-2">📑 Rapporter & analys</h2>
          <p className="text-sm">
            Visuella grafer, trender och export till Excel/PDF.
          </p>
        </div>
      </div>

      {/* Funktioner & hur det fungerar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-6 md:px-12 mt-12 mb-12">
        <div className="bg-white/10 p-6 rounded-2xl shadow-lg">
          <h3 className="font-semibold text-lg mb-2">✨ Funktioner</h3>
          <ul className="text-sm space-y-2 list-disc pl-5">
            <li>Avancerad timer – auto-paus, flera timers, offline-stöd</li>
            <li>Analytics – visuella grafer och produktivitetstrender</li>
            <li>Projekthantering – budgetar, timpriser, kostnadsspårning</li>
            <li>Kalenderintegration – Google/Outlook-synk</li>
            <li>Användarroller – chef/anställd med godkännande-flöde</li>
            <li>Export – PDF, Excel, CSV för alla rapporter</li>
          </ul>
        </div>

        <div className="bg-white/10 p-6 rounded-2xl shadow-lg">
          <h3 className="font-semibold text-lg mb-2">⚙️ Så fungerar det</h3>
          <ol className="text-sm space-y-2 list-decimal pl-5">
            <li>Starta timer för kund/projekt eller lägg till tid manuellt</li>
            <li>Systemet pausar automatiskt vid inaktivitet</li>
            <li>Skicka in veckorapporter för godkännande</li>
            <li>Chefen godkänner och markerar som fakturerad</li>
            <li>Få detaljerade rapporter och exportera data</li>
          </ol>
        </div>
      </div>
    </main>
  );
}
