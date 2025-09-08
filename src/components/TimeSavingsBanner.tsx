// src/components/TimeSavingsBanner.tsx
"use client";

import { useEffect, useState } from "react";

export default function TimeSavingsBanner() {
  const [hours, setHours] = useState(0);
  const [money, setMoney] = useState(0);

  // Räknar upp timmar och pengar automatiskt
  useEffect(() => {
    const timer = setInterval(() => {
      setHours((prev) => prev + 1);
      setMoney((prev) => prev + 500); // exempel: 500 kr sparat per timme
    }, 2000); // räknar upp varannan sekund

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="w-full bg-green-600 text-white text-center py-4 shadow-lg">
      <p className="text-lg sm:text-xl font-semibold">
        ⏱️ {hours} timmar och 💰 {money.toLocaleString("sv-SE")} kr sparade med PaperflowAI!
      </p>
    </div>
  );
}
