// src/lib/logSavings.ts

export function logSavings(minutes: number, money: number) {
  try {
    const raw = localStorage.getItem("savings_log");
    const logs = raw ? JSON.parse(raw) : [];
    logs.push({ time: minutes, money: money, date: new Date().toISOString() });
    localStorage.setItem("savings_log", JSON.stringify(logs));
  } catch {
    console.warn("Kunde inte spara savings_log");
  }
}
