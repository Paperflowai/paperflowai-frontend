// src/lib/savings.ts
export type SavingsEventType =
  | "quote_created"
  | "order_created"
  | "invoice_created"
  | "pdf_autofill"
  | "ocr_receipt";

export interface SavingsEvent {
  id: string;
  type: SavingsEventType;
  minutesSaved: number;
  occurredAt: string; // ISO
}

const STORAGE_KEY = "pf_savings_events_v1";

// Antaganden (manuell tid vs. med plattform), i minuter
const DEFAULT_SAVINGS: Record<
  SavingsEventType,
  { manualMin: number; platformMin: number }
> = {
  quote_created: { manualMin: 20, platformMin: 5 },
  order_created: { manualMin: 10, platformMin: 2 },
  invoice_created: { manualMin: 12, platformMin: 3 },
  pdf_autofill: { manualMin: 6, platformMin: 1 },
  ocr_receipt: { manualMin: 3, platformMin: 0.5 },
};

// Standardtimlön (SEK/h)
export const DEFAULT_HOURLY_RATE_SEK = 700;

function safeGetEvents(): SavingsEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavingsEvent[]) : [];
  } catch {
    return [];
  }
}

function saveEvents(events: SavingsEvent[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  try {
    window.dispatchEvent(new CustomEvent("pf:savings:changed"));
  } catch {}
}

export function addEvent(
  type: SavingsEventType,
  overrides?: { manualMin?: number; platformMin?: number }
): SavingsEvent {
  const base = DEFAULT_SAVINGS[type];
  const manual = overrides?.manualMin ?? base.manualMin;
  const platform = overrides?.platformMin ?? base.platformMin;
  const minutesSaved = Math.max(0, manual - platform);

  const ev: SavingsEvent = {
    id: typeof window !== "undefined" && typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `savings_${Math.random().toString(36).substr(2, 9)}`,
    type,
    minutesSaved,
    occurredAt: typeof window !== "undefined" ? new Date().toISOString() : new Date().toISOString(),
  };

  const all = safeGetEvents();
  all.push(ev);
  saveEvents(all);
  return ev;
}

export function getAllEvents(): SavingsEvent[] {
  return safeGetEvents();
}

export function resetSavings() {
  saveEvents([]);
}

export function getSummary(opts?: {
  hourlyRateSEK?: number;
  from?: Date;
  to?: Date;
}): { totalMinutes: number; totalCostSEK: number; count: number } {
  const rate = opts?.hourlyRateSEK ?? DEFAULT_HOURLY_RATE_SEK;
  const from = opts?.from?.getTime();
  const to = opts?.to?.getTime();

  const events = safeGetEvents().filter((e) => {
    const t = new Date(e.occurredAt).getTime();
    if (from && t < from) return false;
    if (to && t > to) return false;
    return true;
  });

  const totalMinutes = events.reduce((sum, e) => sum + e.minutesSaved, 0);
  const totalCostSEK = (totalMinutes / 60) * rate;
  return { totalMinutes, totalCostSEK, count: events.length };
}
// Lägg till en spar-händelse och trigga uppdatering av banners
export function addSaving({
  minutes,
  amountSEK,
  source = "chat",
}: {
  minutes: number;
  amountSEK: number;
  source?: string;
}) {
  try {
    const arr = JSON.parse(localStorage.getItem("pf_savings_events") || "[]");
    const ev = { minutes, amountSEK, source, ts: Date.now() };
    localStorage.setItem("pf_savings_events", JSON.stringify([...arr, ev]));
  } catch {
    // om något strular i parse, börja om
    const ev = { minutes, amountSEK, source, ts: Date.now() };
    localStorage.setItem("pf_savings_events", JSON.stringify([ev]));
  }
  // Tala om för badges/summary att summera om
  window.dispatchEvent(new Event("pf:savings:changed"));
}
