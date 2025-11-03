// src/components/PaymentReminder.tsx
"use client";

import { useState } from "react";

export default function PaymentReminder() {
  const [reminders, setReminders] = useState<string[]>([]);
  const [newReminder, setNewReminder] = useState("");

  const addReminder = () => {
    if (newReminder.trim() !== "") {
      setReminders([...reminders, newReminder]);
      setNewReminder("");
    }
  };

  return (
    <div className="bg-red-50 border border-red-300 rounded-lg p-4 shadow-md">
      <h2 className="text-lg font-semibold text-red-800 mb-2">
        🔔 Betalningspåminnelser
      </h2>

      {/* Lista på påminnelser */}
      {reminders.length === 0 ? (
        <p className="text-sm text-red-600">Inga påminnelser ännu.</p>
      ) : (
        <ul className="list-disc pl-5 text-sm text-red-700">
          {reminders.map((reminder, index) => (
            <li key={index}>{reminder}</li>
          ))}
        </ul>
      )}

      {/* Lägg till ny påminnelse */}
      <div className="mt-3 flex gap-2">
        <input
          type="text"
          value={newReminder}
          onChange={(e) => setNewReminder(e.target.value)}
          placeholder="Skriv fakturanummer eller kund..."
          className="flex-1 px-3 py-1 border border-red-300 rounded-md text-sm"
        />
        <button
          onClick={addReminder}
          className="bg-red-600 text-white px-3 py-1 rounded-md text-sm hover:bg-red-700"
        >
          Lägg till
        </button>
      </div>
    </div>
  );
}
