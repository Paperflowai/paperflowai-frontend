// src/components/SavingsSummary.tsx
"use client";

import { useEffect, useState } from "react";
import { getSummary } from "../lib/savings";
import { getHourlyRate } from "../lib/settings";

function toHM(totalMinutes: number) {
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  return { h, m };
}

export default function SavingsSummary({
  className = "",
}: {
  className?: string;
}) {
  const [minutes, setMinutes] = useState(0);
  const [cost, setCost] = useState(0);
  const [rate, setRate] = useState<number>(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const refresh = () => {
    if (typeof window === "undefined") return;
    const r = getHourlyRate();
    setRate(r);
    const s = getSummary({ hourlyRateSEK: r });
    setMinutes(s.totalMinutes);
    setCost(s.totalCostSEK);
  };

  useEffect(() => {
    if (!mounted) return;
    refresh();
    const onChange = () => refresh();
    window.addEventListener("pf:savings:changed", onChange);
    window.addEventListener("pf:settings:hourlyrate", onChange);
    return () => {
      window.removeEventListener("pf:savings:changed", onChange);
      window.removeEventListener("pf:settings:hourlyrate", onChange);
    };
  }, [mounted]);

  if (!mounted) return null;

  const { h, m } = toHM(minutes);
  const days = minutes / 60 / 8; // arbetsdagar (8h)
  const money = new Intl.NumberFormat("sv-SE", {
    style: "currency",
    currency: "SEK",
    maximumFractionDigits: 0,
  }).format(cost);

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-teal-200/60 bg-white shadow-sm ${className}`}
      title="Summerad tids- och kostnadsbesparing"
    >
      {/* subtil gradient-header som matchar badgen */}
      <div className="h-2 w-full bg-gradient-to-r from-teal-500 to-blue-500" />
      <div className="p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-1">
          <div className="h-2.5 w-2.5 rounded-full bg-teal-500" />
          <h3 className="text-base sm:text-lg font-semibold text-gray-900">
            Totalt sparat
          </h3>
        </div>

        <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <p className="text-2xl sm:text-3xl font-bold text-gray-900 tabular-nums">
            {h}h {m}m
          </p>
          <span className="text-gray-400">•</span>
          <p className="text-xl sm:text-2xl font-semibold text-gray-900 tabular-nums">
            {money}
          </p>
        </div>

        <p className="mt-2 text-sm text-gray-600">
          ≈ {days.toFixed(1)} arbetsdagar · beräknat med {rate} kr/h
        </p>
      </div>
    </div>
  );
}
