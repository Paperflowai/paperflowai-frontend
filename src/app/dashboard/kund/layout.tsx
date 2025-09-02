// src/app/kund/layout.tsx
"use client";

import SavingsBadge from "../../../components/SavingsBadge";

export default function KundLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen bg-white">
      {children}

      {/* Spar-badge längst ner, följer alla kundsidor */}
      <SavingsBadge className="fixed bottom-3 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-sm" />
    </div>
  );
}
