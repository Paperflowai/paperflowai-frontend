// src/components/StartLink.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function StartLink() {
  const pathname = usePathname() ?? "/";

  // Dölj bara på START och CHAT (chatten har egen knapp)
  if (pathname.startsWith("/start") || pathname.startsWith("/chat")) return null;

  // Behandla både "/" och "/dashboard" som dashboard
  const isDashboard = pathname === "/" || pathname.startsWith("/dashboard");

  // Dashboard (mobil): nere till vänster. Övriga sidor (mobil): lite under headern.
  // Från sm och upp: alltid uppe till vänster.
  const position = isDashboard
    ? "left-4 bottom-4 sm:left-3 sm:bottom-auto sm:top-3"
    : "left-3 top-16 sm:top-3";

  return (
    <Link
      href="/start"
      className={`fixed z-50 ${position}
                  rounded-full shadow-lg border border-gray-200
                  bg-white/90 backdrop-blur
                  text-gray-700 hover:bg-white
                  px-3 py-2 text-xs sm:text-sm`}
      aria-label="Till START"
      title="Till START"
    >
      <span className="sm:hidden">←</span>
      <span className="hidden sm:inline">← START</span>
    </Link>
  );
}
