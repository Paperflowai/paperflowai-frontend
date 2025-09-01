// src/app/page.tsx
"use client";

import Link from "next/link";
import Image from "next/image";

export default function HomePage() {
  return (
    <main className="relative min-h-dvh w-full overflow-x-hidden">
      {/* Videobakgrund – synlig på alla skärmar */}
      <video
        className="absolute inset-0 w-full h-full object-cover z-0 pointer-events-none select-none"
        src="/video/intro.mp4.mp4"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden="true"
      />

      {/* Innehåll ovanpå */}
      <div className="relative z-10 min-h-dvh w-full bg-black/10 flex flex-col">
        {/* Topprad */}
        <div className="w-full px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center gap-2 bg-black/50 backdrop-blur-sm">
          <Image
            src="/paperflowai.png"
            alt="PaperflowAI"
            width={360}
            height={110}
            priority
            className="h-14 sm:h-16 md:h-20 lg:h-24 w-auto"
          />
          <nav className="flex flex-wrap gap-2 sm:gap-3 justify-end max-w-full">
            <Link href="/offert" className="text-white hover:text-black border border-white hover:bg-white px-3 py-1 rounded text-xs sm:text-sm transition">Offert</Link>
            <Link href="/order" className="text-white hover:text-black border border-white hover:bg-white px-3 py-1 rounded text-xs sm:text-sm transition">Order</Link>
            <Link href="/faktura" className="text-white hover:text-black border border-white hover:bg-white px-3 py-1 rounded text-xs sm:text-sm transition">Faktura</Link>
            <Link href="/bokforing" className="text-white hover:text-black border border-white hover:bg-white px-3 py-1 rounded text-xs sm:text-sm transition">Bokföring</Link>
            <Link href="/tidsrapport" className="text-white hover:text-black border border-white hover:bg-white px-3 py-1 rounded text-xs sm:text-sm transition">Tidsrapport</Link>
            <Link href="/login" className="text-white hover:text-black border border-white hover:bg-white px-4 py-1 rounded text-xs sm:text-sm transition">Logga in</Link>
          </nav>
        </div>

        {/* Hero */}
        <div className="flex flex-col items-center justify-start mt-4 px-4 text-center">
          <h1 className="text-white text-lg sm:text-2xl md:text-3xl font-semibold mb-2 leading-snug">
            Automatisera hela flödet – från offert till klar bokföring på minuter 
          </h1>
          <p className="text-white text-sm sm:text-base md:text-lg max-w-prose">
            PaperflowAI gör jobbet – du sparar TID och PENGAR.
          </p>
        </div>
      </div>
    </main>
  );
}
