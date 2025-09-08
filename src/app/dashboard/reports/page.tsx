'use client';

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";

interface BookkeepEntry {
  id: string;
  type: 'invoice' | 'expense';
  customerId?: string | null;
  customerName?: string;
  invoiceNo?: string;
  supplierName?: string;
  invoiceDate: string;
  amountInclVat: number;
  vatAmount: number;
  fileKey?: string;
  fileMime?: string;
  status: 'Bokförd' | 'Att bokföra';
  publicUrl?: string;
}

interface ReportData {
  period: string;
  income: number;
  expenses: number;
  vatOut: number;
  vatIn: number;
  netResult: number;
  vatToPay: number;
  transactionCount: number;
}

interface CustomerAnalysis {
  customerName: string;
  totalAmount: number;
  transactionCount: number;
  lastTransaction: string;
  averageAmount: number;
}

const BK_KEY = 'bookkeeping_entries';

export default function ReportsPage() {
  const [entries, setEntries] = useState<BookkeepEntry[]>([]);
  const [selectedReport, setSelectedReport] = useState<'yearly' | 'quarterly' | 'monthly' | 'customer'>('yearly');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedQuarter, setSelectedQuarter] = useState(1);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [message, setMessage] = useState<string | null>(null);

  // Load entries from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(BK_KEY);
      setEntries(raw ? JSON.parse(raw) : []);
    } catch (error) {
      console.error('Error loading entries:', error);
      setEntries([]);
    }
  }, []);

  // Get available years
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    entries.forEach(entry => {
      const year = new Date(entry.invoiceDate).getFullYear();
      years.add(year);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [entries]);

  // Generate yearly report
  const yearlyReport = useMemo(() => {
    const yearEntries = entries.filter(entry => 
      new Date(entry.invoiceDate).getFullYear() === selectedYear
    );

    const income = yearEntries.filter(e => e.type === 'invoice');
    const expenses = yearEntries.filter(e => e.type === 'expense');
    
    const incomeSum = income.reduce((s, x) => s + (x.amountInclVat || 0), 0);
    const expenseSum = expenses.reduce((s, x) => s + (x.amountInclVat || 0), 0);
    const vatOut = income.reduce((s, x) => s + (x.vatAmount || 0), 0);
    const vatIn = expenses.reduce((s, x) => s + (x.vatAmount || 0), 0);
    
    return {
      period: `${selectedYear}`,
      income: incomeSum,
      expenses: expenseSum,
      vatOut,
      vatIn,
      netResult: incomeSum - expenseSum,
      vatToPay: vatOut - vatIn,
      transactionCount: yearEntries.length
    };
  }, [entries, selectedYear]);

  // Generate quarterly report
  const quarterlyReport = useMemo(() => {
    const quarterStart = (selectedQuarter - 1) * 3 + 1;
    const quarterEnd = selectedQuarter * 3;
    
    const quarterEntries = entries.filter(entry => {
      const date = new Date(entry.invoiceDate);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      return year === selectedYear && month >= quarterStart && month <= quarterEnd;
    });

    const income = quarterEntries.filter(e => e.type === 'invoice');
    const expenses = quarterEntries.filter(e => e.type === 'expense');
    
    const incomeSum = income.reduce((s, x) => s + (x.amountInclVat || 0), 0);
    const expenseSum = expenses.reduce((s, x) => s + (x.amountInclVat || 0), 0);
    const vatOut = income.reduce((s, x) => s + (x.vatAmount || 0), 0);
    const vatIn = expenses.reduce((s, x) => s + (x.vatAmount || 0), 0);
    
    return {
      period: `Q${selectedQuarter} ${selectedYear}`,
      income: incomeSum,
      expenses: expenseSum,
      vatOut,
      vatIn,
      netResult: incomeSum - expenseSum,
      vatToPay: vatOut - vatIn,
      transactionCount: quarterEntries.length
    };
  }, [entries, selectedYear, selectedQuarter]);

  // Generate monthly report
  const monthlyReport = useMemo(() => {
    const monthEntries = entries.filter(entry => {
      const date = new Date(entry.invoiceDate);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      return year === selectedYear && month === selectedMonth;
    });

    const income = monthEntries.filter(e => e.type === 'invoice');
    const expenses = monthEntries.filter(e => e.type === 'expense');
    
    const incomeSum = income.reduce((s, x) => s + (x.amountInclVat || 0), 0);
    const expenseSum = expenses.reduce((s, x) => s + (x.amountInclVat || 0), 0);
    const vatOut = income.reduce((s, x) => s + (x.vatAmount || 0), 0);
    const vatIn = expenses.reduce((s, x) => s + (x.vatAmount || 0), 0);
    
    const monthNames = [
      'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
      'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'
    ];
    
    return {
      period: `${monthNames[selectedMonth - 1]} ${selectedYear}`,
      income: incomeSum,
      expenses: expenseSum,
      vatOut,
      vatIn,
      netResult: incomeSum - expenseSum,
      vatToPay: vatOut - vatIn,
      transactionCount: monthEntries.length
    };
  }, [entries, selectedYear, selectedMonth]);

  // Generate customer analysis
  const customerAnalysis = useMemo(() => {
    const customerMap = new Map<string, {
      totalAmount: number;
      transactionCount: number;
      lastTransaction: string;
    }>();

    entries.forEach(entry => {
      if (entry.type === 'invoice' && entry.customerName) {
        const existing = customerMap.get(entry.customerName) || {
          totalAmount: 0,
          transactionCount: 0,
          lastTransaction: entry.invoiceDate
        };

        customerMap.set(entry.customerName, {
          totalAmount: existing.totalAmount + entry.amountInclVat,
          transactionCount: existing.transactionCount + 1,
          lastTransaction: entry.invoiceDate > existing.lastTransaction ? entry.invoiceDate : existing.lastTransaction
        });
      }
    });

    return Array.from(customerMap.entries()).map(([customerName, data]) => ({
      customerName,
      totalAmount: data.totalAmount,
      transactionCount: data.transactionCount,
      lastTransaction: data.lastTransaction,
      averageAmount: data.totalAmount / data.transactionCount
    })).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [entries]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('sv-SE', { 
      style: 'currency', 
      currency: 'SEK' 
    }).format(amount || 0);
  };

  const exportReport = (reportData: ReportData, format: 'csv' | 'pdf') => {
    if (format === 'csv') {
      const csvContent = [
        ['Period', 'Intäkter', 'Kostnader', 'Utgående moms', 'Inkommande moms', 'Nettoresultat', 'Moms att betala', 'Antal transaktioner'],
        [
          reportData.period,
          reportData.income.toString(),
          reportData.expenses.toString(),
          reportData.vatOut.toString(),
          reportData.vatIn.toString(),
          reportData.netResult.toString(),
          reportData.vatToPay.toString(),
          reportData.transactionCount.toString()
        ]
      ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rapport_${reportData.period.replace(/\s+/g, '_')}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } else {
      // PDF export would require a library like jsPDF
      setMessage('PDF-export kommer snart!');
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const exportCustomerAnalysis = () => {
    const csvContent = [
      ['Kund', 'Totalbelopp', 'Antal transaktioner', 'Genomsnittligt belopp', 'Senaste transaktion'],
      ...customerAnalysis.map(customer => [
        customer.customerName,
        customer.totalAmount.toString(),
        customer.transactionCount.toString(),
        customer.averageAmount.toString(),
        customer.lastTransaction
      ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kundanalys_${new Date().getFullYear()}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const getCurrentReport = () => {
    switch (selectedReport) {
      case 'yearly': return yearlyReport;
      case 'quarterly': return quarterlyReport;
      case 'monthly': return monthlyReport;
      default: return yearlyReport;
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
            <span className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm">📊</span>
            Rapporter & Analys
          </h1>
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

        {/* Report type selector */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => setSelectedReport('yearly')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedReport === 'yearly' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Årsrapport
            </button>
            <button
              onClick={() => setSelectedReport('quarterly')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedReport === 'quarterly' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Kvartalsrapport
            </button>
            <button
              onClick={() => setSelectedReport('monthly')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedReport === 'monthly' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Månadsrapport
            </button>
            <button
              onClick={() => setSelectedReport('customer')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedReport === 'customer' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Kundanalys
            </button>
          </div>

          {/* Period selectors */}
          {selectedReport !== 'customer' && (
            <div className="flex flex-wrap gap-4 items-center">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  År
                </label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {availableYears.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>

              {selectedReport === 'quarterly' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Kvartal
                  </label>
                  <select
                    value={selectedQuarter}
                    onChange={(e) => setSelectedQuarter(parseInt(e.target.value))}
                    className="border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={1}>Q1 (Jan-Mar)</option>
                    <option value={2}>Q2 (Apr-Jun)</option>
                    <option value={3}>Q3 (Jul-Sep)</option>
                    <option value={4}>Q4 (Okt-Dec)</option>
                  </select>
                </div>
              )}

              {selectedReport === 'monthly' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Månad
                  </label>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                    className="border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {[
                      'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
                      'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'
                    ].map((month, index) => (
                      <option key={index + 1} value={index + 1}>{month}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Report content */}
        {selectedReport === 'customer' ? (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Kundanalys</h3>
              <button
                onClick={exportCustomerAnalysis}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors"
              >
                Exportera CSV
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full border rounded-lg">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Kund</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Totalbelopp</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Transaktioner</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Genomsnitt</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Senaste</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {customerAnalysis.map((customer, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium">{customer.customerName}</td>
                      <td className="px-4 py-3 text-sm text-right">{formatCurrency(customer.totalAmount)}</td>
                      <td className="px-4 py-3 text-sm text-center">{customer.transactionCount}</td>
                      <td className="px-4 py-3 text-sm text-right">{formatCurrency(customer.averageAmount)}</td>
                      <td className="px-4 py-3 text-sm">{customer.lastTransaction}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Rapport för {getCurrentReport().period}</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => exportReport(getCurrentReport(), 'csv')}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors"
                >
                  Exportera CSV
                </button>
                <button
                  onClick={() => exportReport(getCurrentReport(), 'pdf')}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors"
                >
                  Exportera PDF
                </button>
              </div>
            </div>

            {/* Report cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-600 font-medium">Intäkter</p>
                <p className="text-xl font-bold text-green-800">{formatCurrency(getCurrentReport().income)}</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-600 font-medium">Kostnader</p>
                <p className="text-xl font-bold text-red-800">{formatCurrency(getCurrentReport().expenses)}</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-600 font-medium">Nettoresultat</p>
                <p className={`text-xl font-bold ${getCurrentReport().netResult >= 0 ? 'text-green-800' : 'text-red-800'}`}>
                  {formatCurrency(getCurrentReport().netResult)}
                </p>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <p className="text-sm text-purple-600 font-medium">Moms att betala</p>
                <p className="text-xl font-bold text-purple-800">{formatCurrency(getCurrentReport().vatToPay)}</p>
              </div>
            </div>

            {/* Detailed breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold mb-3">Momsuppdelning</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Utgående moms:</span>
                    <span className="text-sm font-medium">{formatCurrency(getCurrentReport().vatOut)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Inkommande moms:</span>
                    <span className="text-sm font-medium">{formatCurrency(getCurrentReport().vatIn)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="text-sm font-medium">Moms att betala:</span>
                    <span className="text-sm font-bold">{formatCurrency(getCurrentReport().vatToPay)}</span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold mb-3">Statistik</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Antal transaktioner:</span>
                    <span className="text-sm font-medium">{getCurrentReport().transactionCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Genomsnitt per transaktion:</span>
                    <span className="text-sm font-medium">
                      {formatCurrency((getCurrentReport().income + getCurrentReport().expenses) / Math.max(getCurrentReport().transactionCount, 1))}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Momsprocent:</span>
                    <span className="text-sm font-medium">
                      {getCurrentReport().income > 0 ? 
                        ((getCurrentReport().vatOut / getCurrentReport().income) * 100).toFixed(1) + '%' : 
                        '0%'
                      }
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Help section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">💡 Tips:</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Årsrapporter visar hela årets resultat</li>
          <li>• Kvartalsrapporter delar upp året i fyra delar</li>
          <li>• Månadsrapporter ger detaljerad månadsvis översikt</li>
          <li>• Kundanalys visar vilka kunder som genererar mest intäkter</li>
          <li>• Exportera rapporter för vidare analys i Excel</li>
        </ul>
      </div>
    </main>
  );
}
