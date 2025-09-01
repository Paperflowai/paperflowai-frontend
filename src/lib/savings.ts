// src/lib/savings.ts
export type SavingsEventType =
  | "create_offer"
  | "create_order"
  | "create_invoice"
  | "ocr_receipt"
  | "voice_note"
  | "chat_generation";

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
  create_offer: { manualMin: 50, platformMin: 5 },
  create_order: { manualMin: 30, platformMin: 2 },
  create_invoice: { manualMin: 40, platformMin: 3 },
  ocr_receipt: { manualMin: 3, platformMin: 0.5 },
  voice_note: { manualMin: 5, platformMin: 1 },
  chat_generation: { manualMin: 20, platformMin: 2 },
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
    id: typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : String(Date.now()),
    type,
    minutesSaved,
    occurredAt: new Date().toISOString(),
  };

  const all = safeGetEvents();
  all.push(ev);
  saveEvents(all);
  return ev;
}

export function getAllEvents(): SavingsEvent[] {
  return safeGetEvents();
}

// Ny enkel funktion för att lägga till besparingar från chatten
export function addSaving({ minutes, amountSEK, source }: { minutes: number; amountSEK: number; source: string }) {
  if (typeof window === "undefined") return;
  
  const ev: SavingsEvent = {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : String(Date.now()),
    type: "chat_generation" as SavingsEventType,
    minutesSaved: minutes,
    occurredAt: new Date().toISOString(),
  };

  const all = safeGetEvents();
  all.push(ev);
  saveEvents(all);
  return ev;
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
