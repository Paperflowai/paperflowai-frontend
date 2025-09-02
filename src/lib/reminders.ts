// src/lib/reminders.ts
export type ReminderType = "T-7" | "T-1" | "T+3" | "T+10" | "T+30";

export interface Reminder {
  id: string;
  billId: string;
  type: ReminderType;
  scheduledFor: string; // ISO date
  sent: boolean;
  snoozedUntil?: string; // ISO date
}

const STORAGE_KEY = "pf_reminders_v1";
const SETTINGS_KEY = "pf_reminder_settings_v1";

export interface ReminderSettings {
  pushEnabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  quietHours: {
    start: string; // "18:00"
    end: string;   // "08:00"
  };
  quietWeekends: boolean;
}

const DEFAULT_SETTINGS: ReminderSettings = {
  pushEnabled: true,
  emailEnabled: true,
  smsEnabled: false,
  quietHours: {
    start: "18:00",
    end: "08:00"
  },
  quietWeekends: true
};

function safeGetReminders(): Reminder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveReminders(reminders: Reminder[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
}

export function getReminderSettings(): ReminderSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveReminderSettings(settings: ReminderSettings) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function isWorkingHours(date: Date, settings: ReminderSettings): boolean {
  const day = date.getDay(); // 0 = Sunday, 6 = Saturday
  const hour = date.getHours();
  const minute = date.getMinutes();
  const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  
  // Check weekends
  if (settings.quietWeekends && (day === 0 || day === 6)) {
    return false;
  }
  
  // Check quiet hours
  const { start, end } = settings.quietHours;
  if (start > end) {
    // Overnight quiet hours (e.g., 18:00 to 08:00)
    return timeStr >= end && timeStr < start;
  } else {
    // Same day quiet hours (e.g., 12:00 to 14:00)
    return timeStr < start || timeStr >= end;
  }
}

function getNextWorkingTime(date: Date, settings: ReminderSettings): Date {
  const next = new Date(date);
  
  while (!isWorkingHours(next, settings)) {
    next.setMinutes(next.getMinutes() + 30); // Check every 30 minutes
  }
  
  return next;
}

export function createRemindersForBill(bill: { id: string; dueDate: string }): Reminder[] {
  const dueDate = new Date(bill.dueDate);
  const reminders: Reminder[] = [];
  
  // T-7: 7 days before due date
  const t7 = new Date(dueDate);
  t7.setDate(dueDate.getDate() - 7);
  if (t7 > new Date()) {
    reminders.push({
      id: crypto.randomUUID(),
      billId: bill.id,
      type: 'T-7',
      scheduledFor: getNextWorkingTime(t7, getReminderSettings()).toISOString(),
      sent: false
    });
  }
  
  // T-1: 1 day before due date
  const t1 = new Date(dueDate);
  t1.setDate(dueDate.getDate() - 1);
  if (t1 > new Date()) {
    reminders.push({
      id: crypto.randomUUID(),
      billId: bill.id,
      type: 'T-1',
      scheduledFor: getNextWorkingTime(t1, getReminderSettings()).toISOString(),
      sent: false
    });
  }
  
  // T+3: 3 days after due date
  const t3 = new Date(dueDate);
  t3.setDate(dueDate.getDate() + 3);
  reminders.push({
    id: crypto.randomUUID(),
    billId: bill.id,
    type: 'T+3',
    scheduledFor: getNextWorkingTime(t3, getReminderSettings()).toISOString(),
    sent: false
  });
  
  // T+10: 10 days after due date
  const t10 = new Date(dueDate);
  t10.setDate(dueDate.getDate() + 10);
  reminders.push({
    id: crypto.randomUUID(),
    billId: bill.id,
    type: 'T+10',
    scheduledFor: getNextWorkingTime(t10, getReminderSettings()).toISOString(),
    sent: false
  });
  
  // T+30: 30 days after due date (kronofogd warning)
  const t30 = new Date(dueDate);
  t30.setDate(dueDate.getDate() + 30);
  reminders.push({
    id: crypto.randomUUID(),
    billId: bill.id,
    type: 'T+30',
    scheduledFor: getNextWorkingTime(t30, getReminderSettings()).toISOString(),
    sent: false
  });
  
  const existing = safeGetReminders();
  saveReminders([...existing, ...reminders]);
  
  return reminders;
}

export function snoozeReminder(reminderId: string, days: 1 | 3 | 7) {
  const reminders = safeGetReminders();
  const reminder = reminders.find(r => r.id === reminderId);
  
  if (reminder) {
    const snoozeUntil = new Date();
    snoozeUntil.setDate(snoozeUntil.getDate() + days);
    snoozeUntil.setHours(9, 0, 0, 0); // 09:00 on snooze day
    
    reminder.snoozedUntil = snoozeUntil.toISOString();
    saveReminders(reminders);
  }
}

export function markReminderSent(reminderId: string) {
  const reminders = safeGetReminders();
  const reminder = reminders.find(r => r.id === reminderId);
  
  if (reminder) {
    reminder.sent = true;
    saveReminders(reminders);
  }
}

export function cancelRemindersForBill(billId: string) {
  const reminders = safeGetReminders();
  const filtered = reminders.filter(r => r.billId !== billId);
  saveReminders(filtered);
}

export function getPendingReminders(): Reminder[] {
  const reminders = safeGetReminders();
  const now = new Date();
  
  return reminders.filter(reminder => {
    if (reminder.sent) return false;
    
    // Check if snoozed
    if (reminder.snoozedUntil) {
      const snoozeEnd = new Date(reminder.snoozedUntil);
      if (now < snoozeEnd) return false;
    }
    
    const scheduledTime = new Date(reminder.scheduledFor);
    return now >= scheduledTime;
  });
}

export function getReminderMessage(bill: { vendor: string; dueDate: string; amountSEK: number }, type: ReminderType): string {
  const daysUntilDue = Math.ceil((new Date(bill.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  
  switch (type) {
    case 'T-7':
      return `🔔 Påminnelse: Faktura från ${bill.vendor} förfaller om 7 dagar (${bill.dueDate}). Belopp: ${bill.amountSEK} kr`;
    case 'T-1':
      return `⚠️ Viktig påminnelse: Faktura från ${bill.vendor} förfaller imorgon (${bill.dueDate})! Belopp: ${bill.amountSEK} kr`;
    case 'T+3':
      return `🚨 Försenad faktura: ${bill.vendor} skulle betalats för 3 dagar sedan (${bill.dueDate}). Belopp: ${bill.amountSEK} kr`;
    case 'T+10':
      return `🚨 Allvarligt försenad: Faktura från ${bill.vendor} är 10 dagar försenad (${bill.dueDate}). Belopp: ${bill.amountSEK} kr. ⚖️ Överväg att skicka till kronofogden om betalning inte sker inom kort.`;
    case 'T+30':
      return `⚖️ KRONOFOGD-VARNING: Faktura från ${bill.vendor} är 30 dagar försenad (${bill.dueDate}). Belopp: ${bill.amountSEK} kr. Dags att överväga kronofogdemyndigheten för indrivning.`;
    default:
      return `Påminnelse: Faktura från ${bill.vendor}`;
  }
}
