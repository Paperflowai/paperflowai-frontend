'use client';

import React, { useState, useEffect } from "react";
import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";

interface RecurringTransaction {
  id: string;
  name: string;
  type: 'invoice' | 'expense';
  amount: number;
  vatRate: number;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  startDate: string;
  endDate?: string;
  description: string;
  isActive: boolean;
  lastExecuted?: string;
  nextExecution?: string;
}

interface AutomationSettings {
  autoBooking: boolean;
  autoVatCalculation: boolean;
  autoCustomerCreation: boolean;
  bankImportEnabled: boolean;
  bankImportFrequency: 'daily' | 'weekly' | 'monthly';
  lastBankImport?: string;
}

const DEFAULT_SETTINGS: AutomationSettings = {
  autoBooking: false,
  autoVatCalculation: true,
  autoCustomerCreation: false,
  bankImportEnabled: false,
  bankImportFrequency: 'weekly'
};

const DEFAULT_RECURRING: RecurringTransaction[] = [
  {
    id: '1',
    name: 'Lokalhyra',
    type: 'expense',
    amount: 15000,
    vatRate: 25,
    frequency: 'monthly',
    startDate: new Date().toISOString().slice(0, 10),
    description: 'Månatlig hyra för kontorslokal',
    isActive: true
  },
  {
    id: '2',
    name: 'El och värme',
    type: 'expense',
    amount: 3000,
    vatRate: 25,
    frequency: 'monthly',
    startDate: new Date().toISOString().slice(0, 10),
    description: 'Månatliga energikostnader',
    isActive: true
  },
  {
    id: '3',
    name: 'Försäkringar',
    type: 'expense',
    amount: 2000,
    vatRate: 25,
    frequency: 'yearly',
    startDate: new Date().toISOString().slice(0, 10),
    description: 'Årliga försäkringspremier',
    isActive: true
  }
];

export default function AutomationPage() {
  const [settings, setSettings] = useState<AutomationSettings>(DEFAULT_SETTINGS);
  const [recurringTransactions, setRecurringTransactions] = useState<RecurringTransaction[]>(DEFAULT_RECURRING);
  const [isEditing, setIsEditing] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<RecurringTransaction | null>(null);
  const [newTransaction, setNewTransaction] = useState<Partial<RecurringTransaction>>({
    name: '',
    type: 'expense',
    amount: 0,
    vatRate: 25,
    frequency: 'monthly',
    startDate: new Date().toISOString().slice(0, 10),
    description: '',
    isActive: true
  });
  const [message, setMessage] = useState<string | null>(null);

  // Load settings from localStorage
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('automation_settings');
      if (savedSettings) {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) });
      }

      const savedRecurring = localStorage.getItem('recurring_transactions');
      if (savedRecurring) {
        setRecurringTransactions(JSON.parse(savedRecurring));
      }
    } catch (error) {
      console.error('Error loading automation settings:', error);
    }
  }, []);

  const saveSettings = () => {
    try {
      localStorage.setItem('automation_settings', JSON.stringify(settings));
      localStorage.setItem('recurring_transactions', JSON.stringify(recurringTransactions));
      setMessage('✅ Automatiseringsinställningar sparade!');
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage('❌ Ett fel uppstod vid sparning');
      console.error('Error saving automation settings:', error);
    }
  };

  const addRecurringTransaction = () => {
    if (!newTransaction.name || !newTransaction.amount) {
      setMessage('Namn och belopp är obligatoriskt');
      return;
    }

    const transaction: RecurringTransaction = {
      id: Date.now().toString(),
      name: newTransaction.name!,
      type: newTransaction.type!,
      amount: newTransaction.amount!,
      vatRate: newTransaction.vatRate || 25,
      frequency: newTransaction.frequency!,
      startDate: newTransaction.startDate!,
      endDate: newTransaction.endDate,
      description: newTransaction.description || '',
      isActive: newTransaction.isActive !== false
    };

    setRecurringTransactions(prev => [...prev, transaction]);
    setNewTransaction({
      name: '',
      type: 'expense',
      amount: 0,
      vatRate: 25,
      frequency: 'monthly',
      startDate: new Date().toISOString().slice(0, 10),
      description: '',
      isActive: true
    });
    setMessage('✅ Återkommande transaktion tillagd!');
    setTimeout(() => setMessage(null), 3000);
  };

  const editRecurringTransaction = (transaction: RecurringTransaction) => {
    setEditingTransaction(transaction);
    setIsEditing(true);
  };

  const updateRecurringTransaction = () => {
    if (!editingTransaction) return;

    setRecurringTransactions(prev => prev.map(t => 
      t.id === editingTransaction.id ? editingTransaction : t
    ));

    setIsEditing(false);
    setEditingTransaction(null);
    setMessage('✅ Återkommande transaktion uppdaterad!');
    setTimeout(() => setMessage(null), 3000);
  };

  const deleteRecurringTransaction = (id: string) => {
    if (window.confirm('Är du säker på att du vill ta bort denna återkommande transaktion?')) {
      setRecurringTransactions(prev => prev.filter(t => t.id !== id));
      setMessage('✅ Återkommande transaktion borttagen!');
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const toggleTransactionActive = (id: string) => {
    setRecurringTransactions(prev => prev.map(t => 
      t.id === id ? { ...t, isActive: !t.isActive } : t
    ));
  };

  const executeRecurringTransaction = (id: string) => {
    const transaction = recurringTransactions.find(t => t.id === id);
    if (!transaction) return;

    // Simulate adding to bookkeeping
    const bookkeepingEntries = JSON.parse(localStorage.getItem('bookkeeping_entries') || '[]');
    const newEntry = {
      id: Date.now().toString(),
      type: transaction.type,
      supplierName: transaction.type === 'expense' ? transaction.name : undefined,
      customerName: transaction.type === 'invoice' ? transaction.name : undefined,
      invoiceDate: new Date().toISOString().slice(0, 10),
      amountInclVat: transaction.amount,
      vatAmount: transaction.amount * (transaction.vatRate / 100),
      status: 'Bokförd' as const,
      fileKey: undefined,
      fileMime: undefined
    };

    bookkeepingEntries.push(newEntry);
    localStorage.setItem('bookkeeping_entries', JSON.stringify(bookkeepingEntries));

    // Update last executed
    setRecurringTransactions(prev => prev.map(t => 
      t.id === id ? { ...t, lastExecuted: new Date().toISOString().slice(0, 10) } : t
    ));

    setMessage(`✅ ${transaction.name} bokförd!`);
    setTimeout(() => setMessage(null), 3000);
  };

  const handleSettingChange = (field: keyof AutomationSettings, value: any) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('sv-SE', { 
      style: 'currency', 
      currency: 'SEK' 
    }).format(amount || 0);
  };

  const getFrequencyLabel = (frequency: string) => {
    switch (frequency) {
      case 'daily': return 'Dagligen';
      case 'weekly': return 'Veckovis';
      case 'monthly': return 'Månadsvis';
      case 'quarterly': return 'Kvartalsvis';
      case 'yearly': return 'Årsvis';
      default: return frequency;
    }
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
          href="/start"
          className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700 transition-colors"
        >
          🏠 Till Start
        </Link>
      </div>

      <div className="bg-white rounded-xl border p-6 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <span className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm">🤖</span>
            Automatisering
          </h1>
          <button
            onClick={saveSettings}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
          >
            Spara inställningar
          </button>
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
          {/* Automation Settings */}
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Automatiseringsinställningar</h3>
            
            <div className="space-y-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.autoBooking}
                  onChange={(e) => handleSettingChange('autoBooking', e.target.checked)}
                  className="mr-3"
                />
                <div>
                  <span className="text-sm font-medium text-gray-700">Automatisk bokföring</span>
                  <p className="text-xs text-gray-500">Bokför transaktioner automatiskt efter OCR</p>
                </div>
              </label>
              
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.autoVatCalculation}
                  onChange={(e) => handleSettingChange('autoVatCalculation', e.target.checked)}
                  className="mr-3"
                />
                <div>
                  <span className="text-sm font-medium text-gray-700">Automatisk momsberäkning</span>
                  <p className="text-xs text-gray-500">Beräkna moms automatiskt baserat på inställningar</p>
                </div>
              </label>
              
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.autoCustomerCreation}
                  onChange={(e) => handleSettingChange('autoCustomerCreation', e.target.checked)}
                  className="mr-3"
                />
                <div>
                  <span className="text-sm font-medium text-gray-700">Automatisk kundskapande</span>
                  <p className="text-xs text-gray-500">Skapa nya kunder automatiskt vid första faktura</p>
                </div>
              </label>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium text-gray-800 mb-3">Bankimport</h4>
              <div className="space-y-3">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.bankImportEnabled}
                    onChange={(e) => handleSettingChange('bankImportEnabled', e.target.checked)}
                    className="mr-3"
                  />
                  <span className="text-sm text-gray-700">Aktivera bankimport</span>
                </label>
                
                {settings.bankImportEnabled && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Importfrekvens
                    </label>
                    <select
                      value={settings.bankImportFrequency}
                      onChange={(e) => handleSettingChange('bankImportFrequency', e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="daily">Dagligen</option>
                      <option value="weekly">Veckovis</option>
                      <option value="monthly">Månadsvis</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Recurring Transactions */}
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Återkommande transaktioner</h3>
            
            {/* Add new recurring transaction */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium mb-3">Lägg till ny återkommande transaktion</h4>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Namn
                    </label>
                    <input
                      type="text"
                      value={newTransaction.name || ''}
                      onChange={(e) => setNewTransaction(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Lokalhyra"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Typ
                    </label>
                    <select
                      value={newTransaction.type || 'expense'}
                      onChange={(e) => setNewTransaction(prev => ({ ...prev, type: e.target.value as 'invoice' | 'expense' }))}
                      className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="expense">Kostnad</option>
                      <option value="invoice">Intäkt</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Belopp
                    </label>
                    <input
                      type="number"
                      value={newTransaction.amount || ''}
                      onChange={(e) => setNewTransaction(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                      className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="15000"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Moms (%)
                    </label>
                    <input
                      type="number"
                      value={newTransaction.vatRate || ''}
                      onChange={(e) => setNewTransaction(prev => ({ ...prev, vatRate: parseFloat(e.target.value) || 0 }))}
                      className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="25"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Frekvens
                  </label>
                  <select
                    value={newTransaction.frequency || 'monthly'}
                    onChange={(e) => setNewTransaction(prev => ({ ...prev, frequency: e.target.value as any }))}
                    className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="daily">Dagligen</option>
                    <option value="weekly">Veckovis</option>
                    <option value="monthly">Månadsvis</option>
                    <option value="quarterly">Kvartalsvis</option>
                    <option value="yearly">Årsvis</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Beskrivning
                  </label>
                  <input
                    type="text"
                    value={newTransaction.description || ''}
                    onChange={(e) => setNewTransaction(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Beskrivning av transaktionen"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={newTransaction.isActive !== false}
                      onChange={(e) => setNewTransaction(prev => ({ ...prev, isActive: e.target.checked }))}
                      className="mr-1"
                    />
                    <span className="text-xs text-gray-700">Aktiv</span>
                  </label>
                  <button
                    onClick={addRecurringTransaction}
                    className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 transition-colors"
                  >
                    Lägg till
                  </button>
                </div>
              </div>
            </div>

            {/* Recurring transactions list */}
            <div className="space-y-2">
              {recurringTransactions.map(transaction => (
                <div key={transaction.id} className={`border rounded-lg p-3 ${!transaction.isActive ? 'opacity-50' : ''}`}>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm">{transaction.name}</span>
                        <span className="text-sm font-mono bg-gray-100 px-2 py-0.5 rounded">
                          {formatCurrency(transaction.amount)}
                        </span>
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                          {getFrequencyLabel(transaction.frequency)}
                        </span>
                        {!transaction.isActive && (
                          <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
                            Inaktiv
                          </span>
                        )}
                      </div>
                      {transaction.description && (
                        <p className="text-xs text-gray-600">{transaction.description}</p>
                      )}
                      {transaction.lastExecuted && (
                        <p className="text-xs text-gray-500">Senast kör: {transaction.lastExecuted}</p>
                      )}
                    </div>
                    <div className="flex gap-1 ml-3">
                      <button
                        onClick={() => executeRecurringTransaction(transaction.id)}
                        className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors"
                      >
                        Kör nu
                      </button>
                      <button
                        onClick={() => toggleTransactionActive(transaction.id)}
                        className={`px-2 py-1 rounded text-xs ${
                          transaction.isActive 
                            ? 'bg-yellow-600 text-white hover:bg-yellow-700' 
                            : 'bg-green-600 text-white hover:bg-green-700'
                        } transition-colors`}
                      >
                        {transaction.isActive ? 'Inaktivera' : 'Aktivera'}
                      </button>
                      <button
                        onClick={() => editRecurringTransaction(transaction)}
                        className="px-2 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700 transition-colors"
                      >
                        Redigera
                      </button>
                      <button
                        onClick={() => deleteRecurringTransaction(transaction.id)}
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
      {isEditing && editingTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Redigera återkommande transaktion</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Namn
                </label>
                <input
                  type="text"
                  value={editingTransaction.name}
                  onChange={(e) => setEditingTransaction(prev => prev ? { ...prev, name: e.target.value } : null)}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Belopp
                  </label>
                  <input
                    type="number"
                    value={editingTransaction.amount}
                    onChange={(e) => setEditingTransaction(prev => prev ? { ...prev, amount: parseFloat(e.target.value) || 0 } : null)}
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Moms (%)
                  </label>
                  <input
                    type="number"
                    value={editingTransaction.vatRate}
                    onChange={(e) => setEditingTransaction(prev => prev ? { ...prev, vatRate: parseFloat(e.target.value) || 0 } : null)}
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Beskrivning
                </label>
                <input
                  type="text"
                  value={editingTransaction.description}
                  onChange={(e) => setEditingTransaction(prev => prev ? { ...prev, description: e.target.value } : null)}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={editingTransaction.isActive}
                    onChange={(e) => setEditingTransaction(prev => prev ? { ...prev, isActive: e.target.checked } : null)}
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
                onClick={updateRecurringTransaction}
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
          <li>• Återkommande transaktioner kan köras manuellt med "Kör nu"</li>
          <li>• Automatisk bokföring sparar tid vid OCR-hantering</li>
          <li>• Bankimport kommer att stödjas i framtida versioner</li>
          <li>• Inaktiva transaktioner körs inte automatiskt</li>
        </ul>
      </div>
    </main>
  );
}
