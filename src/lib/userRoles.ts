// src/lib/userRoles.ts
export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department?: string;
  manager?: string;
  isActive: boolean;
  createdAt: string;
  lastLogin?: string;
  permissions: Permission[];
}

export interface UserRole {
  id: string;
  name: string;
  description: string;
  level: number; // 1-5, higher = more permissions
  permissions: Permission[];
  canManageUsers: boolean;
  canApproveTime: boolean;
  canViewReports: boolean;
  canManageProjects: boolean;
}

export interface Permission {
  id: string;
  name: string;
  resource: string;
  action: 'create' | 'read' | 'update' | 'delete' | 'approve' | 'export';
  scope: 'own' | 'department' | 'all';
}

export interface Department {
  id: string;
  name: string;
  managerId: string;
  parentDepartment?: string;
  budget?: number;
  costCenter?: string;
}

// Default roles
export const DEFAULT_ROLES: UserRole[] = [
  {
    id: 'employee',
    name: 'Anställd',
    description: 'Grundläggande behörigheter för tidrapportering',
    level: 1,
    canManageUsers: false,
    canApproveTime: false,
    canViewReports: false,
    canManageProjects: false,
    permissions: [
      { id: 'time_create', name: 'Skapa tidposter', resource: 'time', action: 'create', scope: 'own' },
      { id: 'time_read', name: 'Läsa egna tidposter', resource: 'time', action: 'read', scope: 'own' },
      { id: 'time_update', name: 'Redigera egna tidposter', resource: 'time', action: 'update', scope: 'own' },
      { id: 'time_delete', name: 'Ta bort egna tidposter', resource: 'time', action: 'delete', scope: 'own' },
      { id: 'bills_create', name: 'Skapa fakturor', resource: 'bills', action: 'create', scope: 'own' },
      { id: 'bills_read', name: 'Läsa egna fakturor', resource: 'bills', action: 'read', scope: 'own' }
    ]
  },
  {
    id: 'team_lead',
    name: 'Teamledare',
    description: 'Kan godkänna tid för sitt team',
    level: 2,
    canManageUsers: false,
    canApproveTime: true,
    canViewReports: true,
    canManageProjects: true,
    permissions: [
      { id: 'time_create', name: 'Skapa tidposter', resource: 'time', action: 'create', scope: 'own' },
      { id: 'time_read_dept', name: 'Läsa avdelningens tidposter', resource: 'time', action: 'read', scope: 'department' },
      { id: 'time_approve_dept', name: 'Godkänna avdelningens tid', resource: 'time', action: 'approve', scope: 'department' },
      { id: 'projects_create', name: 'Skapa projekt', resource: 'projects', action: 'create', scope: 'department' },
      { id: 'projects_manage', name: 'Hantera projekt', resource: 'projects', action: 'update', scope: 'department' },
      { id: 'reports_read', name: 'Läsa rapporter', resource: 'reports', action: 'read', scope: 'department' }
    ]
  },
  {
    id: 'manager',
    name: 'Chef',
    description: 'Fullständig åtkomst till avdelningen',
    level: 3,
    canManageUsers: true,
    canApproveTime: true,
    canViewReports: true,
    canManageProjects: true,
    permissions: [
      { id: 'time_read_dept', name: 'Läsa avdelningens tidposter', resource: 'time', action: 'read', scope: 'department' },
      { id: 'time_approve_dept', name: 'Godkänna avdelningens tid', resource: 'time', action: 'approve', scope: 'department' },
      { id: 'users_manage_dept', name: 'Hantera avdelningens användare', resource: 'users', action: 'update', scope: 'department' },
      { id: 'projects_manage_dept', name: 'Hantera avdelningens projekt', resource: 'projects', action: 'update', scope: 'department' },
      { id: 'reports_export_dept', name: 'Exportera rapporter', resource: 'reports', action: 'export', scope: 'department' },
      { id: 'bills_read_dept', name: 'Läsa avdelningens fakturor', resource: 'bills', action: 'read', scope: 'department' }
    ]
  },
  {
    id: 'admin',
    name: 'Administratör',
    description: 'Fullständig systemåtkomst',
    level: 4,
    canManageUsers: true,
    canApproveTime: true,
    canViewReports: true,
    canManageProjects: true,
    permissions: [
      { id: 'all_read', name: 'Läsa allt', resource: '*', action: 'read', scope: 'all' },
      { id: 'all_write', name: 'Skriva allt', resource: '*', action: 'create', scope: 'all' },
      { id: 'all_update', name: 'Uppdatera allt', resource: '*', action: 'update', scope: 'all' },
      { id: 'all_delete', name: 'Ta bort allt', resource: '*', action: 'delete', scope: 'all' },
      { id: 'all_approve', name: 'Godkänna allt', resource: '*', action: 'approve', scope: 'all' },
      { id: 'all_export', name: 'Exportera allt', resource: '*', action: 'export', scope: 'all' }
    ]
  }
];

export const DEFAULT_DEPARTMENTS: Department[] = [
  { id: 'dev', name: 'Utveckling', managerId: 'manager1', costCenter: 'DEV001' },
  { id: 'sales', name: 'Försäljning', managerId: 'manager2', costCenter: 'SAL001' },
  { id: 'admin', name: 'Administration', managerId: 'manager3', costCenter: 'ADM001' }
];

// Storage functions
export function loadUsers(): User[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem('pf_users_v1');
    return stored ? JSON.parse(stored) : getDefaultUsers();
  } catch {
    return getDefaultUsers();
  }
}

export function saveUsers(users: User[]) {
  localStorage.setItem('pf_users_v1', JSON.stringify(users));
}

export function loadCurrentUser(): User | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem('pf_current_user_v1');
    return stored ? JSON.parse(stored) : getDefaultUsers()[0]; // Default to first user
  } catch {
    return getDefaultUsers()[0];
  }
}

export function saveCurrentUser(user: User) {
  localStorage.setItem('pf_current_user_v1', JSON.stringify(user));
}

export function loadRoles(): UserRole[] {
  if (typeof window === 'undefined') return DEFAULT_ROLES;
  try {
    const stored = localStorage.getItem('pf_roles_v1');
    return stored ? JSON.parse(stored) : DEFAULT_ROLES;
  } catch {
    return DEFAULT_ROLES;
  }
}

export function saveRoles(roles: UserRole[]) {
  localStorage.setItem('pf_roles_v1', JSON.stringify(roles));
}

export function loadDepartments(): Department[] {
  if (typeof window === 'undefined') return DEFAULT_DEPARTMENTS;
  try {
    const stored = localStorage.getItem('pf_departments_v1');
    return stored ? JSON.parse(stored) : DEFAULT_DEPARTMENTS;
  } catch {
    return DEFAULT_DEPARTMENTS;
  }
}

export function saveDepartments(departments: Department[]) {
  localStorage.setItem('pf_departments_v1', JSON.stringify(departments));
}

function getDefaultUsers(): User[] {
  return [
    {
      id: 'user1',
      name: 'Anna Andersson',
      email: 'anna@company.com',
      role: DEFAULT_ROLES[0], // employee
      department: 'dev',
      isActive: true,
      createdAt: new Date().toISOString(),
      permissions: DEFAULT_ROLES[0].permissions
    },
    {
      id: 'manager1',
      name: 'Erik Eriksson',
      email: 'erik@company.com',
      role: DEFAULT_ROLES[2], // manager
      department: 'dev',
      isActive: true,
      createdAt: new Date().toISOString(),
      permissions: DEFAULT_ROLES[2].permissions
    }
  ];
}

// Permission checking
export function hasPermission(
  user: User, 
  resource: string, 
  action: string, 
  targetUserId?: string,
  targetDepartment?: string
): boolean {
  // Admin has all permissions
  if (user.role.level >= 4) return true;

  // Check specific permissions
  for (const permission of user.permissions) {
    if (permission.resource === '*' || permission.resource === resource) {
      if (permission.action === action) {
        switch (permission.scope) {
          case 'all':
            return true;
          case 'department':
            if (!targetDepartment && !targetUserId) return true;
            if (targetDepartment && targetDepartment === user.department) return true;
            if (targetUserId) {
              const users = loadUsers();
              const targetUser = users.find(u => u.id === targetUserId);
              return targetUser?.department === user.department;
            }
            return false;
          case 'own':
            return !targetUserId || targetUserId === user.id;
        }
      }
    }
  }

  return false;
}

export function canApproveTimeFor(approver: User, employeeId: string): boolean {
  if (!approver.role.canApproveTime) return false;
  
  const users = loadUsers();
  const employee = users.find(u => u.id === employeeId);
  if (!employee) return false;

  // Can approve for same department or if admin
  return approver.role.level >= 4 || 
         (employee.department === approver.department && approver.role.level >= 2);
}

export function getAccessibleUsers(currentUser: User): User[] {
  const allUsers = loadUsers();
  
  if (currentUser.role.level >= 4) {
    return allUsers; // Admin sees all
  }
  
  if (currentUser.role.level >= 2) {
    return allUsers.filter(u => u.department === currentUser.department); // Manager sees department
  }
  
  return [currentUser]; // Employee sees only self
}

export function getAccessibleDepartments(currentUser: User): Department[] {
  const allDepartments = loadDepartments();
  
  if (currentUser.role.level >= 4) {
    return allDepartments; // Admin sees all
  }
  
  if (currentUser.role.level >= 3) {
    return allDepartments.filter(d => d.id === currentUser.department); // Manager sees own department
  }
  
  return []; // Employee doesn't manage departments
}

// User management
export function createUser(userData: Omit<User, 'id' | 'createdAt' | 'permissions'>): User {
  const roles = loadRoles();
  const role = roles.find(r => r.id === userData.role.id) || roles[0];
  
  const user: User = {
    ...userData,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    role,
    permissions: role.permissions
  };
  
  const users = loadUsers();
  users.push(user);
  saveUsers(users);
  
  return user;
}

export function updateUser(userId: string, updates: Partial<User>): User | null {
  const users = loadUsers();
  const index = users.findIndex(u => u.id === userId);
  
  if (index === -1) return null;
  
  // If role is updated, update permissions too
  if (updates.role) {
    const roles = loadRoles();
    const role = roles.find(r => r.id === updates.role!.id);
    if (role) {
      updates.permissions = role.permissions;
    }
  }
  
  users[index] = { ...users[index], ...updates };
  saveUsers(users);
  
  return users[index];
}

export function deactivateUser(userId: string): boolean {
  return updateUser(userId, { isActive: false }) !== null;
}

// Session management
export function login(email: string, password: string): User | null {
  // In a real app, this would validate credentials
  const users = loadUsers();
  const user = users.find(u => u.email === email && u.isActive);
  
  if (user) {
    user.lastLogin = new Date().toISOString();
    saveCurrentUser(user);
    updateUser(user.id, { lastLogin: user.lastLogin });
  }
  
  return user || null;
}

export function logout() {
  localStorage.removeItem('pf_current_user_v1');
}

export function switchRole(newRoleId: string): boolean {
  const currentUser = loadCurrentUser();
  if (!currentUser) return false;
  
  const roles = loadRoles();
  const newRole = roles.find(r => r.id === newRoleId);
  if (!newRole) return false;
  
  // Only allow switching to lower or equal level roles
  if (newRole.level > currentUser.role.level) return false;
  
  currentUser.role = newRole;
  currentUser.permissions = newRole.permissions;
  saveCurrentUser(currentUser);
  
  return true;
}

// Audit logging
export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  timestamp: string;
  details?: any;
}

export function logAction(
  userId: string, 
  action: string, 
  resource: string, 
  resourceId?: string, 
  details?: any
) {
  const log: AuditLog = {
    id: crypto.randomUUID(),
    userId,
    action,
    resource,
    resourceId,
    timestamp: new Date().toISOString(),
    details
  };
  
  const logs = getAuditLogs();
  logs.unshift(log); // Add to beginning
  
  // Keep only last 1000 logs
  if (logs.length > 1000) {
    logs.splice(1000);
  }
  
  localStorage.setItem('pf_audit_logs_v1', JSON.stringify(logs));
}

export function getAuditLogs(): AuditLog[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem('pf_audit_logs_v1') || '[]');
  } catch {
    return [];
  }
}
