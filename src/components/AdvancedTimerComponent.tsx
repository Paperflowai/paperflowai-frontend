// src/components/AdvancedTimerComponent.tsx
"use client";

import { useState, useEffect, useCallback } from 'react';
import {
  AdvancedTimer,
  TimerSettings,
  loadTimerSettings,
  saveTimerSettings,
  loadAdvancedTimers,
  saveAdvancedTimers,
  createAdvancedTimer,
  pauseTimer,
  resumeTimer,
  stopTimer,
  getTimerElapsed,
  checkTimerActivity,
  updateTimerActivity,
  setupActivityDetection,
  formatTimerTime,
  formatTimerDuration,
  showTimerNotification,
  requestTimerNotificationPermission
} from '@/lib/advancedTimer';

interface AdvancedTimerComponentProps {
  onTimeEntryCreated: (customer: string, project: string, note: string, minutes: number) => void;
  suggestedCustomer?: string;
  suggestedProject?: string;
}

export default function AdvancedTimerComponent({ 
  onTimeEntryCreated, 
  suggestedCustomer = '', 
  suggestedProject = '' 
}: AdvancedTimerComponentProps) {
  const [timers, setTimers] = useState<AdvancedTimer[]>([]);
  const [settings, setSettings] = useState<TimerSettings>(loadTimerSettings());
  const [showSettings, setShowSettings] = useState(false);
  const [, forceUpdate] = useState(0);

  // New timer form
  const [newCustomer, setNewCustomer] = useState(suggestedCustomer);
  const [newProject, setNewProject] = useState(suggestedProject);
  const [newNote, setNewNote] = useState('');

  useEffect(() => {
    setTimers(loadAdvancedTimers());
    requestTimerNotificationPermission();
  }, []);

  useEffect(() => {
    setNewCustomer(suggestedCustomer);
    setNewProject(suggestedProject);
  }, [suggestedCustomer, suggestedProject]);

  // Activity detection
  const handleActivity = useCallback(() => {
    setTimers(current => {
      const updated = current.map(timer => 
        timer.isActive ? updateTimerActivity(timer) : timer
      );
      if (JSON.stringify(updated) !== JSON.stringify(current)) {
        saveAdvancedTimers(updated);
        return updated;
      }
      return current;
    });
  }, []);

  useEffect(() => {
    if (settings.enableActivityDetection) {
      return setupActivityDetection(handleActivity);
    }
  }, [settings.enableActivityDetection, handleActivity]);

  // Timer tick and auto-management
  useEffect(() => {
    const interval = setInterval(() => {
      setTimers(current => {
        let updated = [...current];
        let hasChanges = false;

        updated.forEach((timer, index) => {
          if (!timer.isActive && !timer.pausedAt) return;

          const checks = checkTimerActivity(timer, settings);
          
          if (checks.shouldAutoStop) {
            const { timer: stoppedTimer, totalMinutes } = stopTimer(timer);
            updated[index] = stoppedTimer;
            hasChanges = true;
            
            showTimerNotification(
              'Timer automatiskt stoppad',
              `${timer.customer} - ${timer.project} (${formatTimerDuration(totalMinutes)})`
            );
            
            onTimeEntryCreated(timer.customer, timer.project, timer.note, totalMinutes);
          } else if (checks.shouldAutoPause && timer.isActive) {
            updated[index] = pauseTimer(timer);
            hasChanges = true;
            
            showTimerNotification(
              'Timer pausad (inaktivitet)',
              `${timer.customer} - ${timer.project}`
            );
          } else if (checks.shouldRemind && timer.isActive) {
            const elapsed = getTimerElapsed(timer);
            showTimerNotification(
              'Timer påminnelse',
              `${timer.customer} - ${timer.project} (${formatTimerDuration(elapsed)})`
            );
          }
        });

        if (hasChanges) {
          saveAdvancedTimers(updated);
        }

        return updated;
      });
      
      forceUpdate(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [settings, onTimeEntryCreated]);

  function startNewTimer() {
    if (!newCustomer.trim()) return;

    if (!settings.enableMultipleTimers) {
      // Stop all existing timers
      const stoppedTimers = timers.map(timer => {
        if (timer.isActive || timer.pausedAt) {
          const { timer: stopped, totalMinutes } = stopTimer(timer);
          onTimeEntryCreated(timer.customer, timer.project, timer.note, totalMinutes);
          return stopped;
        }
        return timer;
      });
      setTimers(stoppedTimers);
    }

    const newTimer = createAdvancedTimer(newCustomer.trim(), newProject.trim(), newNote.trim());
    const updated = [...timers, newTimer];
    setTimers(updated);
    saveAdvancedTimers(updated);
    
    setNewNote('');
    
    showTimerNotification(
      'Timer startad',
      `${newTimer.customer} - ${newTimer.project}`
    );
  }

  function handlePauseResume(timerId: string) {
    setTimers(current => {
      const updated = current.map(timer => {
        if (timer.id === timerId) {
          return timer.isActive ? pauseTimer(timer) : resumeTimer(timer);
        }
        return timer;
      });
      saveAdvancedTimers(updated);
      return updated;
    });
  }

  function handleStopTimer(timerId: string) {
    setTimers(current => {
      const timer = current.find(t => t.id === timerId);
      if (!timer) return current;

      const { timer: stoppedTimer, totalMinutes } = stopTimer(timer);
      onTimeEntryCreated(timer.customer, timer.project, timer.note, totalMinutes);
      
      const updated = current.map(t => t.id === timerId ? stoppedTimer : t);
      saveAdvancedTimers(updated);
      
      showTimerNotification(
        'Timer stoppad',
        `${timer.customer} - ${timer.project} (${formatTimerDuration(totalMinutes)})`
      );
      
      return updated;
    });
  }

  function deleteTimer(timerId: string) {
    const updated = timers.filter(t => t.id !== timerId);
    setTimers(updated);
    saveAdvancedTimers(updated);
  }

  function updateSettings(newSettings: Partial<TimerSettings>) {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    saveTimerSettings(updated);
  }

  const activeTimers = timers.filter(t => t.isActive || t.pausedAt);
  const completedTimers = timers.filter(t => !t.isActive && !t.pausedAt);

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, background: '#fff', padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: 18, fontWeight: 600 }}>Avancerad Timer</h3>
        <button
          onClick={() => setShowSettings(!showSettings)}
          style={{
            padding: '6px 12px',
            borderRadius: 6,
            border: '1px solid #e5e7eb',
            background: 'white',
            fontSize: 12
          }}
        >
          ⚙️ Inställningar
        </button>
      </div>

      {showSettings && (
        <div style={{ 
          border: '1px solid #e5e7eb', 
          borderRadius: 8, 
          padding: 16, 
          marginBottom: 16, 
          background: '#f8fafc' 
        }}>
          <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Timer-inställningar</h4>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 500 }}>Auto-stopp efter (minuter)</span>
              <input
                type="number"
                value={settings.autoStopAfterMinutes}
                onChange={(e) => updateSettings({ autoStopAfterMinutes: Number(e.target.value) })}
                style={{ padding: 6, borderRadius: 4, border: '1px solid #ddd', fontSize: 12 }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 500 }}>Auto-paus efter (minuter)</span>
              <input
                type="number"
                value={settings.autoPauseAfterMinutes}
                onChange={(e) => updateSettings({ autoPauseAfterMinutes: Number(e.target.value) })}
                style={{ padding: 6, borderRadius: 4, border: '1px solid #ddd', fontSize: 12 }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 500 }}>Påminnelse var (minuter)</span>
              <input
                type="number"
                value={settings.reminderIntervalMinutes}
                onChange={(e) => updateSettings({ reminderIntervalMinutes: Number(e.target.value) })}
                style={{ padding: 6, borderRadius: 4, border: '1px solid #ddd', fontSize: 12 }}
              />
            </label>
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="checkbox"
                checked={settings.enableActivityDetection}
                onChange={(e) => updateSettings({ enableActivityDetection: e.target.checked })}
              />
              <span style={{ fontSize: 12 }}>Aktivitetsdetektering</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="checkbox"
                checked={settings.enableMultipleTimers}
                onChange={(e) => updateSettings({ enableMultipleTimers: e.target.checked })}
              />
              <span style={{ fontSize: 12 }}>Flera samtidiga timers</span>
            </label>
          </div>
        </div>
      )}

      {/* New timer form */}
      <div style={{ 
        border: '1px solid #e5e7eb', 
        borderRadius: 8, 
        padding: 12, 
        marginBottom: 16, 
        background: '#f8fafc' 
      }}>
        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 1fr 2fr auto' }}>
          <input
            placeholder="Kund"
            value={newCustomer}
            onChange={(e) => setNewCustomer(e.target.value)}
            style={{ padding: 8, borderRadius: 6, border: '1px solid #ddd', fontSize: 14 }}
          />
          <input
            placeholder="Projekt"
            value={newProject}
            onChange={(e) => setNewProject(e.target.value)}
            style={{ padding: 8, borderRadius: 6, border: '1px solid #ddd', fontSize: 14 }}
          />
          <input
            placeholder="Anteckning"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            style={{ padding: 8, borderRadius: 6, border: '1px solid #ddd', fontSize: 14 }}
          />
          <button
            onClick={startNewTimer}
            disabled={!newCustomer.trim()}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: '1px solid #10b981',
              background: newCustomer.trim() ? '#10b981' : '#e5e7eb',
              color: 'white',
              fontSize: 14,
              fontWeight: 600
            }}
          >
            ▶ Start
          </button>
        </div>
      </div>

      {/* Active timers */}
      {activeTimers.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Aktiva timers</h4>
          <div style={{ display: 'grid', gap: 8 }}>
            {activeTimers.map(timer => {
              const elapsed = getTimerElapsed(timer);
              const isPaused = !!timer.pausedAt;
              
              return (
                <div key={timer.id} style={{ 
                  border: '1px solid #e5e7eb', 
                  borderRadius: 8, 
                  padding: 12,
                  background: isPaused ? '#fef3c7' : '#ecfdf5'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>
                        {timer.customer} {timer.project && `• ${timer.project}`}
                      </div>
                      {timer.note && (
                        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                          {timer.note}
                        </div>
                      )}
                      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                        {isPaused ? '⏸️ Pausad' : '▶️ Aktiv'} • {formatTimerTime(elapsed)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => handlePauseResume(timer.id)}
                        style={{
                          padding: '6px 10px',
                          borderRadius: 4,
                          border: '1px solid #f59e0b',
                          background: '#f59e0b',
                          color: 'white',
                          fontSize: 12
                        }}
                      >
                        {isPaused ? '▶' : '⏸'}
                      </button>
                      <button
                        onClick={() => handleStopTimer(timer.id)}
                        style={{
                          padding: '6px 10px',
                          borderRadius: 4,
                          border: '1px solid #ef4444',
                          background: '#ef4444',
                          color: 'white',
                          fontSize: 12
                        }}
                      >
                        ⏹
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent completed timers */}
      {completedTimers.length > 0 && (
        <div>
          <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
            Senaste stoppade ({completedTimers.length})
          </h4>
          <div style={{ display: 'grid', gap: 6 }}>
            {completedTimers.slice(0, 3).map(timer => {
              const totalTime = timer.autoStoppedAt ? 
                (timer.autoStoppedAt - timer.startedAt - timer.totalPausedTime) / 60000 : 0;
              
              return (
                <div key={timer.id} style={{ 
                  border: '1px solid #e5e7eb', 
                  borderRadius: 6, 
                  padding: 8,
                  background: '#f8fafc',
                  fontSize: 12
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontWeight: 600 }}>
                        {timer.customer} {timer.project && `• ${timer.project}`}
                      </span>
                      {timer.note && <span style={{ color: '#6b7280' }}> • {timer.note}</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 600 }}>
                        {formatTimerDuration(Math.round(totalTime))}
                      </span>
                      <button
                        onClick={() => deleteTimer(timer.id)}
                        style={{
                          padding: '2px 6px',
                          borderRadius: 3,
                          border: '1px solid #e5e7eb',
                          background: 'white',
                          fontSize: 10
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTimers.length === 0 && completedTimers.length === 0 && (
        <div style={{ color: '#6b7280', textAlign: 'center', padding: 20, fontSize: 14 }}>
          Inga timers ännu. Starta din första timer ovan.
        </div>
      )}
    </div>
  );
}
