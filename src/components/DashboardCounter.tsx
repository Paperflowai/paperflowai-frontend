// src/components/DashboardCounter.tsx
"use client";

import { useEffect, useState } from "react";

export default function DashboardCounter() {
  const [hours, setHours] = useState(0);
  const [money, setMoney] = useState(0);
  const [rate, setRate] = useState(500); // standard timpenning

  return (
    <div className="flex justify-center mb-3">
      <div className="bg-gradient-to-r from-blue-600 to-teal-500 text-white p-2 md:p-1 rounded-md shadow w-full md:w-auto md:min-w-80">
        <h2 className="text-sm md:text-xs font-semibold mb-1">💡 Tid & pengar sparade</h2>
        <div className="flex justify-between text-xs md:text-xs">
          <p>⏱️ {hours} timmar</p>
          <p>💰 {money.toLocaleString("sv-SE")} kr</p>
        </div>

        {/* Timpenning – kompakt version */}
        <div className="mt-1 bg-white/20 px-2 py-1 rounded flex items-center gap-1">
          <label className="text-xs md:text-xs font-medium whitespace-nowrap">
            Timpenning:
          </label>
          <input
            type="number"
            autoFocus={rate === 500} // markerat bara första gången
            value={rate}
            onChange={(e) => setRate(parseInt(e.target.value) || 0)}
            className="px-1 py-0.5 rounded w-20 md:w-16 text-xs text-black"
            placeholder="kr/h"
          />
        </div>
      </div>
    </div>
  );
}
