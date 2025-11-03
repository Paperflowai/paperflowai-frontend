// src/app/bills/page.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import NavFooter from "@/components/NavFooter";
import LogoutButton from "@/components/LogoutButton";


type Bill = {
  id: number;
  title: string;
  amount?: number;
  dueDate?: string;
  file?: string;    // filens namn
  fileUrl?: string; // temporär URL till filen
};

export default function BillsPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [file, setFile] = useState<File | null>(null);

  // 🟢 Ladda räkningar från localStorage när sidan öppnas
  useEffect(() => {
    const savedBills = localStorage.getItem("bills");
    if (savedBills) {
      setBills(JSON.parse(savedBills));
    }
  }, []);

  // 🟢 Spara räkningar till localStorage varje gång listan ändras
  useEffect(() => {
    if (bills.length > 0) {
      localStorage.setItem("bills", JSON.stringify(bills));
    }
  }, [bills]);

  const addBill = () => {
    if (!title && !file) return;

    const newBill: Bill = {
      id: Date.now(),
      title: title || file?.name || "Okänd faktura",
      amount: amount ? parseFloat(amount) : undefined,
      dueDate: dueDate || undefined,
      file: file ? file.name : undefined,
      fileUrl: file ? URL.createObjectURL(file) : undefined,
    };

    setBills([...bills, newBill]);
    setTitle("");
    setAmount("");
    setDueDate("");
    setFile(null);
  };

  const today = new Date();

  return (
    <main className="min-h-dvh w-full bg-gray-100 p-6">
      <LogoutButton />
      {/* Tillbaka till Start-knapp */}
      <div className="mb-4 flex justify-start">
        <Link
          href="/start"
          className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700 transition-colors"
        >
          🏠 Tillbaka till Start
        </Link>
      </div>
      
      <h1 className="text-2xl font-bold mb-4">Mina räkningar</h1>

      {/* Formulär */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <h2 className="text-lg font-semibold mb-3">Lägg till räkning</h2>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <input
            type="text"
            placeholder="Titel"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="border px-3 py-2 rounded w-full sm:w-1/4"
          />
          <input
            type="number"
            placeholder="Belopp (kr)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="border px-3 py-2 rounded w-full sm:w-1/4"
          />
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="border px-3 py-2 rounded w-full sm:w-1/4"
          />
          <input
            type="file"
            accept="application/pdf,image/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="border px-3 py-2 rounded w-full sm:w-1/4"
          />
          <button
            onClick={addBill}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            Lägg till
          </button>
        </div>
      </div>

      {/* Lista med räkningar */}
      <div className="grid gap-4">
        {bills.map((bill) => {
          const due = bill.dueDate ? new Date(bill.dueDate) : null;
          const daysLeft = due
            ? Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
            : null;

          let status = "";
          let color = "text-gray-700";

          if (daysLeft !== null) {
            if (daysLeft < 0) {
              status = "⚠️ Förfallet! Risk för Kronofogden.";
              color = "text-red-600 font-bold";
            } else if (daysLeft <= 3) {
              status = `🔔 Förfallodatum om ${daysLeft} dagar!`;
              color = "text-orange-600 font-semibold";
            } else {
              status = `✅ Betalas om ${daysLeft} dagar.`;
              color = "text-green-600";
            }
          }

          return (
            <div
              key={bill.id}
              className="bg-white rounded-lg shadow p-4 border"
            >
              <h3 className="font-semibold text-lg">{bill.title}</h3>
              {bill.amount && <p className="text-sm">Belopp: {bill.amount} kr</p>}
              {bill.dueDate && (
                <p className="text-sm">Förfallodatum: {bill.dueDate}</p>
              )}
              {bill.file && bill.fileUrl && (
                <p className="text-sm">
                  Fil:{" "}
                  <a
                    href={bill.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline"
                  >
                    {bill.file}
                  </a>
                </p>
              )}
              {status && <p className={`mt-2 ${color}`}>{status}</p>}
            </div>
          );
        })}
      </div>
      <NavFooter />
    </main>
  );
}
