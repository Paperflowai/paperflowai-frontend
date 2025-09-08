'use client';

import React, { useState, useEffect } from "react";
import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";

interface MobileSettings {
  offlineMode: boolean;
  pushNotifications: boolean;
  cameraIntegration: boolean;
  autoSync: boolean;
  syncFrequency: 'immediate' | 'hourly' | 'daily';
  lastSync?: string;
  offlineData: {
    customers: number;
    bookkeeping: number;
    settings: number;
  };
}

interface NotificationSettings {
  newInvoice: boolean;
  newExpense: boolean;
  reminder: boolean;
  backup: boolean;
  system: boolean;
}

const DEFAULT_MOBILE_SETTINGS: MobileSettings = {
  offlineMode: false,
  pushNotifications: false,
  cameraIntegration: true,
  autoSync: true,
  syncFrequency: 'immediate',
  offlineData: {
    customers: 0,
    bookkeeping: 0,
    settings: 0
  }
};

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  newInvoice: true,
  newExpense: true,
  reminder: true,
  backup: false,
  system: true
};

export default function MobilePage() {
  const [mobileSettings, setMobileSettings] = useState<MobileSettings>(DEFAULT_MOBILE_SETTINGS);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  const [isOnline, setIsOnline] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  // Load settings from localStorage
  useEffect(() => {
    try {
      const savedMobile = localStorage.getItem('mobile_settings');
      if (savedMobile) {
        setMobileSettings({ ...DEFAULT_MOBILE_SETTINGS, ...JSON.parse(savedMobile) });
      }

      const savedNotifications = localStorage.getItem('notification_settings');
      if (savedNotifications) {
        setNotificationSettings({ ...DEFAULT_NOTIFICATION_SETTINGS, ...JSON.parse(savedNotifications) });
      }
    } catch (error) {
      console.error('Error loading mobile settings:', error);
    }
  }, []);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Update offline data count
  useEffect(() => {
    const updateOfflineData = () => {
      try {
        const customers = JSON.parse(localStorage.getItem('kunder') || '[]').length;
        const bookkeeping = JSON.parse(localStorage.getItem('bookkeeping_entries') || '[]').length;
        const settings = Object.keys(JSON.parse(localStorage.getItem('company_settings') || '{}')).length;

        setMobileSettings(prev => ({
          ...prev,
          offlineData: { customers, bookkeeping, settings }
        }));
      } catch (error) {
        console.error('Error updating offline data:', error);
      }
    };

    updateOfflineData();
    const interval = setInterval(updateOfflineData, 5000);
    return () => clearInterval(interval);
  }, []);

  const saveSettings = () => {
    try {
      localStorage.setItem('mobile_settings', JSON.stringify(mobileSettings));
      localStorage.setItem('notification_settings', JSON.stringify(notificationSettings));
      setMessage('✅ Mobilinställningar sparade!');
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage('❌ Ett fel uppstod vid sparning');
      console.error('Error saving mobile settings:', error);
    }
  };

  const handleMobileSettingChange = (field: keyof MobileSettings, value: any) => {
    setMobileSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleNotificationSettingChange = (field: keyof NotificationSettings, value: boolean) => {
    setNotificationSettings(prev => ({ ...prev, [field]: value }));
  };

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setMessage('✅ Notifikationsbehörighet beviljad!');
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage('❌ Notifikationsbehörighet nekad');
        setTimeout(() => setMessage(null), 3000);
      }
    } else {
      setMessage('❌ Notifikationer stöds inte i denna webbläsare');
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const testNotification = () => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('PaperflowAI Test', {
        body: 'Detta är en testnotifikation från PaperflowAI',
        icon: '/paperflowai.png'
      });
      setMessage('✅ Testnotifikation skickad!');
      setTimeout(() => setMessage(null), 3000);
    } else {
      setMessage('❌ Notifikationer är inte aktiverade');
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const downloadOfflineData = () => {
    try {
      const offlineData = {
        timestamp: new Date().toISOString(),
        customers: JSON.parse(localStorage.getItem('kunder') || '[]'),
        bookkeeping: JSON.parse(localStorage.getItem('bookkeeping_entries') || '[]'),
        settings: JSON.parse(localStorage.getItem('company_settings') || '{}'),
        accounts: JSON.parse(localStorage.getItem('chart_of_accounts') || '[]'),
        vatSettings: JSON.parse(localStorage.getItem('vat_settings') || '{}'),
        automation: JSON.parse(localStorage.getItem('automation_settings') || '{}')
      };

      const blob = new Blob([JSON.stringify(offlineData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `paperflow_offline_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      setMessage('✅ Offlinedata nedladdad!');
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage('❌ Ett fel uppstod vid nedladdning');
      console.error('Error downloading offline data:', error);
    }
  };

  const clearOfflineData = () => {
    if (window.confirm('Är du säker på att du vill rensa all offlinedata? Detta kan inte ångras.')) {
      try {
        localStorage.clear();
        setMessage('✅ Offlinedata rensad!');
        setTimeout(() => setMessage(null), 3000);
        window.location.reload();
      } catch (error) {
        setMessage('❌ Ett fel uppstod vid rensning');
        console.error('Error clearing offline data:', error);
      }
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
            <span className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm">📱</span>
            Mobiloptimering
          </h1>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm text-gray-600">{isOnline ? 'Online' : 'Offline'}</span>
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
          {/* Mobile Settings */}
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Mobilinställningar</h3>
            
            <div className="space-y-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={mobileSettings.offlineMode}
                  onChange={(e) => handleMobileSettingChange('offlineMode', e.target.checked)}
                  className="mr-3"
                />
                <div>
                  <span className="text-sm font-medium text-gray-700">Offlineläge</span>
                  <p className="text-xs text-gray-500">Fungera utan internetanslutning</p>
                </div>
              </label>
              
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={mobileSettings.cameraIntegration}
                  onChange={(e) => handleMobileSettingChange('cameraIntegration', e.target.checked)}
                  className="mr-3"
                />
                <div>
                  <span className="text-sm font-medium text-gray-700">Kameraintegration</span>
                  <p className="text-xs text-gray-500">Använd kameran för att fotografera kvitton</p>
                </div>
              </label>
              
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={mobileSettings.autoSync}
                  onChange={(e) => handleMobileSettingChange('autoSync', e.target.checked)}
                  className="mr-3"
                />
                <div>
                  <span className="text-sm font-medium text-gray-700">Automatisk synkronisering</span>
                  <p className="text-xs text-gray-500">Synkronisera data automatiskt</p>
                </div>
              </label>
            </div>

            {mobileSettings.autoSync && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Synkroniseringsfrekvens
                </label>
                <select
                  value={mobileSettings.syncFrequency}
                  onChange={(e) => handleMobileSettingChange('syncFrequency', e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="immediate">Omedelbart</option>
                  <option value="hourly">Varje timme</option>
                  <option value="daily">Dagligen</option>
                </select>
              </div>
            )}

            <div className="border-t pt-4">
              <h4 className="font-medium text-gray-800 mb-3">Offlinedata</h4>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-lg font-bold text-blue-600">{mobileSettings.offlineData.customers}</div>
                  <div className="text-xs text-gray-600">Kunder</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-lg font-bold text-green-600">{mobileSettings.offlineData.bookkeeping}</div>
                  <div className="text-xs text-gray-600">Bokföring</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-lg font-bold text-purple-600">{mobileSettings.offlineData.settings}</div>
                  <div className="text-xs text-gray-600">Inställningar</div>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={downloadOfflineData}
                  className="flex-1 px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
                >
                  Ladda ner
                </button>
                <button
                  onClick={clearOfflineData}
                  className="flex-1 px-3 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition-colors"
                >
                  Rensa
                </button>
              </div>
            </div>
          </div>

          {/* Notifications */}
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Notifikationer</h3>
            
            <div className="space-y-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={mobileSettings.pushNotifications}
                  onChange={(e) => handleMobileSettingChange('pushNotifications', e.target.checked)}
                  className="mr-3"
                />
                <div>
                  <span className="text-sm font-medium text-gray-700">Push-notifikationer</span>
                  <p className="text-xs text-gray-500">Få notifikationer på enheten</p>
                </div>
              </label>

              {mobileSettings.pushNotifications && (
                <div className="ml-6 space-y-3">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={notificationSettings.newInvoice}
                      onChange={(e) => handleNotificationSettingChange('newInvoice', e.target.checked)}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">Nya fakturor</span>
                  </label>
                  
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={notificationSettings.newExpense}
                      onChange={(e) => handleNotificationSettingChange('newExpense', e.target.checked)}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">Nya kostnader</span>
                  </label>
                  
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={notificationSettings.reminder}
                      onChange={(e) => handleNotificationSettingChange('reminder', e.target.checked)}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">Påminnelser</span>
                  </label>
                  
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={notificationSettings.backup}
                      onChange={(e) => handleNotificationSettingChange('backup', e.target.checked)}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">Backup</span>
                  </label>
                  
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={notificationSettings.system}
                      onChange={(e) => handleNotificationSettingChange('system', e.target.checked)}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">Systemmeddelanden</span>
                  </label>
                </div>
              )}
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium text-gray-800 mb-3">Notifikationstest</h4>
              <div className="space-y-2">
                <button
                  onClick={requestNotificationPermission}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Bevilja behörighet
                </button>
                <button
                  onClick={testNotification}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Skicka testnotifikation
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-end">
          <button
            onClick={saveSettings}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Spara inställningar
          </button>
        </div>
      </div>

      {/* Help section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">💡 Tips:</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Offlineläge låter dig arbeta utan internetanslutning</li>
          <li>• Kameraintegration fungerar bäst på mobila enheter</li>
          <li>• Push-notifikationer kräver behörighet från webbläsaren</li>
          <li>• Offlinedata sparas lokalt i webbläsaren</li>
          <li>• Synkronisering sker automatiskt när du är online</li>
        </ul>
      </div>
    </main>
  );
}
