"use client";

import { isProd } from '@/utils/env';
import { notFound } from 'next/navigation';
import { useEffect } from "react";
import CustomerOffersPanel from "@/components/CustomerOffersPanel";

if (isProd) notFound();

export default function TestCustomerPage() {
  useEffect(() => {
    // Skapa en test-kund med offertdata
    const testCustomer = {
      id: "test-123",
      companyName: "Test Företag AB",
      orgNr: "556123-4567",
      contactPerson: "Anna Andersson",
      role: "VD",
      phone: "08-123 45 67",
      email: "anna@testforetag.se",
      address: "Testgatan 123",
      zip: "123 45",
      city: "Stockholm",
      country: "Sverige",
      contactDate: new Date().toISOString().split('T')[0],
      notes: "Test-kund för att testa offertfunktionalitet",
      customerNumber: "K-1234567",
      offers: [
        {
          offerId: "OFF-2024-0001",
          date: new Date().toISOString().split('T')[0],
          items: [
            {
              name: "Webbutveckling",
              qty: 40,
              unit: "tim",
              unitPriceExVat: 1200,
              lineTotalExVat: 48000
            }
          ],
          total: 48000,
          currency: "SEK",
          validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        }
      ]
    };

    // Spara test-kunden i localStorage
    const existingCustomers = JSON.parse(localStorage.getItem('paperflow_customers_v1') || '[]');
    const existingIndex = existingCustomers.findIndex((c: any) => c.id === testCustomer.id);
    
    if (existingIndex !== -1) {
      existingCustomers[existingIndex] = testCustomer;
    } else {
      existingCustomers.push(testCustomer);
    }
    
    localStorage.setItem('paperflow_customers_v1', JSON.stringify(existingCustomers));
    
    console.log("Test-kund skapad:", testCustomer);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Test CustomerOffersPanel</h1>
        <p className="mb-4 text-gray-600">
          Denna sida testar CustomerOffersPanel med en test-kund som har en offert.
          Klicka på "Skicka till kundkort" för att testa funktionaliteten.
        </p>
        
        <CustomerOffersPanel customerId="test-123" />
        
        <div className="mt-8 p-4 bg-blue-50 rounded-lg">
          <h2 className="font-semibold mb-2">Test-instruktioner:</h2>
          <ol className="list-decimal list-inside space-y-1 text-sm">
            <li>Du bör se en offert i panelen ovan</li>
            <li>Klicka på "Skicka till kundkort"</li>
            <li>Du bör få en bekräftelse med kund-ID och kundnummer</li>
            <li>Kunddata ska sparas i localStorage</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
