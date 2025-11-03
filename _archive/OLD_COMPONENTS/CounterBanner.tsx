// src/components/CounterBanner.tsx
"use client";

import { useEffect, useState } from "react";

export default function CounterBanner() {
  const [hours, setHours] = useState(0);
  const [money, setMoney] = useState(0);

  // här kan vi senare koppla in timpenning från dashboard
  const hourlyRate = 500; // standardvärde tills vidare

  useEffect(() => {
    const interval = setInterval(() => {
      setHours((prev) => prev + 1);
      setMoney((prev) => prev + hourlyRate);
    }, 3000); // ökar var 3:e sekund

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-center py-2 shadow-md">
      <p className="text-sm sm:text-base font-semibold">
        ⏱️ {hours} timmar sparade · 💰 {money.toLocaleString("sv-SE")} kr sparade
      </p>
    </div>
  );
}
