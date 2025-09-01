// src/lib/advancedTimer.ts
export interface AdvancedTimer {
  id: string;
  customer: string;
  project: string;
  note: string;
  startedAt: number;
  pausedAt?: number;
  totalPausedTime: number;
  isActive: boolean;
  lastActivity?: number;
  autoStoppedAt?: number;
}

export interface TimerSettings {
  autoStopAfterMinutes: number;
  autoPauseAfterMinutes: number;
  enableActivityDetection: boolean;
  enableMultipleTimers: boolean;
  reminderIntervalMinutes: number;
}

const DEFAULT_SETTINGS: TimerSettings = {
  autoStopAfterMinutes: 480, // 8 hours
  autoPauseAfterMinutes: 15,
  enableActivityDetection: true,
  enableMultipleTimers: false,
  reminderIntervalMinutes: 60
};

export function loadTimerSettings(): TimerSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const stored = localStorage.getItem('pf_timer_settings_v1');
    return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveTimerSettings(settings: TimerSettings) {
  localStorage.setItem('pf_timer_settings_v1', JSON.stringify(settings));
}

export function loadAdvancedTimers(): AdvancedTimer[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem('pf_advanced_timers_v1') || '[]');
  } catch {
    return [];
  }
}

export function saveAdvancedTimers(timers: AdvancedTimer[]) {
  localStorage.setItem('pf_advanced_timers_v1', JSON.stringify(timers));
}

export function createAdvancedTimer(customer: string, project: string, note: string): AdvancedTimer {
  return {
    id: crypto.randomUUID(),
    customer,
    project,
    note,
    startedAt: Date.now(),
    totalPausedTime: 0,
    isActive: true,
    lastActivity: Date.now()
  };
}

export function pauseTimer(timer: AdvancedTimer): AdvancedTimer {
  if (!timer.isActive || timer.pausedAt) return timer;
  
  return {
    ...timer,
    pausedAt: Date.now(),
    isActive: false
  };
}

export function resumeTimer(timer: AdvancedTimer): AdvancedTimer {
  if (timer.isActive || !timer.pausedAt) return timer;
  
  const pauseDuration = Date.now() - timer.pausedAt;
  
  return {
    ...timer,
    pausedAt: undefined,
    totalPausedTime: timer.totalPausedTime + pauseDuration,
    isActive: true,
    lastActivity: Date.now()
  };
}

export function stopTimer(timer: AdvancedTimer): { timer: AdvancedTimer; totalMinutes: number } {
  const now = Date.now();
  let totalTime = now - timer.startedAt - timer.totalPausedTime;
  
  // If currently paused, don't count current pause time
  if (timer.pausedAt) {
    totalTime -= (now - timer.pausedAt);
  }
  
  const totalMinutes = Math.max(1, Math.round(totalTime / 60000));
  
  const stoppedTimer = {
    ...timer,
    isActive: false,
    pausedAt: undefined,
    autoStoppedAt: now
  };
  
  return { timer: stoppedTimer, totalMinutes };
}

export function getTimerElapsed(timer: AdvancedTimer): number {
  const now = Date.now();
  let elapsed = now - timer.startedAt - timer.totalPausedTime;
  
  // If currently paused, don't count current pause time
  if (timer.pausedAt) {
    elapsed -= (now - timer.pausedAt);
  }
  
  return Math.max(0, Math.round(elapsed / 60000));
}

export function checkTimerActivity(timer: AdvancedTimer, settings: TimerSettings): {
  shouldAutoPause: boolean;
  shouldAutoStop: boolean;
  shouldRemind: boolean;
} {
  if (!timer.isActive) {
    return { shouldAutoPause: false, shouldAutoStop: false, shouldRemind: false };
  }
  
  const now = Date.now();
  const elapsedMinutes = getTimerElapsed(timer);
  const inactiveMinutes = timer.lastActivity ? Math.round((now - timer.lastActivity) / 60000) : 0;
  
  return {
    shouldAutoPause: settings.enableActivityDetection && 
                    inactiveMinutes >= settings.autoPauseAfterMinutes && 
                    !timer.pausedAt,
    shouldAutoStop: elapsedMinutes >= settings.autoStopAfterMinutes,
    shouldRemind: elapsedMinutes > 0 && 
                 elapsedMinutes % settings.reminderIntervalMinutes === 0
  };
}

export function updateTimerActivity(timer: AdvancedTimer): AdvancedTimer {
  return {
    ...timer,
    lastActivity: Date.now()
  };
}

// Activity detection using various browser APIs
export function setupActivityDetection(onActivity: () => void): () => void {
  const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
  let timeout: NodeJS.Timeout;
  
  const handleActivity = () => {
    clearTimeout(timeout);
    timeout = setTimeout(onActivity, 1000); // Debounce activity
  };
  
  events.forEach(event => {
    document.addEventListener(event, handleActivity, true);
  });
  
  // Cleanup function
  return () => {
    clearTimeout(timeout);
    events.forEach(event => {
      document.removeEventListener(event, handleActivity, true);
    });
  };
}

// Offline sync functionality
export interface OfflineTimeEntry {
  id: string;
  timer: AdvancedTimer;
  endTime: number;
  totalMinutes: number;
  synced: boolean;
}

export function saveOfflineEntry(entry: OfflineTimeEntry) {
  if (typeof window === 'undefined') return;
  
  const existing = getOfflineEntries();
  existing.push(entry);
  localStorage.setItem('pf_offline_entries_v1', JSON.stringify(existing));
}

export function getOfflineEntries(): OfflineTimeEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem('pf_offline_entries_v1') || '[]');
  } catch {
    return [];
  }
}

export function markOfflineEntrySynced(id: string) {
  const entries = getOfflineEntries();
  const updated = entries.map(e => e.id === id ? { ...e, synced: true } : e);
  localStorage.setItem('pf_offline_entries_v1', JSON.stringify(updated));
}

export function clearSyncedOfflineEntries() {
  const entries = getOfflineEntries();
  const unsynced = entries.filter(e => !e.synced);
  localStorage.setItem('pf_offline_entries_v1', JSON.stringify(unsynced));
}

// Timer notifications
export function requestTimerNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    return Promise.resolve(false);
  }
  
  if (Notification.permission === 'granted') {
    return Promise.resolve(true);
  }
  
  if (Notification.permission === 'denied') {
    return Promise.resolve(false);
  }
  
  return Notification.requestPermission().then(permission => {
    return permission === 'granted';
  });
}

export function showTimerNotification(title: string, body: string, actions?: { action: string; title: string }[]) {
  if (Notification.permission !== 'granted') return;
  
  const notification = new Notification(title, {
    body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: 'timer-notification',
    requireInteraction: true,
    actions: actions || []
  });
  
  // Auto-close after 10 seconds
  setTimeout(() => {
    notification.close();
  }, 10000);
  
  return notification;
}

// Format time for display
export function formatTimerDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (hours === 0) {
    return `${mins}m`;
  }
  
  return `${hours}h ${mins}m`;
}

export function formatTimerTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}:${String(mins).padStart(2, '0')}`;
}
