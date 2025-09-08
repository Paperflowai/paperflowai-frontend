'use client';

import React, { useState, useEffect } from "react";
import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";

interface VatRate {
  id: string;
  name: string;
  rate: number;
  description: string;
  isDefault: boolean;
  isActive: boolean;
}

interface VatSettings {
  defaultRate: number;
  vatNumber: string;
  vatPeriod: 'monthly' | 'quarterly' | 'yearly';
  autoCalculate: boolean;
  includeVatInPrices: boolean;
  vatRates: VatRate[];
}

const DEFAULT_VAT_RATES: VatRate[] = [
  { id: '1', name: 'Standard moms', rate: 25, description: 'Standard momssats för de flesta varor och tjänster', isDefault: true, isActive: true },
  { id: '2', name: 'Lägre moms', rate: 12, description: 'Lägre momssats för livsmedel, böcker, tidningar', isDefault: false, isActive: true },
  { id: '3', name: 'Reducerad moms', rate: 6, description: 'Reducerad momssats för transport, hotell, restaurang', isDefault: false, isActive: true },
  { id: '4', name: 'Momsfri', rate: 0, description: 'Momsfria varor och tjänster', isDefault: false, isActive: true },
  { id: '5', name: 'EU-moms', rate: 0, description: 'EU-handel utan moms', isDefault: false, isActive: true }
];

const DEFAULT_SETTINGS: VatSettings = {
  defaultRate: 25,
  vatNumber: '',
  vatPeriod: 'quarterly',
  autoCalculate: true,
  includeVatInPrices: true,
  vatRates: DEFAULT_VAT_RATES
};

export default function VatSettingsPage() {
  const [settings, setSettings] = useState<VatSettings>(DEFAULT_SETTINGS);
  const [isEditing, setIsEditing] = useState(false);
  const [editingRate, setEditingRate] = useState<VatRate | null>(null);
  const [newRate, setNewRate] = useState<Partial<VatRate>>({
    name: '',
    rate: 0,
    description: '',
    isDefault: false,
    isActive: true
  });
  const [message, setMessage] = useState<string | null>(null);

  // Load settings from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('vat_settings');
      if (saved) {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
      }
    } catch (error) {
      console.error('Error loading VAT settings:', error);
    }
  }, []);

  const saveSettings = () => {
    try {
      localStorage.setItem('vat_settings', JSON.stringify(settings));
      setMessage('✅ Momsinställningar sparade!');
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage('❌ Ett fel uppstod vid sparning');
      console.error('Error saving VAT settings:', error);
    }
  };

  const addVatRate = () => {
    if (!newRate.name || newRate.rate === undefined) {
      setMessage('Namn och momssats är obligatoriskt');
      return;
    }

    // Check if rate already exists
    if (settings.vatRates.some(rate => rate.rate === newRate.rate)) {
      setMessage('Denna momssats finns redan');
      return;
    }

    const vatRate: VatRate = {
      id: Date.now().toString(),
      name: newRate.name!,
      rate: newRate.rate!,
      description: newRate.description || '',
      isDefault: newRate.isDefault || false,
      isActive: newRate.isActive !== false
    };

    setSettings(prev => ({
      ...prev,
      vatRates: [...prev.vatRates, vatRate].sort((a, b) => a.rate - b.rate)
    }));

    setNewRate({ name: '', rate: 0, description: '', isDefault: false, isActive: true });
    setMessage('✅ Momssats tillagd!');
    setTimeout(() => setMessage(null), 3000);
  };

  const editVatRate = (rate: VatRate) => {
    setEditingRate(rate);
    setIsEditing(true);
  };

  const updateVatRate = () => {
    if (!editingRate) return;

    setSettings(prev => ({
      ...prev,
      vatRates: prev.vatRates.map(rate => 
        rate.id === editingRate.id ? editingRate : rate
      ).sort((a, b) => a.rate - b.rate)
    }));

    setIsEditing(false);
    setEditingRate(null);
    setMessage('✅ Momssats uppdaterad!');
    setTimeout(() => setMessage(null), 3000);
  };

  const deleteVatRate = (id: string) => {
    if (window.confirm('Är du säker på att du vill ta bort denna momssats?')) {
      setSettings(prev => ({
        ...prev,
        vatRates: prev.vatRates.filter(rate => rate.id !== id)
      }));
      setMessage('✅ Momssats borttagen!');
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const setDefaultRate = (id: string) => {
    setSettings(prev => ({
      ...prev,
      vatRates: prev.vatRates.map(rate => ({
        ...rate,
        isDefault: rate.id === id
      })),
      defaultRate: prev.vatRates.find(rate => rate.id === id)?.rate || 25
    }));
    setMessage('✅ Standard momssats uppdaterad!');
    setTimeout(() => setMessage(null), 3000);
  };

  const toggleRateActive = (id: string) => {
    setSettings(prev => ({
      ...prev,
      vatRates: prev.vatRates.map(rate => 
        rate.id === id ? { ...rate, isActive: !rate.isActive } : rate
      )
    }));
  };

  const resetToDefault = () => {
    if (window.confirm('Är du säker på att du vill återställa till standardinställningar?')) {
      setSettings(DEFAULT_SETTINGS);
      setMessage('✅ Återställt till standardinställningar!');
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleSettingChange = (field: keyof VatSettings, value: any) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  return (
    <main className="px-3 sm:px-6 md:px-8 py-6 space-y-6 max-w-6xl mx-auto">
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
          href="/dashboard/settings"
          className="bg-purple-600 text-white px-4 py-2 rounded text-sm hover:bg-purple-700 transition-colors"
        >
          ⚙️ Inställningar
        </Link>
        <Link
          href="/dashboard/chart-of-accounts"
          className="bg-orange-600 text-white px-4 py-2 rounded text-sm hover:bg-orange-700 transition-colors"
        >
          📊 Kontoplan
        </Link>
        <Link
          href="/start"
          className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700 transition-colors"
        >
          🏠 Till Start
        </Link>
      </div>

      <div className="bg-white rounded-xl border p-6 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <span className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm">💰</span>
            Momsinställningar
          </h1>
          <div className="flex gap-2">
            <button
              onClick={resetToDefault}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg text-sm hover:bg-gray-700 transition-colors"
            >
              Återställ
            </button>
            <button
              onClick={saveSettings}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
            >
              Spara
            </button>
          </div>
        </div>

        {message && (
          <div className={`mb-4 p-3 rounded-lg ${
            message.includes('✅') ? 'bg-green-50 text-green-800 border border-green-200' : 
            message.includes('❌') ? 'bg-red-50 text-red-800 border border-red-200' :
            'bg-yellow-50 text-yellow-800 border border-yellow-200'
          }`}>
            {message}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* General VAT Settings */}
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Allmänna inställningar</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Momsregistreringsnummer
              </label>
              <input
                type="text"
                value={settings.vatNumber}
                onChange={(e) => handleSettingChange('vatNumber', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="SE123456789001"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Momsperiod
              </label>
              <select
                value={settings.vatPeriod}
                onChange={(e) => handleSettingChange('vatPeriod', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="monthly">Månadsvis</option>
                <option value="quarterly">Kvartalsvis</option>
                <option value="yearly">Årsvis</option>
              </select>
            </div>

            <div className="space-y-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.autoCalculate}
                  onChange={(e) => handleSettingChange('autoCalculate', e.target.checked)}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Automatisk momsberäkning</span>
              </label>
              
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.includeVatInPrices}
                  onChange={(e) => handleSettingChange('includeVatInPrices', e.target.checked)}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Inkludera moms i priser</span>
              </label>
            </div>
          </div>

          {/* VAT Rates */}
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Momssatser</h3>
            
            {/* Add new VAT rate */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium mb-3">Lägg till ny momssats</h4>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Namn
                    </label>
                    <input
                      type="text"
                      value={newRate.name || ''}
                      onChange={(e) => setNewRate(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Special moms"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Sats (%)
                    </label>
                    <input
                      type="number"
                      value={newRate.rate || ''}
                      onChange={(e) => setNewRate(prev => ({ ...prev, rate: parseFloat(e.target.value) || 0 }))}
                      className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="25"
                      step="0.1"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Beskrivning
                  </label>
                  <input
                    type="text"
                    value={newRate.description || ''}
                    onChange={(e) => setNewRate(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Beskrivning av momssatsen"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={newRate.isDefault || false}
                      onChange={(e) => setNewRate(prev => ({ ...prev, isDefault: e.target.checked }))}
                      className="mr-1"
                    />
                    <span className="text-xs text-gray-700">Standard</span>
                  </label>
                  <button
                    onClick={addVatRate}
                    className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 transition-colors"
                  >
                    Lägg till
                  </button>
                </div>
              </div>
            </div>

            {/* VAT rates list */}
            <div className="space-y-2">
              {settings.vatRates.map(rate => (
                <div key={rate.id} className={`border rounded-lg p-3 ${!rate.isActive ? 'opacity-50' : ''}`}>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm">{rate.name}</span>
                        <span className="text-sm font-mono bg-gray-100 px-2 py-0.5 rounded">
                          {rate.rate}%
                        </span>
                        {rate.isDefault && (
                          <span className="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-800">
                            Standard
                          </span>
                        )}
                        {!rate.isActive && (
                          <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
                            Inaktiv
                          </span>
                        )}
                      </div>
                      {rate.description && (
                        <p className="text-xs text-gray-600">{rate.description}</p>
                      )}
                    </div>
                    <div className="flex gap-1 ml-3">
                      <button
                        onClick={() => toggleRateActive(rate.id)}
                        className={`px-2 py-1 rounded text-xs ${
                          rate.isActive 
                            ? 'bg-yellow-600 text-white hover:bg-yellow-700' 
                            : 'bg-green-600 text-white hover:bg-green-700'
                        } transition-colors`}
                      >
                        {rate.isActive ? 'Inaktivera' : 'Aktivera'}
                      </button>
                      {!rate.isDefault && (
                        <button
                          onClick={() => setDefaultRate(rate.id)}
                          className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors"
                        >
                          Standard
                        </button>
                      )}
                      <button
                        onClick={() => editVatRate(rate)}
                        className="px-2 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700 transition-colors"
                      >
                        Redigera
                      </button>
                      <button
                        onClick={() => deleteVatRate(rate.id)}
                        className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 transition-colors"
                      >
                        Ta bort
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Edit modal */}
      {isEditing && editingRate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Redigera momssats</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Namn
                </label>
                <input
                  type="text"
                  value={editingRate.name}
                  onChange={(e) => setEditingRate(prev => prev ? { ...prev, name: e.target.value } : null)}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Momssats (%)
                </label>
                <input
                  type="number"
                  value={editingRate.rate}
                  onChange={(e) => setEditingRate(prev => prev ? { ...prev, rate: parseFloat(e.target.value) || 0 } : null)}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  step="0.1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Beskrivning
                </label>
                <input
                  type="text"
                  value={editingRate.description}
                  onChange={(e) => setEditingRate(prev => prev ? { ...prev, description: e.target.value } : null)}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={editingRate.isActive}
                    onChange={(e) => setEditingRate(prev => prev ? { ...prev, isActive: e.target.checked } : null)}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">Aktiv</span>
                </label>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setIsEditing(false)}
                className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Avbryt
              </button>
              <button
                onClick={updateVatRate}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Spara
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Help section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">💡 Tips:</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Standard momssats används för nya transaktioner</li>
          <li>• Momsregistreringsnummer behövs för EU-handel</li>
          <li>• Momsperiod avgör hur ofta du rapporterar moms</li>
          <li>• Inaktiva momssatser visas inte i dropdown-menyer</li>
        </ul>
      </div>
    </main>
  );
}
