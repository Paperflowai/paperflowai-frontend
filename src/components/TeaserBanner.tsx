"use client";

import { useEffect, useState } from "react";

type Savings = {
  minutes: number;
  money: number;
};

export default function TeaserBanner() {
  const [today, setToday] = useState<Savings>({ minutes: 0, money: 0 });
  const [week, setWeek] = useState<Savings>({ minutes: 0, money: 0 });
  const [month, setMonth] = useState<Savings>({ minutes: 0, money: 0 });

  // Ladda från localStorage
  useEffect(() => {
    const raw = localStorage.getItem("savings-log");
    if (!raw) return;

    const data = JSON.parse(raw) as {
      timestamp: string;
      minutes: number;
      money: number;
    }[];

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1);
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    let t = { minutes: 0, money: 0 };
    let w = { minutes: 0, money: 0 };
    let m = { minutes: 0, money: 0 };

    for (const entry of data) {
      const ts = new Date(entry.timestamp);
      if (ts >= startOfDay) {
        t.minutes += entry.minutes;
        t.money += entry.money;
      }
      if (ts >= startOfWeek) {
        w.minutes += entry.minutes;
        w.money += entry.money;
      }
      if (ts >= startOfMonth) {
        m.minutes += entry.minutes;
        m.money += entry.money;
      }
    }

    setToday(t);
    setWeek(w);
    setMonth(m);
  }, []);

  return (
    <div className="w-full bg-gradient-to-r from-sky-500 via-blue-500 to-teal-500 text-white text-xs sm:text-sm py-1.5 px-4 shadow-md">
      <div className="flex justify-center items-center gap-6 text-center font-medium leading-tight">
        <span>
          Idag: ⏱ {today.minutes} min · 💰 {today.money} kr
        </span>
        <span>
          Vecka: ⏱ {week.minutes} min · 💰 {week.money} kr
        </span>
        <span>
          Månad: ⏱ {month.minutes} min · 💰 {month.money} kr
        </span>
      </div>
    </div>
  );
}
