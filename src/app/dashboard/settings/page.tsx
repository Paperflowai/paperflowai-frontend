'use client';

import React, { useState, useEffect } from "react";
import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";

interface CompanySettings {
  companyName: string;
  orgNumber: string;
  address: string;
  zip: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  vatNumber: string;
  bankAccount: string;
  defaultVatRate: number;
}

const DEFAULT_SETTINGS: CompanySettings = {
  companyName: "PaperflowAI Kund",
  orgNumber: "5561234567",
  address: "",
  zip: "",
  city: "",
  country: "Sverige",
  phone: "",
  email: "",
  vatNumber: "",
  bankAccount: "",
  defaultVatRate: 25
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<CompanySettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Load settings from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('company_settings');
      if (saved) {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }, []);

  const handleSave = async () => {
    setIsLoading(true);
    setMessage(null);
    
    try {
      // Validate required fields
      if (!settings.companyName.trim()) {
        setMessage('Företagsnamn är obligatoriskt');
        return;
      }
      
      if (!settings.orgNumber.trim()) {
        setMessage('Organisationsnummer är obligatoriskt');
        return;
      }

      // Save to localStorage
      localStorage.setItem('company_settings', JSON.stringify(settings));
      
      setMessage('✅ Inställningar sparade!');
      setTimeout(() => setMessage(null), 3000);
      
    } catch (error) {
      setMessage('❌ Ett fel uppstod vid sparning');
      console.error('Error saving settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: keyof CompanySettings, value: string | number) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  return (
    <main className="px-3 sm:px-6 md:px-8 py-6 space-y-6 max-w-4xl mx-auto">
      <LogoutButton />
      
      {/* Navigation */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Link
          href="/dashboard"
          className="bg-gray-600 text-white px-4 py-2 rounded text-sm hover:bg-gray-700 transition-colors"
        >
          ← Tillbaka till kundregister
        </Link>
        <Link
          href="/dashboard/bookkeepingboard"
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 transition-colors"
        >
          Till bokföringen →
        </Link>
        <Link
          href="/dashboard/chart-of-accounts"
          className="bg-orange-600 text-white px-4 py-2 rounded text-sm hover:bg-orange-700 transition-colors"
        >
          📊 Kontoplan
        </Link>
        <Link
          href="/dashboard/vat-settings"
          className="bg-red-600 text-white px-4 py-2 rounded text-sm hover:bg-red-700 transition-colors"
        >
          💰 Moms
        </Link>
        <Link
          href="/start"
          className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700 transition-colors"
        >
          🏠 Till Start
        </Link>
      </div>

      <div className="bg-white rounded-xl border p-6 shadow-sm">
        <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <span className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm">⚙️</span>
          Företagsinställningar
        </h1>

        {message && (
          <div className={`mb-4 p-3 rounded-lg ${
            message.includes('✅') ? 'bg-green-50 text-green-800 border border-green-200' : 
            message.includes('❌') ? 'bg-red-50 text-red-800 border border-red-200' :
            'bg-yellow-50 text-yellow-800 border border-yellow-200'
          }`}>
            {message}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Grundinformation</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Företagsnamn *
              </label>
              <input
                type="text"
                value={settings.companyName}
                onChange={(e) => handleInputChange('companyName', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ditt företagsnamn"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Organisationsnummer *
              </label>
              <input
                type="text"
                value={settings.orgNumber}
                onChange={(e) => handleInputChange('orgNumber', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="123456-7890"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Momsregistreringsnummer
              </label>
              <input
                type="text"
                value={settings.vatNumber}
                onChange={(e) => handleInputChange('vatNumber', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="SE123456789001"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Standard momssats (%)
              </label>
              <select
                value={settings.defaultVatRate}
                onChange={(e) => handleInputChange('defaultVatRate', parseInt(e.target.value))}
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={0}>0% (Momsfri)</option>
                <option value={6}>6% (Lägre moms)</option>
                <option value={12}>12% (Lägre moms)</option>
                <option value={25}>25% (Standard moms)</option>
              </select>
            </div>
          </div>

          {/* Contact Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Kontaktinformation</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Adress
              </label>
              <input
                type="text"
                value={settings.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Gatunamn 123"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Postnummer
                </label>
                <input
                  type="text"
                  value={settings.zip}
                  onChange={(e) => handleInputChange('zip', e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="123 45"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ort
                </label>
                <input
                  type="text"
                  value={settings.city}
                  onChange={(e) => handleInputChange('city', e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Stockholm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Land
              </label>
              <input
                type="text"
                value={settings.country}
                onChange={(e) => handleInputChange('country', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Sverige"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Telefon
              </label>
              <input
                type="tel"
                value={settings.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="08-123 456 78"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                E-post
              </label>
              <input
                type="email"
                value={settings.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="info@foretag.se"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bankkonto
              </label>
              <input
                type="text"
                value={settings.bankAccount}
                onChange={(e) => handleInputChange('bankAccount', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="1234-5678 9012 3456"
              />
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-end">
          <button
            onClick={handleSave}
            disabled={isLoading}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Sparar...' : 'Spara inställningar'}
          </button>
        </div>
      </div>

      {/* Help section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">💡 Tips:</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Företagsnamn och organisationsnummer används i SIE-exporter</li>
          <li>• Momsregistreringsnummer behövs för EU-handel</li>
          <li>• Standard momssats används för nya transaktioner</li>
          <li>• Alla fält sparas lokalt i din webbläsare</li>
        </ul>
      </div>
    </main>
  );
}
