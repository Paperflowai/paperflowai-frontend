// src/lib/settings.ts
import { DEFAULT_HOURLY_RATE_SEK } from "./savings";

const KEY = "pf_hourly_rate_sek";

// Hämta timkostnad från localStorage (fallback till DEFAULT_HOURLY_RATE_SEK)
export function getHourlyRate(): number {
  if (typeof window === "undefined") return DEFAULT_HOURLY_RATE_SEK;
  const raw = localStorage.getItem(KEY);
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_HOURLY_RATE_SEK;
}

// Sätt timkostnad och skicka event så UI kan uppdatera sig
export function setHourlyRate(n: number) {
  if (typeof window === "undefined") return;
  const val = Math.max(0, Math.round(n)); // heltal, ej negativt
  localStorage.setItem(KEY, String(val));
  try {
    window.dispatchEvent(new CustomEvent("pf:settings:hourlyrate"));
  } catch {}
}
