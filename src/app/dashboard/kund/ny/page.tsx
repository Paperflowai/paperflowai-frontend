"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SkapaNyKund() {
  const router = useRouter();

  useEffect(() => {
    const nyttId = Date.now(); // 🔸 Skapar ett unikt ID, t.ex. 1691234567890

    const tomKund = {
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
      customerNumber: ""
    };

    // 🔸 Sparar kundens tomma data i webbläsarens minne
    localStorage.setItem(`kund_${nyttId}`, JSON.stringify(tomKund));

    // 🔸 Skickar dig direkt till rätt sida: /kund/1691234567890
    router.replace(`/kund/${nyttId}`);
  }, [router]);

  // 🔸 Visar bara en tillfällig text under tiden
  return <div className="p-4 text-gray-600 text-center">Skapar ny kund...</div>;
}
