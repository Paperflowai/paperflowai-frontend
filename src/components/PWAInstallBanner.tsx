// src/components/PWAInstallBanner.tsx
"use client";

import { useState, useEffect } from 'react';
import { pwaManager } from '@/lib/pwaManager';

export default function PWAInstallBanner() {
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Check initial states
    setShowInstallBanner(pwaManager.canInstall());
    setShowUpdateBanner(pwaManager.hasUpdateAvailable());
    setIsOnline(pwaManager.isOnline());

    // Listen for PWA events
    const handleInstallAvailable = () => setShowInstallBanner(true);
    const handleInstalled = () => setShowInstallBanner(false);
    const handleUpdateAvailable = () => setShowUpdateBanner(true);

    window.addEventListener('pwa:installAvailable', handleInstallAvailable);
    window.addEventListener('pwa:installed', handleInstalled);
    window.addEventListener('pwa:updateAvailable', handleUpdateAvailable);

    // Listen for online/offline status
    const unsubscribeOnlineStatus = pwaManager.onOnlineStatusChange(setIsOnline);

    return () => {
      window.removeEventListener('pwa:installAvailable', handleInstallAvailable);
      window.removeEventListener('pwa:installed', handleInstalled);
      window.removeEventListener('pwa:updateAvailable', handleUpdateAvailable);
      unsubscribeOnlineStatus();
    };
  }, []);

  const handleInstall = async () => {
    const installed = await pwaManager.promptInstall();
    if (installed) {
      setShowInstallBanner(false);
    }
  };

  const handleUpdate = async () => {
    await pwaManager.updateApp();
    setShowUpdateBanner(false);
  };

  return (
    <>
      {/* Offline indicator */}
      {!isOnline && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          backgroundColor: '#ef4444',
          color: 'white',
          padding: '8px 16px',
          textAlign: 'center',
          fontSize: 14,
          fontWeight: 600,
          zIndex: 1001
        }}>
          📡 Offline-läge • Data synkas när du kommer online igen
        </div>
      )}

      {/* Install banner */}
      {showInstallBanner && (
        <div style={{
          position: 'fixed',
          bottom: 16,
          left: 16,
          right: 16,
          backgroundColor: '#0ea5e9',
          color: 'white',
          padding: 16,
          borderRadius: 12,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: 12
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>
              📱 Installera appen
            </div>
            <div style={{ fontSize: 14, opacity: 0.9 }}>
              Få snabbare åtkomst och offline-funktionalitet
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setShowInstallBanner(false)}
              style={{
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid rgba(255,255,255,0.3)',
                background: 'transparent',
                color: 'white',
                fontSize: 14
              }}
            >
              Senare
            </button>
            <button
              onClick={handleInstall}
              style={{
                padding: '8px 16px',
                borderRadius: 6,
                border: 'none',
                background: 'white',
                color: '#0ea5e9',
                fontSize: 14,
                fontWeight: 600
              }}
            >
              Installera
            </button>
          </div>
        </div>
      )}

      {/* Update banner */}
      {showUpdateBanner && (
        <div style={{
          position: 'fixed',
          bottom: 16,
          left: 16,
          right: 16,
          backgroundColor: '#10b981',
          color: 'white',
          padding: 16,
          borderRadius: 12,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: 12
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>
              🔄 Uppdatering tillgänglig
            </div>
            <div style={{ fontSize: 14, opacity: 0.9 }}>
              Nya funktioner och förbättringar väntar
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setShowUpdateBanner(false)}
              style={{
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid rgba(255,255,255,0.3)',
                background: 'transparent',
                color: 'white',
                fontSize: 14
              }}
            >
              Senare
            </button>
            <button
              onClick={handleUpdate}
              style={{
                padding: '8px 16px',
                borderRadius: 6,
                border: 'none',
                background: 'white',
                color: '#10b981',
                fontSize: 14,
                fontWeight: 600
              }}
            >
              Uppdatera
            </button>
          </div>
        </div>
      )}
    </>
  );
}
