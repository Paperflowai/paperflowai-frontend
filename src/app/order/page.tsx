// src/app/order/page.tsx
import Link from "next/link";
import Image from "next/image";
import OpenAccountingCta from "@/components/OpenAccountingCta";

export default function OrderPage() {
  return (
    <main className="min-h-dvh bg-gradient-to-br from-indigo-800 via-purple-700 to-fuchsia-700 text-white">
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

        {/* Visa bara för inloggad */}
        <OpenAccountingCta />
      </div>
      
      <div className="max-w-screen-lg mx-auto px-4 py-10 space-y-8">

        {/* Logga överst – samma som på offert- och bokföringssidan */}
        <div className="flex justify-center">
          <Image
            src="/paperflowai.png"
            alt="PaperflowAI"
            width={280}
            height={86}
            priority
            className="h-12 sm:h-14 md:h-16 lg:h-20 w-auto"
          />
        </div>

        <header className="text-center space-y-2">
          <h1 className="text-3xl md:text-4xl font-semibold">Orderbekräftelse på sekunder</h1>
          <p className="text-white/90">Ett klick från offert → order. Tydligt för kunden, enkelt för dig.</p>
        </header>

        <section className="grid md:grid-cols-3 gap-4">
          {[
            ["Import från offert", "All info följer med – kund, rader, priser och villkor."],
            ["Material & tider", "Lägg till materiallistor och planerade timmar direkt i ordern."],
            ["Signering & spårning", "Digitalt godkännande och historik – allt sparas lokalt tills export."],
          ].map(([title, body]) => (
            <div
              key={title}
              className="
                rounded-2xl p-5
                border backdrop-blur-sm
                bg-white/5 border-white/10 shadow-sm
                sm:bg-white/10 sm:border-white/20 sm:shadow-md
                transition-colors
              "
            >
              <h3 className="font-semibold text-lg mb-1">{title}</h3>
              <p className="text-white/90">{body}</p>
            </div>
          ))}
        </section>

        <section className="rounded-2xl p-6 border backdrop-blur-sm bg-white/5 border-white/10 sm:bg-white/10 sm:border-white/20">
          <h2 className="text-2xl font-semibold mb-3">Så gör du (1–2–3)</h2>
          <ol className="list-decimal ml-5 space-y-2 text-white/95">
            <li>Öppna din godkända offert och välj <em>Skapa order</em>.</li>
            <li>Komplettera med material/planering vid behov och spara.</li>
            <li>Skicka orderbekräftelsen – kunden bekräftar digitalt.</li>
          </ol>
        </section>

        <div className="flex justify-center">
          <Link
            href="/dashboard"
            className="px-5 py-3 rounded-xl border border-white/70 hover:bg-white hover:text-black transition"
          >
            Skapa order nu
          </Link>
        </div>
      </div>
    </main>
  );
}
