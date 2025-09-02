// src/lib/calendarIntegration.ts
export interface CalendarEvent {
  id: string;
  title: string;
  start: string; // ISO date
  end: string; // ISO date
  description?: string;
  location?: string;
  attendees?: string[];
  isAllDay: boolean;
  source: 'google' | 'outlook' | 'manual';
  externalId?: string;
}

export interface CalendarIntegration {
  id: string;
  name: string;
  type: 'google' | 'outlook';
  isConnected: boolean;
  lastSync?: string;
  syncEnabled: boolean;
  autoCreateTimeEntries: boolean;
  defaultCustomer?: string;
  defaultProject?: string;
}

export interface TimeBlockSuggestion {
  start: string;
  end: string;
  duration: number; // minutes
  reason: string;
  confidence: number; // 0-1
}

// Mock calendar data for demo
const MOCK_EVENTS: CalendarEvent[] = [
  {
    id: '1',
    title: 'Kundmöte - Acme Corp',
    start: new Date().toISOString(),
    end: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    description: 'Diskussion om nytt projekt',
    isAllDay: false,
    source: 'google',
    externalId: 'google_123'
  },
  {
    id: '2',
    title: 'Utveckling - Dashboard',
    start: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    end: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    isAllDay: false,
    source: 'manual'
  }
];

export function loadCalendarIntegrations(): CalendarIntegration[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem('pf_calendar_integrations_v1');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function saveCalendarIntegrations(integrations: CalendarIntegration[]) {
  localStorage.setItem('pf_calendar_integrations_v1', JSON.stringify(integrations));
}

export function loadCalendarEvents(): CalendarEvent[] {
  if (typeof window === 'undefined') return MOCK_EVENTS;
  try {
    const stored = localStorage.getItem('pf_calendar_events_v1');
    return stored ? JSON.parse(stored) : MOCK_EVENTS;
  } catch {
    return MOCK_EVENTS;
  }
}

export function saveCalendarEvents(events: CalendarEvent[]) {
  localStorage.setItem('pf_calendar_events_v1', JSON.stringify(events));
}

// Calendar sync functions
export async function syncGoogleCalendar(integrationId: string): Promise<CalendarEvent[]> {
  // In a real implementation, this would use Google Calendar API
  console.log('Syncing Google Calendar:', integrationId);
  
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Return mock events
  return MOCK_EVENTS.filter(e => e.source === 'google');
}

export async function syncOutlookCalendar(integrationId: string): Promise<CalendarEvent[]> {
  // In a real implementation, this would use Microsoft Graph API
  console.log('Syncing Outlook Calendar:', integrationId);
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  return [];
}

export function connectGoogleCalendar(): Promise<CalendarIntegration> {
  // In a real implementation, this would handle OAuth flow
  return new Promise((resolve) => {
    setTimeout(() => {
      const integration: CalendarIntegration = {
        id: crypto.randomUUID(),
        name: 'Google Calendar',
        type: 'google',
        isConnected: true,
        lastSync: new Date().toISOString(),
        syncEnabled: true,
        autoCreateTimeEntries: false
      };
      resolve(integration);
    }, 2000);
  });
}

export function connectOutlookCalendar(): Promise<CalendarIntegration> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const integration: CalendarIntegration = {
        id: crypto.randomUUID(),
        name: 'Outlook Calendar',
        type: 'outlook',
        isConnected: true,
        lastSync: new Date().toISOString(),
        syncEnabled: true,
        autoCreateTimeEntries: false
      };
      resolve(integration);
    }, 2000);
  });
}

// Smart time suggestions based on calendar
export function suggestTimeBlocks(
  events: CalendarEvent[],
  workingHours: { start: number; end: number } = { start: 9, end: 17 },
  date: string = new Date().toISOString().split('T')[0]
): TimeBlockSuggestion[] {
  const suggestions: TimeBlockSuggestion[] = [];
  const dayStart = new Date(`${date}T${String(workingHours.start).padStart(2, '0')}:00:00`);
  const dayEnd = new Date(`${date}T${String(workingHours.end).padStart(2, '0')}:00:00`);
  
  // Filter events for the specific date
  const dayEvents = events.filter(event => {
    const eventDate = new Date(event.start).toISOString().split('T')[0];
    return eventDate === date && !event.isAllDay;
  }).sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  
  // Find gaps between events
  let currentTime = dayStart.getTime();
  
  for (const event of dayEvents) {
    const eventStart = new Date(event.start).getTime();
    const eventEnd = new Date(event.end).getTime();
    
    // Check for gap before this event
    if (eventStart > currentTime) {
      const gapDuration = Math.round((eventStart - currentTime) / 60000);
      if (gapDuration >= 30) { // At least 30 minutes
        suggestions.push({
          start: new Date(currentTime).toISOString(),
          end: new Date(eventStart).toISOString(),
          duration: gapDuration,
          reason: `Ledig tid före "${event.title}"`,
          confidence: 0.8
        });
      }
    }
    
    // Auto-suggest time entry for meetings that look like work
    if (isWorkRelatedEvent(event)) {
      const duration = Math.round((eventEnd - eventStart) / 60000);
      suggestions.push({
        start: event.start,
        end: event.end,
        duration,
        reason: `Möte: "${event.title}"`,
        confidence: 0.9
      });
    }
    
    currentTime = Math.max(currentTime, eventEnd);
  }
  
  // Check for time after last event
  if (currentTime < dayEnd.getTime()) {
    const remainingDuration = Math.round((dayEnd.getTime() - currentTime) / 60000);
    if (remainingDuration >= 30) {
      suggestions.push({
        start: new Date(currentTime).toISOString(),
        end: dayEnd.toISOString(),
        duration: remainingDuration,
        reason: 'Ledig tid efter sista mötet',
        confidence: 0.7
      });
    }
  }
  
  return suggestions.sort((a, b) => b.confidence - a.confidence);
}

function isWorkRelatedEvent(event: CalendarEvent): boolean {
  const workKeywords = [
    'möte', 'meeting', 'kund', 'client', 'projekt', 'project', 
    'utveckling', 'development', 'planering', 'planning',
    'review', 'standup', 'demo', 'presentation'
  ];
  
  const title = event.title.toLowerCase();
  return workKeywords.some(keyword => title.includes(keyword));
}

// Extract customer/project from calendar events
export function extractWorkInfoFromEvent(event: CalendarEvent): {
  customer?: string;
  project?: string;
  confidence: number;
} {
  const title = event.title.toLowerCase();
  
  // Look for customer patterns
  const customerPatterns = [
    /(?:kund|client|möte med|meeting with)\s*[-:]?\s*([a-zåäö\s]+)/i,
    /([a-zåäö]+\s*(?:ab|corp|inc|ltd|gmbh))/i
  ];
  
  let customer: string | undefined;
  let confidence = 0.5;
  
  for (const pattern of customerPatterns) {
    const match = event.title.match(pattern);
    if (match) {
      customer = match[1].trim();
      confidence = 0.8;
      break;
    }
  }
  
  // Look for project patterns
  const projectPatterns = [
    /(?:projekt|project)\s*[-:]?\s*([a-zåäö\s]+)/i,
    /(?:utveckling|development|build)\s*[-:]?\s*([a-zåäö\s]+)/i
  ];
  
  let project: string | undefined;
  
  for (const pattern of projectPatterns) {
    const match = event.title.match(pattern);
    if (match) {
      project = match[1].trim();
      confidence = Math.max(confidence, 0.8);
      break;
    }
  }
  
  return { customer, project, confidence };
}

// Calendar event creation
export function createCalendarEvent(
  title: string,
  start: string,
  end: string,
  description?: string
): CalendarEvent {
  return {
    id: crypto.randomUUID(),
    title,
    start,
    end,
    description,
    isAllDay: false,
    source: 'manual'
  };
}

// Sync status
export interface SyncStatus {
  isRunning: boolean;
  lastSync?: string;
  nextSync?: string;
  errors: string[];
}

export function getSyncStatus(): SyncStatus {
  if (typeof window === 'undefined') {
    return { isRunning: false, errors: [] };
  }
  
  try {
    const stored = localStorage.getItem('pf_calendar_sync_status_v1');
    return stored ? JSON.parse(stored) : { isRunning: false, errors: [] };
  } catch {
    return { isRunning: false, errors: [] };
  }
}

export function setSyncStatus(status: SyncStatus) {
  localStorage.setItem('pf_calendar_sync_status_v1', JSON.stringify(status));
}

// Auto-sync scheduler
export function scheduleAutoSync(intervalMinutes: number = 15) {
  if (typeof window === 'undefined') return;
  
  const interval = setInterval(async () => {
    const integrations = loadCalendarIntegrations();
    const activeIntegrations = integrations.filter(i => i.isConnected && i.syncEnabled);
    
    if (activeIntegrations.length === 0) return;
    
    const status = getSyncStatus();
    if (status.isRunning) return;
    
    setSyncStatus({ ...status, isRunning: true });
    
    try {
      for (const integration of activeIntegrations) {
        if (integration.type === 'google') {
          await syncGoogleCalendar(integration.id);
        } else if (integration.type === 'outlook') {
          await syncOutlookCalendar(integration.id);
        }
        
        // Update last sync time
        integration.lastSync = new Date().toISOString();
      }
      
      saveCalendarIntegrations(integrations);
      setSyncStatus({ 
        isRunning: false, 
        lastSync: new Date().toISOString(),
        nextSync: new Date(Date.now() + intervalMinutes * 60000).toISOString(),
        errors: [] 
      });
    } catch (error) {
      setSyncStatus({ 
        isRunning: false, 
        errors: [error instanceof Error ? error.message : 'Unknown sync error'] 
      });
    }
  }, intervalMinutes * 60000);
  
  return () => clearInterval(interval);
}
