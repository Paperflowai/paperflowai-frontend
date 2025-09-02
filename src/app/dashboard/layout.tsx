// src/app/dashbord/layout.tsx
"use client";

import SavingsBadge from "@/components/SavingsBadge";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen bg-white">
      {/* Här visas alla undersidor */}
      {children}

      {/* Spar-badge längst ner, följer alla sidor i dashbord */}
      <SavingsBadge className="fixed bottom-3 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-sm" />
    </div>
  );
}
