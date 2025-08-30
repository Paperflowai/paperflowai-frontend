// src/components/SettingsHourlyRate.tsx
"use client";

import { useEffect, useState } from "react";
import { getHourlyRate, setHourlyRate } from "../lib/settings";

export default function SettingsHourlyRate({
  className = "",
  label = "Timkostnad (kr/h)",
}: {
  className?: string;
  label?: string;
}) {
  const [rate, setRate] = useState<number>(getHourlyRate());

  useEffect(() => {
    // Uppdatera om något annat ändrar timkostnaden
    const onChange = () => setRate(getHourlyRate());
    window.addEventListener("pf:settings:hourlyrate", onChange);
    return () => window.removeEventListener("pf:settings:hourlyrate", onChange);
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = Number(e.target.value);
    setRate(v);
    if (Number.isFinite(v) && v > 0) {
      setHourlyRate(v); // sparar i localStorage + skickar event
    }
  }

  return (
    <div className={`max-w-sm ${className}`}>
      <label className="block text-sm text-gray-600 mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          step={50}
          value={rate}
          onChange={handleChange}
          className="w-32 border rounded-lg p-2 text-right"
        />
        <span className="text-gray-500">kr/h</span>
      </div>
      <p className="mt-1 text-xs text-gray-500">
        Används för att räkna ut pengar sparade.
      </p>
    </div>
  );
}
