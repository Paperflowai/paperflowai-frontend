// src/app/tidsrapport/page.tsx
import Link from "next/link";
import Image from "next/image";

export default function TidsrapportPage() {
  return (
    <main className="min-h-dvh bg-gradient-to-br from-indigo-800 via-purple-700 to-fuchsia-700 text-white">
      <div className="max-w-screen-lg mx-auto px-4 py-10 space-y-8">
        {/* Logga överst */}
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
          <h1 className="text-3xl md:text-4xl font-semibold">Tidsrapportering – smart & automatisk</h1>
          <p className="text-white/90">Spåra tid, hantera projekt och få insikter – allt på ett ställe.</p>
        </header>

        <section className="grid md:grid-cols-3 gap-4">
          {[
            ["Smart timer", "Automatisk paus vid inaktivitet. Flera timers samtidigt. Fungerar offline."],
            ["Projektbudgetar", "Följ upp kostnader och lönsamhet per projekt. Timpriser och budgetvarningar."],
            ["Rapporter & analys", "Visuella grafer, trender och export till Excel/PDF. Produktivitetsinsikter."],
          ].map(([title, body]) => (
            <div
              key={title}
              className="
                rounded-2xl p-5
                border backdrop-blur-sm
                bg-white/5  border-white/10 shadow-sm
                sm:bg-white/10 sm:border-white/20 sm:shadow-md
                transition-colors
              "
            >
              <h3 className="font-semibold text-lg mb-1">{title}</h3>
              <p className="text-white/90">{body}</p>
            </div>
          ))}
        </section>

        <section className="grid md:grid-cols-2 gap-6">
          <div className="rounded-2xl p-6 border backdrop-blur-sm bg-white/5 border-white/10 sm:bg-white/10 sm:border-white/20">
            <h2 className="text-2xl font-semibold mb-3">Funktioner</h2>
            <ul className="space-y-2 text-white/95">
              <li>⏱️ <strong>Avancerad timer</strong> – Auto-paus, flera timers, offline-stöd</li>
              <li>📊 <strong>Analytics</strong> – Visuella grafer och produktivitetstrender</li>
              <li>📋 <strong>Projekthantering</strong> – Budgetar, timpriser, kostnadsspårning</li>
              <li>📅 <strong>Kalenderintegration</strong> – Google/Outlook synk och smarta förslag</li>
              <li>👥 <strong>Användarroller</strong> – Chef/anställd med godkännandeflöde</li>
              <li>📤 <strong>Export</strong> – PDF, Excel, CSV för alla rapporter</li>
              <li>📱 <strong>PWA</strong> – Installera som app, fungerar offline</li>
            </ul>
          </div>

          <div className="rounded-2xl p-6 border backdrop-blur-sm bg-white/5 border-white/10 sm:bg-white/10 sm:border-white/20">
            <h2 className="text-2xl font-semibold mb-3">Så fungerar det</h2>
            <ol className="list-decimal ml-5 space-y-2 text-white/95">
              <li>Starta timer för kund/projekt eller lägg till tid manuellt</li>
              <li>Systemet pausar automatiskt vid inaktivitet</li>
              <li>Skicka in veckorapporter för godkännande</li>
              <li>Chefen godkänner och markerar som fakturerad</li>
              <li>Få detaljerade rapporter och exportera data</li>
            </ol>
          </div>
        </section>

        <section className="rounded-2xl p-6 border backdrop-blur-sm bg-white/5 border-white/10 sm:bg-white/10 sm:border-white/20">
          <h2 className="text-2xl font-semibold mb-3">Perfekt för</h2>
          <div className="grid sm:grid-cols-2 gap-4 text-white/95">
            <div>
              <h4 className="font-semibold mb-2">🏢 Företag & team</h4>
              <ul className="space-y-1 text-sm">
                <li>• Konsultbolag och byråer</li>
                <li>• IT-utvecklare och designers</li>
                <li>• Projektbaserade verksamheter</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">👤 Frilansare</h4>
              <ul className="space-y-1 text-sm">
                <li>• Spåra tid per kund automatiskt</li>
                <li>• Exportera för fakturering</li>
                <li>• Få insikter om produktivitet</li>
              </ul>
            </div>
          </div>
        </section>

        <div className="flex justify-center">
          <Link
            href="/time"
            className="px-5 py-3 rounded-xl border border-white/70 hover:bg-white hover:text-black transition"
          >
            Öppna tidsrapportering
          </Link>
        </div>
      </div>
    </main>
  );
}
