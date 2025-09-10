"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function SkapaNyKund() {
  const router = useRouter();

  useEffect(() => {
    // Skapa en ny kund automatiskt och redirecta
    const createAndRedirect = async () => {
      try {
        const newId = Date.now().toString();
        const customerNumber = `K-${Math.floor(Math.random() * 9000000) + 1000000}`;
        const today = new Date().toISOString().split('T')[0];
        
        const newCustomer = {
          id: newId,
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
          contactDate: today,
          notes: "",
          customerNumber: customerNumber,
          offers: []
        };

        // Spara till localStorage
        const existingCustomers = JSON.parse(localStorage.getItem('paperflow_customers_v1') || '[]');
        existingCustomers.push(newCustomer);
        localStorage.setItem('paperflow_customers_v1', JSON.stringify(existingCustomers));

        // Redirecta till kundkortet
        router.push(`/kund/${newId}`);
      } catch (error) {
        console.error('Error creating customer:', error);
        // Om det misslyckas, gå tillbaka till dashboard
        router.push('/dashboard');
      }
    };

    createAndRedirect();
  }, [router]);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Skapar ny kund...</h1>
      <p className="text-gray-600">Du omdirigeras automatiskt till kundkortet.</p>
    </div>
  );
}