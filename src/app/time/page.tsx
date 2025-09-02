// src/app/time/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

/** ========= Typer ========= */
type TimeEntry = {
  id: string;
  date: string;          // yyyy-mm-dd
  minutes: number;       // lagras i minuter
  customer?: string;
  project?: string;
  note?: string;
  createdAt: string;     // ISO
  billedAt?: string;     // ISO (om markerad som fakturerad; valfritt)
};

type RunningTimer = {
  startedAt: number;     // Date.now()
  customer: string;
  project: string;
  note: string;
};

type Submission = {
  weekKey: string;       // t.ex. 2025-W36 (ISO-vecka)
  submittedAt: string;   // ISO
  approvedAt?: string;   // ISO när chef godkänner
};

type RemindState = {
  dailySnoozeUntil?: string;   // ISO
  weeklySnoozeUntil?: string;  // ISO
};

/** ========= Hjälpare ========= */
function safeId() {
  try {
    // @ts-ignore
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch {}
  return String(Date.now()) + Math.random().toString(16).slice(2);
}
function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function fmtHM(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}
function parseHoursOrHM(input: string): number | null {
  const t = input.trim();
  if (!t) return null;
  if (t.includes(":")) {
    const [hRaw, mRaw = "0"] = t.split(":");
    const h = Number(hRaw);
    const m = Number(mRaw);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    return Math.max(0, h * 60 + m);
  }
  const dec = Number(t.replace(",", "."));
  if (!Number.isFinite(dec)) return null;
  return Math.max(0, Math.round(dec * 60));
}
function loadEntries(): TimeEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem("pf_time_entries_v1") || "[]") as TimeEntry[];
  } catch {
    return [];
  }
}
function saveEntries(items: TimeEntry[]) {
  localStorage.setItem("pf_time_entries_v1", JSON.stringify(items));
}
function loadRunning(): RunningTimer | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("pf_time_running_v1");
    return raw ? (JSON.parse(raw) as RunningTimer) : null;
  } catch {
    return null;
  }
}
function saveRunning(r: RunningTimer | null) {
  if (!r) localStorage.removeItem("pf_time_running_v1");
  else localStorage.setItem("pf_time_running_v1", JSON.stringify(r));
}
// ISO-veckonummer (mån–sön)
function isoWeekKeyFromDate(d0: Date) {
  const d = new Date(Date.UTC(d0.getFullYear(), d0.getMonth(), d0.getDate()));
  // Torsdag avgör veckan
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  const y = d.getUTCFullYear();
  return `${y}-W${String(weekNo).padStart(2, "0")}`;
}
function isoWeekKeyOfYyyyMmDd(yyyyMmDd: string) {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  return isoWeekKeyFromDate(new Date(y, (m - 1), d));
}
function weekRange(weekKey: string) {
  // Beräkna måndag–söndag för en given ISO-vecka
  const [yStr, wStr] = weekKey.split("-W");
  const y = Number(yStr);
  const w = Number(wStr);
  // Hitta torsdag i veckan
  const jan4 = new Date(Date.UTC(y, 0, 4));
  const jan4Dow = jan4.getUTCDay() || 7;
  const thursdayOfWeek = new Date(jan4);
  thursdayOfWeek.setUTCDate(4 + (w - 1) * 7 - (jan4Dow - 1));
  // Måndag är -3 dagar
  const monday = new Date(thursdayOfWeek);
  monday.setUTCDate(thursdayOfWeek.getUTCDate() - 3);
  const start = new Date(monday);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);
  return { start, end };
}
function isDateInRange(yyyyMmDd: string, start: Date, end: Date) {
  const d = new Date(yyyyMmDd + "T12:00:00");
  return d >= start && d <= end;
}
function loadSubmissions(): Submission[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem("pf_time_submissions_v1") || "[]") as Submission[];
  } catch {
    return [];
  }
}
function saveSubmissions(list: Submission[]) {
  localStorage.setItem("pf_time_submissions_v1", JSON.stringify(list));
}
function loadRemind(): RemindState {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem("pf_time_remind_v1") || "{}") as RemindState;
  } catch {
    return {};
  }
}
function saveRemind(x: RemindState) {
  localStorage.setItem("pf_time_remind_v1", JSON.stringify(x));
}

/** ========= Sida ========= */
export default function TimePage() {
  // Roller (enkel växel)
  const [role, setRole] = useState<"employee" | "manager">("employee");

  // Data
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [subs, setSubs] = useState<Submission[]>([]);
  const [remind, setRemind] = useState<RemindState>({});

  // Timer
  const [running, setRunning] = useState<RunningTimer | null>(null);
  const [, forceTick] = useState(0);

  // Inputs – timer
  const [tCustomer, setTCustomer] = useState("");
  const [tProject, setTProject] = useState("");
  const [tNote, setTNote] = useState("");

  // Inputs – manuell
  const [mDate, setMDate] = useState(todayStr());
  const [mCustomer, setMCustomer] = useState("");
  const [mProject, setMProject] = useState("");
  const [mNote, setMNote] = useState("");
  const [mHours, setMHours] = useState("1:00");

  // Filter
  const [showBilled, setShowBilled] = useState(false);

  // Init
  useEffect(() => {
    setEntries(loadEntries());
    setSubs(loadSubmissions());
    setRemind(loadRemind());
    const r = loadRunning();
    if (r) setRunning(r);
  }, []);

  // Ticker när timer rullar
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => forceTick((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  // Aktuell vecka
  const today = new Date();
  const currentWeekKey = isoWeekKeyFromDate(today);
  const { start: wkStart, end: wkEnd } = useMemo(() => weekRange(currentWeekKey), [currentWeekKey]);

  const nowMs = Date.now();
  const elapsedMin = running ? Math.max(0, Math.round((nowMs - running.startedAt) / 60000)) : 0;

  // Summeringar
  const weekMinutes = useMemo(
    () =>
      entries
        .filter((e) => isDateInRange(e.date, wkStart, wkEnd))
        .reduce((sum, e) => sum + e.minutes, 0),
    [entries, wkStart, wkEnd]
  );

  // Grupp per datum, nyast överst
  const grouped = useMemo(() => {
    const map = new Map<string, TimeEntry[]>();
    for (const e of entries) {
      if (!showBilled && e.billedAt) continue;
      const arr = map.get(e.date) || [];
      arr.push(e);
      map.set(e.date, arr);
    }
    const sortedKeys = Array.from(map.keys()).sort((a, z) => (a < z ? 1 : -1));
    return sortedKeys.map((date) => {
      const arr = map.get(date)!.sort((a, z) => (a.createdAt < z.createdAt ? 1 : -1));
      const total = arr.reduce((s, e) => s + e.minutes, 0);
      return { date, items: arr, total };
    });
  }, [entries, showBilled]);

  // Veckans status
  const weekSubmitted = subs.some((s) => s.weekKey === currentWeekKey);
  const weekApproved = subs.some((s) => s.weekKey === currentWeekKey && s.approvedAt);

  /** ========= Påminnelser (in-app banners) ========= */
  const [showDailyBanner, setShowDailyBanner] = useState(false);
  const [showWeeklyBanner, setShowWeeklyBanner] = useState(false);

  useEffect(() => {
    // Daglig 16:30 om 0 min idag
    const now = new Date();
    const dailySnoozeUntil = remind.dailySnoozeUntil ? new Date(remind.dailySnoozeUntil).getTime() : 0;
    const todayTotal = entries
      .filter((e) => e.date === todayStr())
      .reduce((s, e) => s + e.minutes, 0);
    const isAfter1630 = now.getHours() > 16 || (now.getHours() === 16 && now.getMinutes() >= 30);
    setShowDailyBanner(todayTotal === 0 && isAfter1630 && Date.now() > dailySnoozeUntil);

    // Veckovis: fre 16:00 (samt lör/sön) om veckan ej inskickad
    const dow = now.getDay(); // 0 sön .. 6 lör
    const isFriAfter16 = dow === 5 && (now.getHours() > 16 || (now.getHours() === 16 && now.getMinutes() >= 0));
    const weekend = dow === 6 || dow === 0;
    const weeklySnoozeUntil = remind.weeklySnoozeUntil ? new Date(remind.weeklySnoozeUntil).getTime() : 0;
    setShowWeeklyBanner(!weekSubmitted && (isFriAfter16 || weekend) && Date.now() > weeklySnoozeUntil);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, subs, remind.dailySnoozeUntil, remind.weeklySnoozeUntil]);

  function snoozeDaily1h() {
    const until = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const next = { ...remind, dailySnoozeUntil: until };
    setRemind(next); saveRemind(next); setShowDailyBanner(false);
  }
  function snoozeWeekly24h() {
    const until = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const next = { ...remind, weeklySnoozeUntil: until };
    setRemind(next); saveRemind(next); setShowWeeklyBanner(false);
  }

  /** ========= Åtgärder ========= */
  function startTimer() {
    if (running || weekSubmitted) return;
    const r: RunningTimer = {
      startedAt: Date.now(),
      customer: tCustomer.trim(),
      project: tProject.trim(),
      note: tNote.trim(),
    };
    setRunning(r);
    saveRunning(r);
  }

  function stopTimer() {
    if (!running) return;
    const mins = Math.max(1, Math.round((Date.now() - running.startedAt) / 60000));
    const entry: TimeEntry = {
      id: safeId(),
      date: todayStr(),
      minutes: mins,
      customer: running.customer || undefined,
      project: running.project || undefined,
      note: running.note || undefined,
      createdAt: new Date().toISOString(),
    };
    const next = [entry, ...entries];
    setEntries(next);
    saveEntries(next);
    setRunning(null);
    saveRunning(null);
    setTNote("");
  }

  function addManual(e: React.FormEvent) {
    e.preventDefault();
    if (weekSubmitted) return;
    const mins = parseHoursOrHM(mHours);
    if (!mins || mins <= 0) return;
    const entry: TimeEntry = {
      id: safeId(),
      date: mDate || todayStr(),
      minutes: mins,
      customer: mCustomer.trim() || undefined,
      project: mProject.trim() || undefined,
      note: mNote.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    const next = [entry, ...entries];
    setEntries(next);
    saveEntries(next);
    setMNote(""); setMHours("1:00");
  }

  function markBilled(id: string) {
    const next = entries.map((e) => (e.id === id ? { ...e, billedAt: new Date().toISOString() } : e));
    setEntries(next); saveEntries(next);
  }

  function removeEntry(id: string) {
    if (weekSubmitted) return; // låst
    const next = entries.filter((e) => e.id !== id);
    setEntries(next); saveEntries(next);
  }

  function submitWeek() {
    if (weekSubmitted) return;
    // får skicka bara om det finns tid i veckan
    const hasAny = entries.some((e) => isDateInRange(e.date, wkStart, wkEnd));
    if (!hasAny) return;
    const s: Submission = { weekKey: currentWeekKey, submittedAt: new Date().toISOString() };
    const next = [...subs, s];
    setSubs(next); saveSubmissions(next);
  }

  // Chef: godkänn eller lås upp
  function approveWeek(weekKey: string) {
    const next = subs.map((s) => (s.weekKey === weekKey ? { ...s, approvedAt: new Date().toISOString() } : s));
    setSubs(next); saveSubmissions(next);
  }
  function reopenWeek(weekKey: string) {
    const next = subs.filter((s) => s.weekKey !== weekKey);
    setSubs(next); saveSubmissions(next);
  }

  // Manager-listor
  const pendingWeeks = useMemo(() => {
    const keys = Array.from(new Set(subs.filter((s) => !s.approvedAt).map((s) => s.weekKey)));
    return keys.sort().reverse();
  }, [subs]);
  const approvedWeeks = useMemo(() => {
    const keys = Array.from(new Set(subs.filter((s) => s.approvedAt).map((s) => s.weekKey)));
    return keys.sort().reverse();
  }, [subs]);

  function totalMinutesForWeek(weekKey: string) {
    const { start, end } = weekRange(weekKey);
    return entries.filter((e) => isDateInRange(e.date, start, end)).reduce((s, e) => s + e.minutes, 0);
  }

  /** ========= UI ========= */
  return (
    <div style={{ padding: 24, marginTop: 80, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 22, marginRight: 8 }}>Tidrapport</h1>
        <div style={{ display: "inline-flex", gap: 8 }}>
          <button
            onClick={() => setRole("employee")}
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              border: role === "employee" ? "1px solid #0ea5e9" : "1px solid #e5e7eb",
              background: role === "employee" ? "#e0f2fe" : "white",
            }}
          >
            Anställd
          </button>
          <button
            onClick={() => setRole("manager")}
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              border: role === "manager" ? "1px solid #0ea5e9" : "1px solid #e5e7eb",
              background: role === "manager" ? "#e0f2fe" : "white",
            }}
          >
            Chef
          </button>
        </div>
      </div>

      {/* Banners: påminnelser */}
      {role === "employee" && showDailyBanner && (
        <div style={{ padding: 12, borderRadius: 10, marginBottom: 12, background: "#fffbeb", border: "1px solid #fde68a" }}>
          <b>Påminnelse:</b> Har du rapporterat din tid idag?
          <div style={{ display: "inline-flex", gap: 8, marginLeft: 12 }}>
            <button
              onClick={() => setShowDailyBanner(false)}
              style={{ padding: "4px 8px", border: "1px solid #e5e7eb", borderRadius: 8, background: "white" }}
            >
              Klart
            </button>
            <button
              onClick={snoozeDaily1h}
              style={{ padding: "4px 8px", border: "1px solid #e5e7eb", borderRadius: 8, background: "white" }}
            >
              Snooza 1 h
            </button>
          </div>
        </div>
      )}

      {role === "employee" && showWeeklyBanner && (
        <div style={{ padding: 12, borderRadius: 10, marginBottom: 12, background: "#ecfeff", border: "1px solid #bae6fd" }}>
          <b>Påminnelse:</b> Skicka in veckans tid ({currentWeekKey}) — {fmtHM(weekMinutes)}
          <div style={{ display: "inline-flex", gap: 8, marginLeft: 12, flexWrap: "wrap" }}>
            <button
              onClick={submitWeek}
              disabled={weekSubmitted || weekMinutes === 0}
              style={{
                padding: "4px 8px",
                borderRadius: 8,
                border: "1px solid #0ea5e9",
                background: "#0ea5e9",
                color: "white",
              }}
            >
              Skicka in nu
            </button>
            <button
              onClick={snoozeWeekly24h}
              style={{ padding: "4px 8px", border: "1px solid #e5e7eb", borderRadius: 8, background: "white" }}
            >
              Snooza 24 h
            </button>
          </div>
        </div>
      )}

      {/* ===== Anställd-vy ===== */}
      {role === "employee" && (
        <>
          {/* Status / vecka */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
            <div
              style={{
                padding: 10, borderRadius: 10, border: "1px solid #e5e7eb", background: "#f8fafc", minWidth: 200,
              }}
            >
              <div style={{ fontSize: 12, color: "#64748b" }}>
                {currentWeekKey} (mån–sön)
              </div>
              <div style={{ fontWeight: 700, fontSize: 18 }}>{fmtHM(weekMinutes)}</div>
              {weekSubmitted && (
                <div style={{ marginTop: 6, fontSize: 12, color: weekApproved ? "#059669" : "#ea580c" }}>
                  {weekApproved ? "Godkänd av chef" : "Inskickad – väntar på godkännande"}
                </div>
              )}
            </div>

            <button
              onClick={submitWeek}
              disabled={weekSubmitted || weekMinutes === 0}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: weekSubmitted ? "1px solid #e5e7eb" : "1px solid #0ea5e9",
                background: weekSubmitted ? "#f1f5f9" : "#0ea5e9",
                color: weekSubmitted ? "#64748b" : "white",
                whiteSpace: "nowrap",
              }}
            >
              {weekSubmitted ? "Vecka inskickad" : "Skicka in vecka"}
            </button>
          </div>

          {/* Timer */}
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, marginBottom: 16, background: "#ffffff" }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Snabb-timer</div>
            <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr 2fr auto" }}>
              <input placeholder="Kund" value={tCustomer} onChange={(e) => setTCustomer(e.target.value)} style={{ padding: 8, borderRadius: 8, border: "1px solid #ddd" }} />
              <input placeholder="Projekt" value={tProject} onChange={(e) => setTProject(e.target.value)} style={{ padding: 8, borderRadius: 8, border: "1px solid #ddd" }} />
              <input placeholder="Anteckning (valfritt)" value={tNote} onChange={(e) => setTNote(e.target.value)} style={{ padding: 8, borderRadius: 8, border: "1px solid #ddd" }} />
              {!running ? (
                <button onClick={startTimer} disabled={weekSubmitted} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #0ea5e9", background: "#0ea5e9", color: "white" }}>
                  ▶ Start
                </button>
              ) : (
                <button onClick={stopTimer} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #ef4444", background: "#ef4444", color: "white" }}>
                  ⏸ Stop ({fmtHM(elapsedMin)})
                </button>
              )}
            </div>
            {running && (
              <div style={{ marginTop: 8, fontSize: 12, color: "#64748b" }}>
                Pågår… {running.customer || "—"} {running.project ? "• " + running.project : ""} {running.note ? "• " + running.note : ""}
              </div>
            )}
            {weekSubmitted && <div style={{ marginTop: 8, fontSize: 12, color: "#ef4444" }}>Veckan är inskickad och låst.</div>}
          </div>

          {/* Manuell registrering */}
          <form onSubmit={addManual} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, marginBottom: 16, background: "#ffffff" }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Lägg till manuellt</div>
            <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr 1fr 2fr 1fr auto" }}>
              <input type="date" value={mDate} onChange={(e) => setMDate(e.target.value)} style={{ padding: 8, borderRadius: 8, border: "1px solid #ddd" }} />
              <input placeholder="Kund" value={mCustomer} onChange={(e) => setMCustomer(e.target.value)} style={{ padding: 8, borderRadius: 8, border: "1px solid #ddd" }} />
              <input placeholder="Projekt" value={mProject} onChange={(e) => setMProject(e.target.value)} style={{ padding: 8, borderRadius: 8, border: "1px solid #ddd" }} />
              <input placeholder='Tid (t.ex. "1:30" eller "1.5")' value={mHours} onChange={(e) => setMHours(e.target.value)} style={{ padding: 8, borderRadius: 8, border: "1px solid #ddd" }} />
              <input placeholder="Anteckning" value={mNote} onChange={(e) => setMNote(e.target.value)} style={{ padding: 8, borderRadius: 8, border: "1px solid #ddd" }} />
              <button type="submit" disabled={weekSubmitted} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #10b981", background: "#10b981", color: "white" }}>
                Lägg till
              </button>
            </div>
            {weekSubmitted && <div style={{ marginTop: 8, fontSize: 12, color: "#ef4444" }}>Veckan är inskickad och låst.</div>}
          </form>

          {/* Lista per datum */}
          {grouped.length === 0 && (
            <div style={{ color: "#6b7280" }}>Inga poster ännu. Använd start/stop eller lägg till manuellt.</div>
          )}
          <div style={{ display: "grid", gap: 12 }}>
            {grouped.map(({ date, items, total }) => (
              <div key={date} style={{ border: "1px solid #e5e7eb", borderRadius: 12, background: "#fff" }}>
                <div style={{ padding: 12, borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontWeight: 700 }}>{date}</div>
                  <div style={{ fontWeight: 700 }}>{fmtHM(total)}</div>
                </div>
                <div style={{ display: "grid", gap: 8, padding: 12 }}>
                  {items.map((e) => (
                    <div key={e.id} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr 80px auto", gap: 8, alignItems: "center" }}>
                      <div>{e.customer || "—"}</div>
                      <div>{e.project || "—"}</div>
                      <div style={{ color: "#334155" }}>{e.note || "—"}</div>
                      <div style={{ fontWeight: 600, textAlign: "right" }}>{fmtHM(e.minutes)}</div>
                      <div style={{ display: "flex", gap: 8, justifyContent: "end", flexWrap: "wrap" }}>
                        {!e.billedAt ? (
                          <button onClick={() => markBilled(e.id)} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #0ea5e9", background: "#0ea5e9", color: "white" }}>
                            Markera fakturerad
                          </button>
                        ) : (
                          <span style={{ fontSize: 12, color: "#059669" }}>
                            Fakturerad {new Date(e.billedAt).toLocaleDateString("sv-SE")}
                          </span>
                        )}
                        {!weekSubmitted && (
                          <button onClick={() => removeEntry(e.id)} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #e5e7eb", background: "white" }}>
                            Ta bort
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ===== Chef-vy ===== */}
      {role === "manager" && (
        <div style={{ display: "grid", gap: 16 }}>
          {/* Att godkänna */}
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, background: "#fff" }}>
            <div style={{ padding: 12, borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between" }}>
              <div style={{ fontWeight: 700 }}>Att godkänna</div>
              <div>{pendingWeeks.length} st</div>
            </div>
            {pendingWeeks.length === 0 ? (
              <div style={{ padding: 12, color: "#6b7280" }}>Inga inskickade veckor.</div>
            ) : (
              <div style={{ display: "grid", gap: 8, padding: 12 }}>
                {pendingWeeks.map((wk) => (
                  <div key={wk} style={{ display: "grid", gridTemplateColumns: "1fr 120px auto", gap: 8, alignItems: "center" }}>
                    <div><b>{wk}</b></div>
                    <div style={{ fontWeight: 700 }}>{fmtHM(totalMinutesForWeek(wk))}</div>
                    <div style={{ display: "flex", gap: 8, justifyContent: "end", flexWrap: "wrap" }}>
                      <button onClick={() => approveWeek(wk)} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #10b981", background: "#10b981", color: "white" }}>
                        Godkänn & lås
                      </button>
                      <button onClick={() => reopenWeek(wk)} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #e5e7eb", background: "white" }}>
                        Lås upp (be om justering)
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Godkända veckor */}
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, background: "#fff" }}>
            <div style={{ padding: 12, borderBottom: "1px solid #e5e7eb", fontWeight: 700 }}>Godkända veckor</div>
            {approvedWeeks.length === 0 ? (
              <div style={{ padding: 12, color: "#6b7280" }}>Inga godkända veckor ännu.</div>
            ) : (
              <div style={{ display: "grid", gap: 8, padding: 12 }}>
                {approvedWeeks.map((wk) => (
                  <div key={wk} style={{ display: "grid", gridTemplateColumns: "1fr 120px auto", gap: 8, alignItems: "center" }}>
                    <div><b>{wk}</b></div>
                    <div style={{ fontWeight: 700 }}>{fmtHM(totalMinutesForWeek(wk))}</div>
                    <div style={{ display: "flex", gap: 8, justifyContent: "end" }}>
                      <button onClick={() => reopenWeek(wk)} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #e5e7eb", background: "white" }}>
                        Lås upp igen
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Fotnot */}
      <p style={{ fontSize: 12, color: "#6b7280", marginTop: 16 }}>
        När detta sitter kan vi koppla ”Godkänn & lås” till fakturautkast och löneexport (CSV) per kund/projekt.
      </p>
    </div>
  );
}
