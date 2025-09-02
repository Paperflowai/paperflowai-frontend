// src/components/UserManagement.tsx
"use client";

import { useState, useEffect } from 'react';
import {
  User,
  UserRole,
  Department,
  loadUsers,
  saveUsers,
  loadRoles,
  loadDepartments,
  loadCurrentUser,
  createUser,
  updateUser,
  deactivateUser,
  hasPermission,
  getAccessibleUsers,
  getAccessibleDepartments,
  logAction
} from '@/lib/userRoles';

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');

  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    roleId: '',
    department: ''
  });

  useEffect(() => {
    const current = loadCurrentUser();
    setCurrentUser(current);
    setUsers(current ? getAccessibleUsers(current) : []);
    setRoles(loadRoles());
    setDepartments(current ? getAccessibleDepartments(current) : []);
  }, []);

  const canManageUsers = currentUser?.role.canManageUsers || false;
  const filteredUsers = selectedDepartment === 'all' 
    ? users 
    : users.filter(u => u.department === selectedDepartment);

  function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!canManageUsers || !newUser.name || !newUser.email || !newUser.roleId) return;

    const role = roles.find(r => r.id === newUser.roleId);
    if (!role) return;

    try {
      const user = createUser({
        name: newUser.name,
        email: newUser.email,
        role,
        department: newUser.department || undefined,
        isActive: true
      });

      setUsers([...users, user]);
      setNewUser({ name: '', email: '', roleId: '', department: '' });
      setShowAddUser(false);
      
      if (currentUser) {
        logAction(currentUser.id, 'create', 'user', user.id, { name: user.name, email: user.email });
      }
    } catch (error) {
      console.error('Failed to create user:', error);
    }
  }

  function handleUpdateUser(userId: string, updates: Partial<User>) {
    if (!canManageUsers) return;

    const updated = updateUser(userId, updates);
    if (updated) {
      setUsers(users.map(u => u.id === userId ? updated : u));
      setEditingUser(null);
      
      if (currentUser) {
        logAction(currentUser.id, 'update', 'user', userId, updates);
      }
    }
  }

  function handleDeactivateUser(userId: string) {
    if (!canManageUsers) return;
    if (!confirm('Är du säker på att du vill inaktivera denna användare?')) return;

    if (deactivateUser(userId)) {
      setUsers(users.map(u => u.id === userId ? { ...u, isActive: false } : u));
      
      if (currentUser) {
        logAction(currentUser.id, 'deactivate', 'user', userId);
      }
    }
  }

  if (!currentUser) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 18, marginBottom: 16 }}>Ingen användare inloggad</div>
        <button
          onClick={() => {
            // Simulate login as first user for demo
            const defaultUsers = loadUsers();
            if (defaultUsers.length > 0) {
              setCurrentUser(defaultUsers[0]);
            }
          }}
          style={{
            padding: '12px 24px',
            borderRadius: 8,
            border: '1px solid #0ea5e9',
            background: '#0ea5e9',
            color: 'white',
            fontSize: 16
          }}
        >
          Demo-inloggning
        </button>
      </div>
    );
  }

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, background: '#fff', padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: 18, fontWeight: 600 }}>Användarhantering</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ fontSize: 12, color: '#6b7280' }}>
            Inloggad som: <strong>{currentUser.name}</strong> ({currentUser.role.name})
          </div>
          {canManageUsers && (
            <button
              onClick={() => setShowAddUser(true)}
              style={{
                padding: '8px 16px',
                borderRadius: 6,
                border: '1px solid #10b981',
                background: '#10b981',
                color: 'white',
                fontSize: 14
              }}
            >
              + Ny användare
            </button>
          )}
        </div>
      </div>

      {/* Department filter */}
      {departments.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <select
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
            style={{ padding: 8, borderRadius: 6, border: '1px solid #ddd' }}
          >
            <option value="all">Alla avdelningar</option>
            {departments.map(dept => (
              <option key={dept.id} value={dept.id}>{dept.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Add user form */}
      {showAddUser && canManageUsers && (
        <form onSubmit={handleCreateUser} style={{ 
          border: '1px solid #e5e7eb', 
          borderRadius: 8, 
          padding: 16, 
          marginBottom: 16, 
          background: '#f8fafc' 
        }}>
          <h4 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Lägg till ny användare</h4>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <input
              placeholder="Namn"
              value={newUser.name}
              onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
              style={{ padding: 8, borderRadius: 6, border: '1px solid #ddd' }}
              required
            />
            <input
              placeholder="E-post"
              type="email"
              value={newUser.email}
              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              style={{ padding: 8, borderRadius: 6, border: '1px solid #ddd' }}
              required
            />
            <select
              value={newUser.roleId}
              onChange={(e) => setNewUser({ ...newUser, roleId: e.target.value })}
              style={{ padding: 8, borderRadius: 6, border: '1px solid #ddd' }}
              required
            >
              <option value="">Välj roll</option>
              {roles.filter(r => r.level <= currentUser.role.level).map(role => (
                <option key={role.id} value={role.id}>{role.name}</option>
              ))}
            </select>
            <select
              value={newUser.department}
              onChange={(e) => setNewUser({ ...newUser, department: e.target.value })}
              style={{ padding: 8, borderRadius: 6, border: '1px solid #ddd' }}
            >
              <option value="">Välj avdelning</option>
              {departments.map(dept => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              type="submit"
              style={{
                padding: '8px 16px',
                borderRadius: 6,
                border: '1px solid #10b981',
                background: '#10b981',
                color: 'white'
              }}
            >
              Skapa användare
            </button>
            <button
              type="button"
              onClick={() => setShowAddUser(false)}
              style={{
                padding: '8px 16px',
                borderRadius: 6,
                border: '1px solid #e5e7eb',
                background: 'white'
              }}
            >
              Avbryt
            </button>
          </div>
        </form>
      )}

      {/* Users list */}
      <div style={{ display: 'grid', gap: 8 }}>
        {filteredUsers.length === 0 ? (
          <div style={{ color: '#6b7280', textAlign: 'center', padding: 20 }}>
            Inga användare att visa
          </div>
        ) : (
          filteredUsers.map(user => (
            <div key={user.id} style={{ 
              border: '1px solid #e5e7eb', 
              borderRadius: 8, 
              padding: 12,
              background: user.isActive ? 'white' : '#f8fafc',
              opacity: user.isActive ? 1 : 0.7
            }}>
              {editingUser?.id === user.id ? (
                // Edit form
                <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 1fr 1fr auto' }}>
                  <input
                    value={editingUser.name}
                    onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                    style={{ padding: 6, borderRadius: 4, border: '1px solid #ddd' }}
                  />
                  <select
                    value={editingUser.role.id}
                    onChange={(e) => {
                      const role = roles.find(r => r.id === e.target.value);
                      if (role) setEditingUser({ ...editingUser, role });
                    }}
                    style={{ padding: 6, borderRadius: 4, border: '1px solid #ddd' }}
                  >
                    {roles.filter(r => r.level <= currentUser.role.level).map(role => (
                      <option key={role.id} value={role.id}>{role.name}</option>
                    ))}
                  </select>
                  <select
                    value={editingUser.department || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, department: e.target.value || undefined })}
                    style={{ padding: 6, borderRadius: 4, border: '1px solid #ddd' }}
                  >
                    <option value="">Ingen avdelning</option>
                    {departments.map(dept => (
                      <option key={dept.id} value={dept.id}>{dept.name}</option>
                    ))}
                  </select>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      onClick={() => handleUpdateUser(user.id, editingUser)}
                      style={{
                        padding: '4px 8px',
                        borderRadius: 4,
                        border: '1px solid #10b981',
                        background: '#10b981',
                        color: 'white',
                        fontSize: 12
                      }}
                    >
                      Spara
                    </button>
                    <button
                      onClick={() => setEditingUser(null)}
                      style={{
                        padding: '4px 8px',
                        borderRadius: 4,
                        border: '1px solid #e5e7eb',
                        background: 'white',
                        fontSize: 12
                      }}
                    >
                      Avbryt
                    </button>
                  </div>
                </div>
              ) : (
                // Display mode
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                      {user.name}
                      {!user.isActive && <span style={{ color: '#ef4444', marginLeft: 8 }}>(Inaktiv)</span>}
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>
                      {user.email} • {user.role.name}
                      {user.department && ` • ${departments.find(d => d.id === user.department)?.name || user.department}`}
                    </div>
                    {user.lastLogin && (
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>
                        Senast inloggad: {new Date(user.lastLogin).toLocaleString('sv-SE')}
                      </div>
                    )}
                  </div>
                  
                  {canManageUsers && user.id !== currentUser.id && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => setEditingUser(user)}
                        style={{
                          padding: '6px 10px',
                          borderRadius: 4,
                          border: '1px solid #0ea5e9',
                          background: '#0ea5e9',
                          color: 'white',
                          fontSize: 12
                        }}
                      >
                        Redigera
                      </button>
                      {user.isActive && (
                        <button
                          onClick={() => handleDeactivateUser(user.id)}
                          style={{
                            padding: '6px 10px',
                            borderRadius: 4,
                            border: '1px solid #ef4444',
                            background: '#ef4444',
                            color: 'white',
                            fontSize: 12
                          }}
                        >
                          Inaktivera
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Role legend */}
      <div style={{ marginTop: 16, padding: 12, background: '#f8fafc', borderRadius: 8 }}>
        <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Roller och behörigheter</h4>
        <div style={{ display: 'grid', gap: 6 }}>
          {roles.map(role => (
            <div key={role.id} style={{ fontSize: 12 }}>
              <span style={{ fontWeight: 600 }}>{role.name}:</span> {role.description}
              <div style={{ color: '#6b7280', marginLeft: 8 }}>
                {role.canManageUsers && '👥 Hantera användare'} 
                {role.canApproveTime && ' ✅ Godkänna tid'} 
                {role.canViewReports && ' 📊 Visa rapporter'} 
                {role.canManageProjects && ' 📋 Hantera projekt'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
