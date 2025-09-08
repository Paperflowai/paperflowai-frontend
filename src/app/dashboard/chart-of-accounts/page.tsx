'use client';

import React, { useState, useEffect } from "react";
import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";

interface Account {
  id: string;
  number: string;
  name: string;
  type: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
  vatAccount: boolean;
  description: string;
}

const DEFAULT_ACCOUNTS: Account[] = [
  // Tillgångar
  { id: '1', number: '1930', name: 'Kassa/Bank', type: 'asset', vatAccount: false, description: 'Kontant medel och bankkonton' },
  { id: '2', number: '1510', name: 'Kundfordringar', type: 'asset', vatAccount: false, description: 'Fordringar från kunder' },
  { id: '3', number: '1910', name: 'Lager', type: 'asset', vatAccount: false, description: 'Varulager och råvaror' },
  
  // Skulder
  { id: '4', number: '2440', name: 'Leverantörsskulder', type: 'liability', vatAccount: false, description: 'Skulder till leverantörer' },
  { id: '5', number: '2640', name: 'Utgående moms', type: 'liability', vatAccount: true, description: 'Moms på försäljning' },
  { id: '6', number: '2641', name: 'Inkommande moms', type: 'liability', vatAccount: true, description: 'Moms på inköp' },
  
  // Eget kapital
  { id: '7', number: '2010', name: 'Eget kapital', type: 'equity', vatAccount: false, description: 'Företagets eget kapital' },
  
  // Intäkter
  { id: '8', number: '3001', name: 'Försäljning', type: 'income', vatAccount: false, description: 'Intäkter från försäljning' },
  { id: '9', number: '3002', name: 'Tjänster', type: 'income', vatAccount: false, description: 'Intäkter från tjänster' },
  
  // Kostnader
  { id: '10', number: '4010', name: 'Inköp varor', type: 'expense', vatAccount: false, description: 'Kostnader för inköpta varor' },
  { id: '11', number: '4011', name: 'Inköp tjänster', type: 'expense', vatAccount: false, description: 'Kostnader för inköpta tjänster' },
  { id: '12', number: '5010', name: 'Lokalhyra', type: 'expense', vatAccount: false, description: 'Hyra för lokaler' },
  { id: '13', number: '5020', name: 'El och värme', type: 'expense', vatAccount: false, description: 'Energikostnader' },
  { id: '14', number: '5030', name: 'Telefon och internet', type: 'expense', vatAccount: false, description: 'Kommunikationskostnader' },
  { id: '15', number: '5040', name: 'Försäkringar', type: 'expense', vatAccount: false, description: 'Försäkringspremier' },
  { id: '16', number: '5050', name: 'Marknadsföring', type: 'expense', vatAccount: false, description: 'Reklam och marknadsföring' },
  { id: '17', number: '5060', name: 'Resor och representation', type: 'expense', vatAccount: false, description: 'Resekostnader och representation' },
  { id: '18', number: '5070', name: 'Kontorsmaterial', type: 'expense', vatAccount: false, description: 'Papper, pennor, etc.' },
  { id: '19', number: '5080', name: 'IT och programvara', type: 'expense', vatAccount: false, description: 'Datorer, program, etc.' },
  { id: '20', number: '5090', name: 'Övriga kostnader', type: 'expense', vatAccount: false, description: 'Övriga driftskostnader' }
];

export default function ChartOfAccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>(DEFAULT_ACCOUNTS);
  const [isEditing, setIsEditing] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [newAccount, setNewAccount] = useState<Partial<Account>>({
    number: '',
    name: '',
    type: 'expense',
    vatAccount: false,
    description: ''
  });
  const [message, setMessage] = useState<string | null>(null);

  // Load accounts from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('chart_of_accounts');
      if (saved) {
        setAccounts(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Error loading accounts:', error);
    }
  }, []);

  const saveAccounts = () => {
    try {
      localStorage.setItem('chart_of_accounts', JSON.stringify(accounts));
      setMessage('✅ Kontoplan sparad!');
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage('❌ Ett fel uppstod vid sparning');
      console.error('Error saving accounts:', error);
    }
  };

  const addAccount = () => {
    if (!newAccount.number || !newAccount.name) {
      setMessage('Kontonummer och namn är obligatoriskt');
      return;
    }

    // Check if account number already exists
    if (accounts.some(acc => acc.number === newAccount.number)) {
      setMessage('Kontonummer finns redan');
      return;
    }

    const account: Account = {
      id: Date.now().toString(),
      number: newAccount.number!,
      name: newAccount.name!,
      type: newAccount.type!,
      vatAccount: newAccount.vatAccount || false,
      description: newAccount.description || ''
    };

    setAccounts(prev => [...prev, account].sort((a, b) => a.number.localeCompare(b.number)));
    setNewAccount({ number: '', name: '', type: 'expense', vatAccount: false, description: '' });
    setMessage('✅ Konto tillagt!');
    setTimeout(() => setMessage(null), 3000);
  };

  const editAccount = (account: Account) => {
    setEditingAccount(account);
    setIsEditing(true);
  };

  const updateAccount = () => {
    if (!editingAccount) return;

    setAccounts(prev => prev.map(acc => 
      acc.id === editingAccount.id ? editingAccount : acc
    ).sort((a, b) => a.number.localeCompare(b.number)));
    
    setIsEditing(false);
    setEditingAccount(null);
    setMessage('✅ Konto uppdaterat!');
    setTimeout(() => setMessage(null), 3000);
  };

  const deleteAccount = (id: string) => {
    if (window.confirm('Är du säker på att du vill ta bort detta konto?')) {
      setAccounts(prev => prev.filter(acc => acc.id !== id));
      setMessage('✅ Konto borttaget!');
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const resetToDefault = () => {
    if (window.confirm('Är du säker på att du vill återställa till standardkontoplan? Detta kommer att ta bort alla anpassade konton.')) {
      setAccounts(DEFAULT_ACCOUNTS);
      setMessage('✅ Återställt till standardkontoplan!');
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const getTypeColor = (type: Account['type']) => {
    switch (type) {
      case 'asset': return 'bg-green-100 text-green-800';
      case 'liability': return 'bg-red-100 text-red-800';
      case 'equity': return 'bg-blue-100 text-blue-800';
      case 'income': return 'bg-purple-100 text-purple-800';
      case 'expense': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeLabel = (type: Account['type']) => {
    switch (type) {
      case 'asset': return 'Tillgång';
      case 'liability': return 'Skuld';
      case 'equity': return 'Eget kapital';
      case 'income': return 'Intäkt';
      case 'expense': return 'Kostnad';
      default: return type;
    }
  };

  const groupedAccounts = accounts.reduce((groups, account) => {
    if (!groups[account.type]) {
      groups[account.type] = [];
    }
    groups[account.type].push(account);
    return groups;
  }, {} as Record<string, Account[]>);

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
            <span className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm">📊</span>
            Kontoplan
          </h1>
          <div className="flex gap-2">
            <button
              onClick={resetToDefault}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg text-sm hover:bg-gray-700 transition-colors"
            >
              Återställ
            </button>
            <button
              onClick={saveAccounts}
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

        {/* Add new account */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h3 className="text-lg font-semibold mb-3">Lägg till nytt konto</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kontonummer *
              </label>
              <input
                type="text"
                value={newAccount.number || ''}
                onChange={(e) => setNewAccount(prev => ({ ...prev, number: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="3001"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kontonamn *
              </label>
              <input
                type="text"
                value={newAccount.name || ''}
                onChange={(e) => setNewAccount(prev => ({ ...prev, name: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Försäljning"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kontotyp
              </label>
              <select
                value={newAccount.type || 'expense'}
                onChange={(e) => setNewAccount(prev => ({ ...prev, type: e.target.value as Account['type'] }))}
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="asset">Tillgång</option>
                <option value="liability">Skuld</option>
                <option value="equity">Eget kapital</option>
                <option value="income">Intäkt</option>
                <option value="expense">Kostnad</option>
              </select>
            </div>
            <div className="md:col-span-2 lg:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Beskrivning
              </label>
              <input
                type="text"
                value={newAccount.description || ''}
                onChange={(e) => setNewAccount(prev => ({ ...prev, description: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Beskrivning av kontot"
              />
            </div>
            <div className="flex items-center">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={newAccount.vatAccount || false}
                  onChange={(e) => setNewAccount(prev => ({ ...prev, vatAccount: e.target.checked }))}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Momskonto</span>
              </label>
            </div>
            <div className="flex items-end">
              <button
                onClick={addAccount}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors"
              >
                Lägg till konto
              </button>
            </div>
          </div>
        </div>

        {/* Accounts list */}
        <div className="space-y-6">
          {Object.entries(groupedAccounts).map(([type, typeAccounts]) => (
            <div key={type} className="border rounded-lg">
              <div className="bg-gray-50 px-4 py-3 border-b">
                <h3 className="font-semibold text-gray-800">
                  {getTypeLabel(type as Account['type'])} ({typeAccounts.length} konton)
                </h3>
              </div>
              <div className="divide-y">
                {typeAccounts.map(account => (
                  <div key={account.id} className="p-4 hover:bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                            {account.number}
                          </span>
                          <span className="font-semibold">{account.name}</span>
                          <span className={`px-2 py-1 rounded text-xs ${getTypeColor(account.type)}`}>
                            {getTypeLabel(account.type)}
                          </span>
                          {account.vatAccount && (
                            <span className="px-2 py-1 rounded text-xs bg-yellow-100 text-yellow-800">
                              Moms
                            </span>
                          )}
                        </div>
                        {account.description && (
                          <p className="text-sm text-gray-600">{account.description}</p>
                        )}
                      </div>
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => editAccount(account)}
                          className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
                        >
                          Redigera
                        </button>
                        <button
                          onClick={() => deleteAccount(account.id)}
                          className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition-colors"
                        >
                          Ta bort
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Edit modal */}
      {isEditing && editingAccount && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Redigera konto</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kontonummer
                </label>
                <input
                  type="text"
                  value={editingAccount.number}
                  onChange={(e) => setEditingAccount(prev => prev ? { ...prev, number: e.target.value } : null)}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kontonamn
                </label>
                <input
                  type="text"
                  value={editingAccount.name}
                  onChange={(e) => setEditingAccount(prev => prev ? { ...prev, name: e.target.value } : null)}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Beskrivning
                </label>
                <input
                  type="text"
                  value={editingAccount.description}
                  onChange={(e) => setEditingAccount(prev => prev ? { ...prev, description: e.target.value } : null)}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={editingAccount.vatAccount}
                    onChange={(e) => setEditingAccount(prev => prev ? { ...prev, vatAccount: e.target.checked } : null)}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">Momskonto</span>
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
                onClick={updateAccount}
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
          <li>• Kontonummer används i SIE-exporter och bokföring</li>
          <li>• Momskonton (2640, 2641) används automatiskt för momsberäkningar</li>
          <li>• Standardkontoplan följer svenska redovisningsstandarder</li>
          <li>• Du kan lägga till, redigera och ta bort konton efter behov</li>
        </ul>
      </div>
    </main>
  );
}
