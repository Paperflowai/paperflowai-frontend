// src/lib/timeAnalytics.ts
export interface TimeEntry {
  id: string;
  date: string;
  minutes: number;
  customer?: string;
  project?: string;
  note?: string;
  createdAt: string;
  billedAt?: string;
}

export interface ProjectBudget {
  id: string;
  name: string;
  customer: string;
  budgetHours: number;
  hourlyRate: number;
  startDate: string;
  endDate: string;
  status: 'active' | 'completed' | 'on_hold';
  createdAt: string;
}

export interface ActivityCode {
  id: string;
  name: string;
  description: string;
  color: string;
  billable: boolean;
}

export interface TimeStats {
  totalMinutes: number;
  billableMinutes: number;
  nonBillableMinutes: number;
  customerBreakdown: { customer: string; minutes: number; percentage: number }[];
  projectBreakdown: { project: string; minutes: number; percentage: number }[];
  dailyAverage: number;
  productivity: number; // 0-100
}

export interface WeeklyTrend {
  weekKey: string;
  totalMinutes: number;
  billableMinutes: number;
  productivity: number;
}

export function calculateTimeStats(entries: TimeEntry[], startDate?: Date, endDate?: Date): TimeStats {
  let filteredEntries = entries;
  
  if (startDate || endDate) {
    filteredEntries = entries.filter(entry => {
      const entryDate = new Date(entry.date);
      if (startDate && entryDate < startDate) return false;
      if (endDate && entryDate > endDate) return false;
      return true;
    });
  }

  const totalMinutes = filteredEntries.reduce((sum, e) => sum + e.minutes, 0);
  const billableMinutes = filteredEntries.filter(e => e.billedAt).reduce((sum, e) => sum + e.minutes, 0);
  const nonBillableMinutes = totalMinutes - billableMinutes;

  // Customer breakdown
  const customerMap = new Map<string, number>();
  filteredEntries.forEach(e => {
    const customer = e.customer || 'Okänd kund';
    customerMap.set(customer, (customerMap.get(customer) || 0) + e.minutes);
  });
  
  const customerBreakdown = Array.from(customerMap.entries())
    .map(([customer, minutes]) => ({
      customer,
      minutes,
      percentage: totalMinutes > 0 ? Math.round((minutes / totalMinutes) * 100) : 0
    }))
    .sort((a, b) => b.minutes - a.minutes);

  // Project breakdown
  const projectMap = new Map<string, number>();
  filteredEntries.forEach(e => {
    const project = e.project || 'Inget projekt';
    projectMap.set(project, (projectMap.get(project) || 0) + e.minutes);
  });
  
  const projectBreakdown = Array.from(projectMap.entries())
    .map(([project, minutes]) => ({
      project,
      minutes,
      percentage: totalMinutes > 0 ? Math.round((minutes / totalMinutes) * 100) : 0
    }))
    .sort((a, b) => b.minutes - a.minutes);

  // Daily average
  const uniqueDates = new Set(filteredEntries.map(e => e.date));
  const dailyAverage = uniqueDates.size > 0 ? totalMinutes / uniqueDates.size : 0;

  // Productivity score (based on billable ratio and consistency)
  const billableRatio = totalMinutes > 0 ? billableMinutes / totalMinutes : 0;
  const targetHoursPerDay = 8 * 60; // 8 hours in minutes
  const consistencyScore = Math.min(1, dailyAverage / targetHoursPerDay);
  const productivity = Math.round((billableRatio * 0.7 + consistencyScore * 0.3) * 100);

  return {
    totalMinutes,
    billableMinutes,
    nonBillableMinutes,
    customerBreakdown,
    projectBreakdown,
    dailyAverage,
    productivity
  };
}

export function getWeeklyTrends(entries: TimeEntry[], weeks: number = 12): WeeklyTrend[] {
  const weekMap = new Map<string, { total: number; billable: number }>();
  
  entries.forEach(entry => {
    const date = new Date(entry.date);
    const weekKey = getISOWeekKey(date);
    
    if (!weekMap.has(weekKey)) {
      weekMap.set(weekKey, { total: 0, billable: 0 });
    }
    
    const week = weekMap.get(weekKey)!;
    week.total += entry.minutes;
    if (entry.billedAt) {
      week.billable += entry.minutes;
    }
  });

  return Array.from(weekMap.entries())
    .map(([weekKey, data]) => ({
      weekKey,
      totalMinutes: data.total,
      billableMinutes: data.billable,
      productivity: data.total > 0 ? Math.round((data.billable / data.total) * 100) : 0
    }))
    .sort((a, b) => b.weekKey.localeCompare(a.weekKey))
    .slice(0, weeks);
}

export function getISOWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}:${String(mins).padStart(2, '0')}`;
}

export function exportTimeReport(entries: TimeEntry[], startDate: Date, endDate: Date): string {
  const stats = calculateTimeStats(entries, startDate, endDate);
  
  const report = `
TIDSRAPPORT
${startDate.toLocaleDateString('sv-SE')} - ${endDate.toLocaleDateString('sv-SE')}

SAMMANFATTNING
Total tid: ${formatMinutes(stats.totalMinutes)}
Fakturerbar tid: ${formatMinutes(stats.billableMinutes)}
Icke-fakturerbar tid: ${formatMinutes(stats.nonBillableMinutes)}
Produktivitet: ${stats.productivity}%
Dagligt snitt: ${formatMinutes(stats.dailyAverage)}

FÖRDELNING PER KUND
${stats.customerBreakdown.map(c => 
  `${c.customer}: ${formatMinutes(c.minutes)} (${c.percentage}%)`
).join('\n')}

FÖRDELNING PER PROJEKT
${stats.projectBreakdown.map(p => 
  `${p.project}: ${formatMinutes(p.minutes)} (${p.percentage}%)`
).join('\n')}

DETALJERAD LISTA
${entries
  .filter(e => {
    const date = new Date(e.date);
    return date >= startDate && date <= endDate;
  })
  .sort((a, b) => b.date.localeCompare(a.date))
  .map(e => 
    `${e.date} | ${e.customer || '-'} | ${e.project || '-'} | ${formatMinutes(e.minutes)} | ${e.billedAt ? 'Fakturerad' : 'Ej fakturerad'} | ${e.note || ''}`
  ).join('\n')}
  `.trim();
  
  return report;
}

// Project budget functions
export function loadProjectBudgets(): ProjectBudget[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem('pf_project_budgets_v1') || '[]');
  } catch {
    return [];
  }
}

export function saveProjectBudgets(budgets: ProjectBudget[]) {
  localStorage.setItem('pf_project_budgets_v1', JSON.stringify(budgets));
}

export function getProjectProgress(project: ProjectBudget, entries: TimeEntry[]): {
  usedHours: number;
  remainingHours: number;
  percentage: number;
  isOverBudget: boolean;
  estimatedCompletion: Date | null;
} {
  const projectEntries = entries.filter(e => 
    e.project === project.name && 
    e.customer === project.customer &&
    e.date >= project.startDate &&
    e.date <= project.endDate
  );
  
  const usedMinutes = projectEntries.reduce((sum, e) => sum + e.minutes, 0);
  const usedHours = usedMinutes / 60;
  const remainingHours = Math.max(0, project.budgetHours - usedHours);
  const percentage = project.budgetHours > 0 ? Math.round((usedHours / project.budgetHours) * 100) : 0;
  const isOverBudget = usedHours > project.budgetHours;
  
  // Estimate completion based on recent pace
  let estimatedCompletion: Date | null = null;
  if (remainingHours > 0 && projectEntries.length > 0) {
    const recentEntries = projectEntries.slice(-10); // Last 10 entries
    if (recentEntries.length > 1) {
      const avgDailyHours = recentEntries.reduce((sum, e) => sum + e.minutes, 0) / 60 / recentEntries.length;
      if (avgDailyHours > 0) {
        const daysToComplete = remainingHours / avgDailyHours;
        estimatedCompletion = new Date();
        estimatedCompletion.setDate(estimatedCompletion.getDate() + Math.ceil(daysToComplete));
      }
    }
  }
  
  return {
    usedHours,
    remainingHours,
    percentage,
    isOverBudget,
    estimatedCompletion
  };
}

// Activity codes
export function loadActivityCodes(): ActivityCode[] {
  if (typeof window === 'undefined') return getDefaultActivityCodes();
  try {
    const stored = JSON.parse(localStorage.getItem('pf_activity_codes_v1') || '[]');
    return stored.length > 0 ? stored : getDefaultActivityCodes();
  } catch {
    return getDefaultActivityCodes();
  }
}

export function saveActivityCodes(codes: ActivityCode[]) {
  localStorage.setItem('pf_activity_codes_v1', JSON.stringify(codes));
}

function getDefaultActivityCodes(): ActivityCode[] {
  return [
    { id: '1', name: 'Utveckling', description: 'Programmering och kodning', color: '#3b82f6', billable: true },
    { id: '2', name: 'Möten', description: 'Kundmöten och interna möten', color: '#10b981', billable: true },
    { id: '3', name: 'Planering', description: 'Projektplanering och analys', color: '#f59e0b', billable: true },
    { id: '4', name: 'Testing', description: 'Testning och kvalitetssäkring', color: '#ef4444', billable: true },
    { id: '5', name: 'Dokumentation', description: 'Skriva dokumentation', color: '#8b5cf6', billable: true },
    { id: '6', name: 'Administration', description: 'Administrativt arbete', color: '#6b7280', billable: false },
    { id: '7', name: 'Utbildning', description: 'Kompetensutveckling', color: '#ec4899', billable: false }
  ];
}
