"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";

export default function SkapaNyKund() {
  const router = useRouter();

  const [data, setData] = useState({
    companyName: "",
    orgNr: "",
    contactPerson: "",
    role: "",
    phone: "",
    email: "",
    address: "",
    zip: "",
    city: "",
    country: "Sverige",
    contactDate: "",
    notes: "",
    customerNumber: Date.now().toString(),
  });

  const handleSave = () => {
    const kunder = JSON.parse(localStorage.getItem("kunder") || "[]");
    const newId = Date.now();
    kunder.push({ ...data, id: newId });
    localStorage.setItem("kunder", JSON.stringify(kunder));

    // 🚀 Hoppa direkt till kundkortet
    router.push(`/kund/${newId}`);
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Lägg till ny kund</h1>

      {/* Till bokföringen-knapp */}
      <div className="mb-4 flex justify-between">
        <Link
          href="/start"
          className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700 transition-colors"
        >
          🏠 Tillbaka till Start
        </Link>
        <Link
          href="/dashboard/bookkeepingboard"
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 transition-colors"
        >
          Till bokföringen →
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <input
          type="text"
          placeholder="Företagsnamn"
          className="border p-2"
          value={data.companyName}
          onChange={(e) => setData({ ...data, companyName: e.target.value })}
        />
        <input
          type="text"
          placeholder="Organisationsnummer"
          className="border p-2"
          value={data.orgNr}
          onChange={(e) => setData({ ...data, orgNr: e.target.value })}
        />
        <input
          type="text"
          placeholder="Kontaktperson"
          className="border p-2"
          value={data.contactPerson}
          onChange={(e) => setData({ ...data, contactPerson: e.target.value })}
        />
        <input
          type="text"
          placeholder="Roll"
          className="border p-2"
          value={data.role}
          onChange={(e) => setData({ ...data, role: e.target.value })}
        />
        <input
          type="text"
          placeholder="Telefon"
          className="border p-2"
          value={data.phone}
          onChange={(e) => setData({ ...data, phone: e.target.value })}
        />
        <input
          type="email"
          placeholder="E-post"
          className="border p-2"
          value={data.email}
          onChange={(e) => setData({ ...data, email: e.target.value })}
        />
        <input
          type="text"
          placeholder="Adress"
          className="border p-2"
          value={data.address}
          onChange={(e) => setData({ ...data, address: e.target.value })}
        />
        <input
          type="text"
          placeholder="Postnummer"
          className="border p-2"
          value={data.zip}
          onChange={(e) => setData({ ...data, zip: e.target.value })}
        />
        <input
          type="text"
          placeholder="Stad"
          className="border p-2"
          value={data.city}
          onChange={(e) => setData({ ...data, city: e.target.value })}
        />
        <input
          type="text"
          placeholder="Land"
          className="border p-2"
          value={data.country}
          onChange={(e) => setData({ ...data, country: e.target.value })}
        />
        <input
          type="date"
          className="border p-2"
          value={data.contactDate}
          onChange={(e) => setData({ ...data, contactDate: e.target.value })}
        />
        <textarea
          placeholder="Anteckningar"
          className="border p-2 md:col-span-2"
          value={data.notes}
          onChange={(e) => setData({ ...data, notes: e.target.value })}
        />
      </div>

      <button
        onClick={handleSave}
        className="bg-blue-500 text-white px-4 py-2 mt-4 rounded"
      >
        Spara kund
      </button>
    </div>
  );
}
