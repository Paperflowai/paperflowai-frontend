"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";

type Report = {
  user: string;
  date: string;
  hours: number;
  description: string;
};

export default function RapportPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [view, setView] = useState<"employee" | "admin">("employee");

  // Form fields
  const [user, setUser] = useState("");
  const [date, setDate] = useState("");
  const [hours, setHours] = useState<number>(0);
  const [description, setDescription] = useState("");

  // Ladda sparade rapporter
  useEffect(() => {
    const saved = localStorage.getItem("tidsrapporter");
    if (saved) {
      setReports(JSON.parse(saved));
    }
  }, []);

  const saveReports = (next: Report[]) => {
    setReports(next);
    localStorage.setItem("tidsrapporter", JSON.stringify(next));
  };

  const addReport = () => {
    if (!user || !date || !hours) {
      alert("Fyll i alla fält");
      return;
    }
    const newReport: Report = { user, date, hours, description };
    saveReports([...reports, newReport]);
    setHours(0);
    setDescription("");
  };

  const deleteReport = (i: number) => {
    const next = reports.filter((_, idx) => idx !== i);
    saveReports(next);
  };

  // Summering för admin
  const totalHours = reports.reduce((sum, r) => sum + r.hours, 0);
  const users = Array.from(new Set(reports.map((r) => r.user)));

  return (
    <div className="min-h-screen bg-gray-50 p-6 space-y-6">
      <LogoutButton />
      {/* Tillbaka till Start-knapp */}
      <div className="flex justify-start">
        <Link
          href="/start"
          className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700 transition-colors"
        >
          🏠 Tillbaka till Start
        </Link>
      </div>
      
      {/* Vy-växling */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setView("employee")}
          className={`px-4 py-2 rounded-lg ${
            view === "employee" ? "bg-indigo-600 text-white" : "bg-gray-200"
          }`}
        >
          👷 Anställd
        </button>
        <button
          onClick={() => setView("admin")}
          className={`px-4 py-2 rounded-lg ${
            view === "admin" ? "bg-indigo-600 text-white" : "bg-gray-200"
          }`}
        >
          👨‍💼 Admin
        </button>
      </div>

      {view === "employee" && (
        <div className="bg-white p-6 rounded-xl shadow space-y-4">
          <h2 className="text-xl font-bold">Stämpla in / Rapportera tid</h2>
          <input
            type="text"
            placeholder="Ditt namn"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            className="border rounded px-3 py-2 w-full"
          />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border rounded px-3 py-2 w-full"
          />
          <input
            type="number"
            placeholder="Antal timmar"
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            className="border rounded px-3 py-2 w-full"
          />
          <textarea
            placeholder="Beskrivning / Projekt"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="border rounded px-3 py-2 w-full"
          />
          <button
            onClick={addReport}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
          >
            Spara rapport
          </button>

          <h3 className="text-lg font-semibold mt-6">Mina rapporter</h3>
          <ul className="space-y-2">
            {reports
              .filter((r) => r.user === user)
              .map((r, i) => (
                <li
                  key={i}
                  className="flex justify-between items-center bg-gray-100 px-3 py-2 rounded"
                >
                  <span>
                    {r.date} – {r.hours}h – {r.description}
                  </span>
                  <button
                    onClick={() => deleteReport(i)}
                    className="text-red-600 hover:underline"
                  >
                    🗑
                  </button>
                </li>
              ))}
          </ul>
        </div>
      )}

      {view === "admin" && (
        <div className="bg-white p-6 rounded-xl shadow space-y-4">
          <h2 className="text-xl font-bold">Admin – Alla rapporter</h2>
          <p className="text-gray-600">
            Totala timmar:{" "}
            <span className="font-semibold">{totalHours.toFixed(2)} h</span>
          </p>
          {users.length > 0 && (
            <p className="text-gray-500">
              Användare: {users.join(", ")}
            </p>
          )}

          <table className="w-full border-collapse mt-4">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="border px-4 py-2">Anställd</th>
                <th className="border px-4 py-2">Datum</th>
                <th className="border px-4 py-2">Timmar</th>
                <th className="border px-4 py-2">Beskrivning</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r, i) => (
                <tr key={i}>
                  <td className="border px-4 py-2">{r.user}</td>
                  <td className="border px-4 py-2">{r.date}</td>
                  <td className="border px-4 py-2">{r.hours}</td>
                  <td className="border px-4 py-2">{r.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
