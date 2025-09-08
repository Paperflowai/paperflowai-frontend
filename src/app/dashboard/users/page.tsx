'use client';

import React, { useState, useEffect } from "react";
import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";

interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user' | 'viewer';
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
  permissions: {
    canViewBookkeeping: boolean;
    canEditBookkeeping: boolean;
    canViewReports: boolean;
    canManageUsers: boolean;
    canManageSettings: boolean;
  };
}

interface BackupSettings {
  autoBackup: boolean;
  backupFrequency: 'daily' | 'weekly' | 'monthly';
  lastBackup?: string;
  backupLocation: 'local' | 'cloud';
}

const DEFAULT_USERS: User[] = [
  {
    id: '1',
    email: 'admin@paperflowai.se',
    name: 'Administratör',
    role: 'admin',
    isActive: true,
    createdAt: new Date().toISOString(),
    permissions: {
      canViewBookkeeping: true,
      canEditBookkeeping: true,
      canViewReports: true,
      canManageUsers: true,
      canManageSettings: true
    }
  }
];

const DEFAULT_BACKUP_SETTINGS: BackupSettings = {
  autoBackup: false,
  backupFrequency: 'weekly',
  backupLocation: 'local'
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>(DEFAULT_USERS);
  const [backupSettings, setBackupSettings] = useState<BackupSettings>(DEFAULT_BACKUP_SETTINGS);
  const [isEditing, setIsEditing] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newUser, setNewUser] = useState<Partial<User>>({
    email: '',
    name: '',
    role: 'user',
    isActive: true,
    permissions: {
      canViewBookkeeping: true,
      canEditBookkeeping: false,
      canViewReports: false,
      canManageUsers: false,
      canManageSettings: false
    }
  });
  const [message, setMessage] = useState<string | null>(null);

  // Load data from localStorage
  useEffect(() => {
    try {
      const savedUsers = localStorage.getItem('users');
      if (savedUsers) {
        setUsers(JSON.parse(savedUsers));
      }

      const savedBackup = localStorage.getItem('backup_settings');
      if (savedBackup) {
        setBackupSettings({ ...DEFAULT_BACKUP_SETTINGS, ...JSON.parse(savedBackup) });
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  }, []);

  const saveData = () => {
    try {
      localStorage.setItem('users', JSON.stringify(users));
      localStorage.setItem('backup_settings', JSON.stringify(backupSettings));
      setMessage('✅ Användardata sparad!');
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage('❌ Ett fel uppstod vid sparning');
      console.error('Error saving user data:', error);
    }
  };

  const addUser = () => {
    if (!newUser.email || !newUser.name) {
      setMessage('E-post och namn är obligatoriskt');
      return;
    }

    // Check if email already exists
    if (users.some(user => user.email === newUser.email)) {
      setMessage('E-postadress finns redan');
      return;
    }

    const user: User = {
      id: Date.now().toString(),
      email: newUser.email!,
      name: newUser.name!,
      role: newUser.role!,
      isActive: newUser.isActive !== false,
      createdAt: new Date().toISOString(),
      permissions: newUser.permissions!
    };

    setUsers(prev => [...prev, user]);
    setNewUser({
      email: '',
      name: '',
      role: 'user',
      isActive: true,
      permissions: {
        canViewBookkeeping: true,
        canEditBookkeeping: false,
        canViewReports: false,
        canManageUsers: false,
        canManageSettings: false
      }
    });
    setMessage('✅ Användare tillagd!');
    setTimeout(() => setMessage(null), 3000);
  };

  const editUser = (user: User) => {
    setEditingUser(user);
    setIsEditing(true);
  };

  const updateUser = () => {
    if (!editingUser) return;

    setUsers(prev => prev.map(u => 
      u.id === editingUser.id ? editingUser : u
    ));

    setIsEditing(false);
    setEditingUser(null);
    setMessage('✅ Användare uppdaterad!');
    setTimeout(() => setMessage(null), 3000);
  };

  const deleteUser = (id: string) => {
    if (window.confirm('Är du säker på att du vill ta bort denna användare?')) {
      setUsers(prev => prev.filter(u => u.id !== id));
      setMessage('✅ Användare borttagen!');
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const toggleUserActive = (id: string) => {
    setUsers(prev => prev.map(u => 
      u.id === id ? { ...u, isActive: !u.isActive } : u
    ));
  };

  const createBackup = () => {
    try {
      // Create backup of all data
      const backup = {
        timestamp: new Date().toISOString(),
        users: users,
        bookkeeping: JSON.parse(localStorage.getItem('bookkeeping_entries') || '[]'),
        settings: JSON.parse(localStorage.getItem('company_settings') || '{}'),
        accounts: JSON.parse(localStorage.getItem('chart_of_accounts') || '[]'),
        vatSettings: JSON.parse(localStorage.getItem('vat_settings') || '{}'),
        automation: JSON.parse(localStorage.getItem('automation_settings') || '{}')
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `paperflow_backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      setBackupSettings(prev => ({ ...prev, lastBackup: new Date().toISOString() }));
      setMessage('✅ Backup skapad och nedladdad!');
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage('❌ Ett fel uppstod vid backup');
      console.error('Error creating backup:', error);
    }
  };

  const restoreBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const backup = JSON.parse(e.target?.result as string);
        
        if (backup.users) setUsers(backup.users);
        if (backup.bookkeeping) localStorage.setItem('bookkeeping_entries', JSON.stringify(backup.bookkeeping));
        if (backup.settings) localStorage.setItem('company_settings', JSON.stringify(backup.settings));
        if (backup.accounts) localStorage.setItem('chart_of_accounts', JSON.stringify(backup.accounts));
        if (backup.vatSettings) localStorage.setItem('vat_settings', JSON.stringify(backup.vatSettings));
        if (backup.automation) localStorage.setItem('automation_settings', JSON.stringify(backup.automation));

        setMessage('✅ Backup återställd!');
        setTimeout(() => setMessage(null), 3000);
      } catch (error) {
        setMessage('❌ Ogiltigt backup-format');
        console.error('Error restoring backup:', error);
      }
    };
    reader.readAsText(file);
  };

  const handleBackupSettingChange = (field: keyof BackupSettings, value: any) => {
    setBackupSettings(prev => ({ ...prev, [field]: value }));
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800';
      case 'user': return 'bg-blue-100 text-blue-800';
      case 'viewer': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Administratör';
      case 'user': return 'Användare';
      case 'viewer': return 'Läsare';
      default: return role;
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
            <span className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm">👥</span>
            Användarhantering
          </h1>
          <button
            onClick={saveData}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
          >
            Spara ändringar
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
          {/* User Management */}
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Användare</h3>
            
            {/* Add new user */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium mb-3">Lägg till ny användare</h4>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      E-post *
                    </label>
                    <input
                      type="email"
                      value={newUser.email || ''}
                      onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="user@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Namn *
                    </label>
                    <input
                      type="text"
                      value={newUser.name || ''}
                      onChange={(e) => setNewUser(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Förnamn Efternamn"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Roll
                  </label>
                  <select
                    value={newUser.role || 'user'}
                    onChange={(e) => setNewUser(prev => ({ ...prev, role: e.target.value as any }))}
                    className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="viewer">Läsare</option>
                    <option value="user">Användare</option>
                    <option value="admin">Administratör</option>
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={newUser.isActive !== false}
                      onChange={(e) => setNewUser(prev => ({ ...prev, isActive: e.target.checked }))}
                      className="mr-1"
                    />
                    <span className="text-xs text-gray-700">Aktiv</span>
                  </label>
                  <button
                    onClick={addUser}
                    className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 transition-colors"
                  >
                    Lägg till
                  </button>
                </div>
              </div>
            </div>

            {/* Users list */}
            <div className="space-y-2">
              {users.map(user => (
                <div key={user.id} className={`border rounded-lg p-3 ${!user.isActive ? 'opacity-50' : ''}`}>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm">{user.name}</span>
                        <span className="text-xs text-gray-500">{user.email}</span>
                        <span className={`px-2 py-0.5 rounded text-xs ${getRoleColor(user.role)}`}>
                          {getRoleLabel(user.role)}
                        </span>
                        {!user.isActive && (
                          <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
                            Inaktiv
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        Skapad: {new Date(user.createdAt).toLocaleDateString('sv-SE')}
                        {user.lastLogin && (
                          <span className="ml-2">Senast inloggning: {new Date(user.lastLogin).toLocaleDateString('sv-SE')}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 ml-3">
                      <button
                        onClick={() => toggleUserActive(user.id)}
                        className={`px-2 py-1 rounded text-xs ${
                          user.isActive 
                            ? 'bg-yellow-600 text-white hover:bg-yellow-700' 
                            : 'bg-green-600 text-white hover:bg-green-700'
                        } transition-colors`}
                      >
                        {user.isActive ? 'Inaktivera' : 'Aktivera'}
                      </button>
                      <button
                        onClick={() => editUser(user)}
                        className="px-2 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700 transition-colors"
                      >
                        Redigera
                      </button>
                      <button
                        onClick={() => deleteUser(user.id)}
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

          {/* Backup & Restore */}
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Backup & Återställning</h3>
            
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium mb-3">Backup-inställningar</h4>
              <div className="space-y-3">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={backupSettings.autoBackup}
                    onChange={(e) => handleBackupSettingChange('autoBackup', e.target.checked)}
                    className="mr-3"
                  />
                  <span className="text-sm text-gray-700">Automatisk backup</span>
                </label>
                
                {backupSettings.autoBackup && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Backup-frekvens
                    </label>
                    <select
                      value={backupSettings.backupFrequency}
                      onChange={(e) => handleBackupSettingChange('backupFrequency', e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="daily">Dagligen</option>
                      <option value="weekly">Veckovis</option>
                      <option value="monthly">Månadsvis</option>
                    </select>
                  </div>
                )}
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Backup-plats
                  </label>
                  <select
                    value={backupSettings.backupLocation}
                    onChange={(e) => handleBackupSettingChange('backupLocation', e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="local">Lokal nedladdning</option>
                    <option value="cloud">Molnlagring (kommer snart)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={createBackup}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Skapa backup nu
              </button>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Återställ från backup
                </label>
                <input
                  type="file"
                  accept=".json"
                  onChange={restoreBackup}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              {backupSettings.lastBackup && (
                <div className="text-sm text-gray-600">
                  Senaste backup: {new Date(backupSettings.lastBackup).toLocaleString('sv-SE')}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit modal */}
      {isEditing && editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Redigera användare</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  E-post
                </label>
                <input
                  type="email"
                  value={editingUser.email}
                  onChange={(e) => setEditingUser(prev => prev ? { ...prev, email: e.target.value } : null)}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Namn
                </label>
                <input
                  type="text"
                  value={editingUser.name}
                  onChange={(e) => setEditingUser(prev => prev ? { ...prev, name: e.target.value } : null)}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Roll
                </label>
                <select
                  value={editingUser.role}
                  onChange={(e) => setEditingUser(prev => prev ? { ...prev, role: e.target.value as any } : null)}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="viewer">Läsare</option>
                  <option value="user">Användare</option>
                  <option value="admin">Administratör</option>
                </select>
              </div>
              <div className="flex items-center">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={editingUser.isActive}
                    onChange={(e) => setEditingUser(prev => prev ? { ...prev, isActive: e.target.checked } : null)}
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
                onClick={updateUser}
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
          <li>• Administratörer har full åtkomst till alla funktioner</li>
          <li>• Användare kan redigera bokföring men inte hantera inställningar</li>
          <li>• Läsare kan endast visa data utan att redigera</li>
          <li>• Skapa regelbundna backups för att skydda din data</li>
          <li>• Inaktiva användare kan inte logga in</li>
        </ul>
      </div>
    </main>
  );
}
