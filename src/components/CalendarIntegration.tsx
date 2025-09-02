// src/components/CalendarIntegration.tsx
"use client";

import { useState, useEffect } from 'react';
import {
  CalendarIntegration as CalendarIntegrationType,
  CalendarEvent,
  TimeBlockSuggestion,
  loadCalendarIntegrations,
  saveCalendarIntegrations,
  loadCalendarEvents,
  connectGoogleCalendar,
  connectOutlookCalendar,
  suggestTimeBlocks,
  extractWorkInfoFromEvent,
  getSyncStatus
} from '@/lib/calendarIntegration';

interface CalendarIntegrationProps {
  onTimeSuggestion?: (customer: string, project: string, start: string, end: string) => void;
}

export default function CalendarIntegration({ onTimeSuggestion }: CalendarIntegrationProps) {
  const [integrations, setIntegrations] = useState<CalendarIntegrationType[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [suggestions, setSuggestions] = useState<TimeBlockSuggestion[]>([]);
  const [isConnecting, setIsConnecting] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    setIntegrations(loadCalendarIntegrations());
    setEvents(loadCalendarEvents());
  }, []);

  useEffect(() => {
    const newSuggestions = suggestTimeBlocks(events, { start: 9, end: 17 }, selectedDate);
    setSuggestions(newSuggestions);
  }, [events, selectedDate]);

  async function handleConnect(type: 'google' | 'outlook') {
    setIsConnecting(type);
    try {
      const integration = type === 'google' 
        ? await connectGoogleCalendar()
        : await connectOutlookCalendar();
      
      const updated = [...integrations, integration];
      setIntegrations(updated);
      saveCalendarIntegrations(updated);
    } catch (error) {
      console.error('Connection failed:', error);
    } finally {
      setIsConnecting(null);
    }
  }

  function toggleIntegration(id: string, field: keyof CalendarIntegrationType, value: any) {
    const updated = integrations.map(i => 
      i.id === id ? { ...i, [field]: value } : i
    );
    setIntegrations(updated);
    saveCalendarIntegrations(updated);
  }

  function handleUseSuggestion(suggestion: TimeBlockSuggestion) {
    if (!onTimeSuggestion) return;

    // Try to extract work info from related event
    const relatedEvent = events.find(e => 
      new Date(e.start).getTime() <= new Date(suggestion.start).getTime() &&
      new Date(e.end).getTime() >= new Date(suggestion.end).getTime()
    );

    let customer = '';
    let project = '';

    if (relatedEvent) {
      const workInfo = extractWorkInfoFromEvent(relatedEvent);
      customer = workInfo.customer || '';
      project = workInfo.project || '';
    }

    onTimeSuggestion(customer, project, suggestion.start, suggestion.end);
  }

  const todayEvents = events.filter(e => 
    new Date(e.start).toISOString().split('T')[0] === selectedDate
  ).sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, background: '#fff', padding: 16 }}>
      <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Kalenderintegration</h3>

      {/* Integration status */}
      <div style={{ marginBottom: 16 }}>
        <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Anslutningar</h4>
        <div style={{ display: 'grid', gap: 8 }}>
          {integrations.map(integration => (
            <div key={integration.id} style={{ 
              border: '1px solid #e5e7eb', 
              borderRadius: 8, 
              padding: 12,
              background: integration.isConnected ? '#ecfdf5' : '#fef3c7'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>
                    {integration.name}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    {integration.isConnected ? 'Ansluten' : 'Frånkopplad'}
                    {integration.lastSync && ` • Senast synkad: ${new Date(integration.lastSync).toLocaleString('sv-SE')}`}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                    <input
                      type="checkbox"
                      checked={integration.syncEnabled}
                      onChange={(e) => toggleIntegration(integration.id, 'syncEnabled', e.target.checked)}
                      disabled={!integration.isConnected}
                    />
                    Auto-synk
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                    <input
                      type="checkbox"
                      checked={integration.autoCreateTimeEntries}
                      onChange={(e) => toggleIntegration(integration.id, 'autoCreateTimeEntries', e.target.checked)}
                      disabled={!integration.isConnected}
                    />
                    Auto-tidrapport
                  </label>
                </div>
              </div>
            </div>
          ))}
        </div>

        {integrations.length === 0 && (
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <button
              onClick={() => handleConnect('google')}
              disabled={isConnecting === 'google'}
              style={{
                padding: '8px 16px',
                borderRadius: 6,
                border: '1px solid #4285f4',
                background: '#4285f4',
                color: 'white',
                fontSize: 14,
                fontWeight: 600
              }}
            >
              {isConnecting === 'google' ? 'Ansluter...' : '📅 Anslut Google Calendar'}
            </button>
            <button
              onClick={() => handleConnect('outlook')}
              disabled={isConnecting === 'outlook'}
              style={{
                padding: '8px 16px',
                borderRadius: 6,
                border: '1px solid #0078d4',
                background: '#0078d4',
                color: 'white',
                fontSize: 14,
                fontWeight: 600
              }}
            >
              {isConnecting === 'outlook' ? 'Ansluter...' : '📅 Anslut Outlook'}
            </button>
          </div>
        )}
      </div>

      {/* Date selector */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
          Visa dag
        </label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          style={{ padding: 8, borderRadius: 6, border: '1px solid #ddd' }}
        />
      </div>

      {/* Today's events */}
      <div style={{ marginBottom: 16 }}>
        <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
          Kalenderhändelser ({selectedDate})
        </h4>
        {todayEvents.length === 0 ? (
          <div style={{ color: '#6b7280', fontSize: 14, padding: 12, textAlign: 'center' }}>
            Inga händelser denna dag
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 6 }}>
            {todayEvents.map(event => {
              const workInfo = extractWorkInfoFromEvent(event);
              return (
                <div key={event.id} style={{ 
                  border: '1px solid #e5e7eb', 
                  borderRadius: 6, 
                  padding: 8,
                  background: '#f8fafc'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>
                        {event.title}
                      </div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>
                        {new Date(event.start).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })} - 
                        {new Date(event.end).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      {(workInfo.customer || workInfo.project) && (
                        <div style={{ fontSize: 12, color: '#059669', marginTop: 2 }}>
                          {workInfo.customer && `Kund: ${workInfo.customer}`}
                          {workInfo.project && ` • Projekt: ${workInfo.project}`}
                        </div>
                      )}
                    </div>
                    <div style={{ 
                      fontSize: 10, 
                      padding: '2px 6px', 
                      borderRadius: 3,
                      background: event.source === 'google' ? '#4285f4' : 
                                 event.source === 'outlook' ? '#0078d4' : '#6b7280',
                      color: 'white'
                    }}>
                      {event.source}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Time suggestions */}
      {suggestions.length > 0 && (
        <div>
          <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
            Smarta tidsförslag
          </h4>
          <div style={{ display: 'grid', gap: 6 }}>
            {suggestions.slice(0, 5).map((suggestion, index) => (
              <div key={index} style={{ 
                border: '1px solid #e5e7eb', 
                borderRadius: 6, 
                padding: 8,
                background: '#ecfeff'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>
                      {Math.round(suggestion.duration / 60 * 10) / 10}h tillgänglig
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>
                      {new Date(suggestion.start).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })} - 
                      {new Date(suggestion.end).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div style={{ fontSize: 12, color: '#0891b2' }}>
                      {suggestion.reason}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ 
                      fontSize: 10, 
                      padding: '2px 6px', 
                      borderRadius: 3,
                      background: suggestion.confidence > 0.8 ? '#10b981' : 
                                 suggestion.confidence > 0.6 ? '#f59e0b' : '#6b7280',
                      color: 'white'
                    }}>
                      {Math.round(suggestion.confidence * 100)}%
                    </div>
                    {onTimeSuggestion && (
                      <button
                        onClick={() => handleUseSuggestion(suggestion)}
                        style={{
                          padding: '4px 8px',
                          borderRadius: 4,
                          border: '1px solid #0ea5e9',
                          background: '#0ea5e9',
                          color: 'white',
                          fontSize: 12
                        }}
                      >
                        Använd
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
