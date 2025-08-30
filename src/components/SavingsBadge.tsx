// src/components/SavingsBadge.tsx
"use client";

import { useEffect, useState } from "react";
import { getSummary, DEFAULT_HOURLY_RATE_SEK } from "../lib/savings";
import { getHourlyRate } from "../lib/settings";

function toHM(totalMinutes: number) {
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  return { h, m };
}

export default function SavingsBadge({
  hourlyRateSEK = DEFAULT_HOURLY_RATE_SEK,
  className = "",
}: {
  hourlyRateSEK?: number;
  className?: string;
}) {
  const [minutes, setMinutes] = useState(0);
  const [cost, setCost] = useState(0);

  // 👇 Fixar hydration: rendera först när komponenten är monterad i klienten
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const refresh = () => {
    const s = getSummary({ hourlyRateSEK: getHourlyRate() });
    setMinutes(s.totalMinutes);
    setCost(s.totalCostSEK);
  };

  useEffect(() => {
    if (!mounted) return; // säkerhet, kör först när vi är monterade
    refresh();
    const onChange = () => refresh();
    window.addEventListener("pf:savings:changed", onChange);
    window.addEventListener("pf:settings:hourlyrate", onChange);
    return () => {
      window.removeEventListener("pf:savings:changed", onChange);
      window.removeEventListener("pf:settings:hourlyrate", onChange);
    };
  }, [mounted]);

  if (!mounted) return null; // ⬅️ viktigt för att undvika SSR/CSR-mismatch

  const { h, m } = toHM(minutes);
  const money = new Intl.NumberFormat("sv-SE", {
    style: "currency",
    currency: "SEK",
    maximumFractionDigits: 0,
  }).format(cost);

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-blue-500 px-4 py-2 text-sm text-white shadow-md ${className}`}
      title="Beräknad tid- och kostnadsbesparing"
    >
      <span className="font-medium">Sparat</span>
      <span className="tabular-nums">{h}h {m}m</span>
      <span className="opacity-80">·</span>
      <span className="tabular-nums">{money}</span>
    </div>
  );
}
