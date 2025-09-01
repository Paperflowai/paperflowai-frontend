// src/lib/pwaManager.ts
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

export class PWAManager {
  private deferredPrompt: BeforeInstallPromptEvent | null = null;
  private isInstalled = false;
  private updateAvailable = false;
  private registration: ServiceWorkerRegistration | null = null;

  constructor() {
    this.init();
  }

  private async init() {
    if (typeof window === 'undefined') return;

    // Check if already installed
    this.isInstalled = window.matchMedia('(display-mode: standalone)').matches ||
                     (window.navigator as any).standalone === true;

    // Listen for install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.notifyInstallAvailable();
    });

    // Listen for app installed
    window.addEventListener('appinstalled', () => {
      this.isInstalled = true;
      this.deferredPrompt = null;
      this.notifyInstalled();
    });

    // Register service worker
    await this.registerServiceWorker();
  }

  private async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        this.registration = await navigator.serviceWorker.register('/sw.js');
        
        // Listen for updates
        this.registration.addEventListener('updatefound', () => {
          const newWorker = this.registration!.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                this.updateAvailable = true;
                this.notifyUpdateAvailable();
              }
            });
          }
        });

        console.log('Service Worker registered successfully');
      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    }
  }

  async promptInstall(): Promise<boolean> {
    if (!this.deferredPrompt) return false;

    try {
      await this.deferredPrompt.prompt();
      const choiceResult = await this.deferredPrompt.userChoice;
      this.deferredPrompt = null;
      return choiceResult.outcome === 'accepted';
    } catch (error) {
      console.error('Install prompt failed:', error);
      return false;
    }
  }

  async updateApp(): Promise<void> {
    if (!this.registration || !this.updateAvailable) return;

    const newWorker = this.registration.waiting;
    if (newWorker) {
      newWorker.postMessage({ type: 'SKIP_WAITING' });
      window.location.reload();
    }
  }

  canInstall(): boolean {
    return !!this.deferredPrompt && !this.isInstalled;
  }

  isAppInstalled(): boolean {
    return this.isInstalled;
  }

  hasUpdateAvailable(): boolean {
    return this.updateAvailable;
  }

  private notifyInstallAvailable() {
    this.dispatchEvent('pwa:installAvailable');
  }

  private notifyInstalled() {
    this.dispatchEvent('pwa:installed');
  }

  private notifyUpdateAvailable() {
    this.dispatchEvent('pwa:updateAvailable');
  }

  private dispatchEvent(type: string, detail?: any) {
    window.dispatchEvent(new CustomEvent(type, { detail }));
  }

  // Offline detection
  isOnline(): boolean {
    return navigator.onLine;
  }

  onOnlineStatusChange(callback: (isOnline: boolean) => void) {
    const handleOnline = () => callback(true);
    const handleOffline = () => callback(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }

  // Background sync
  async requestBackgroundSync(tag: string) {
    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
      try {
        await this.registration?.sync.register(tag);
        return true;
      } catch (error) {
        console.error('Background sync registration failed:', error);
        return false;
      }
    }
    return false;
  }

  // Push notifications
  async subscribeToPush(): Promise<PushSubscription | null> {
    if (!this.registration) return null;

    try {
      const subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(
          'BEl62iUYgUivxIkv69yViEuiBIa40HI80NM9f53NlqKOYWXvTBHiuMiMpb-fw1eYmB3-Q4g6vxiJBFsTKFN2QDg'
        )
      });
      return subscription;
    } catch (error) {
      console.error('Push subscription failed:', error);
      return null;
    }
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // App shortcuts
  async addShortcut(shortcut: {
    name: string;
    url: string;
    description?: string;
    icon?: string;
  }) {
    if ('getInstalledRelatedApps' in navigator) {
      // This is a future API that might be available
      console.log('Adding shortcut:', shortcut);
    }
  }

  // Device capabilities
  getDeviceCapabilities() {
    return {
      standalone: this.isInstalled,
      online: this.isOnline(),
      notifications: 'Notification' in window,
      serviceWorker: 'serviceWorker' in navigator,
      backgroundSync: 'serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype,
      pushMessaging: 'PushManager' in window,
      camera: 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices,
      geolocation: 'geolocation' in navigator,
      vibration: 'vibrate' in navigator,
      battery: 'getBattery' in navigator,
      share: 'share' in navigator
    };
  }

  // Share API
  async share(data: { title?: string; text?: string; url?: string; files?: File[] }) {
    if ('share' in navigator) {
      try {
        await navigator.share(data);
        return true;
      } catch (error) {
        console.error('Share failed:', error);
        return false;
      }
    }
    return false;
  }

  // Vibration
  vibrate(pattern: number | number[]) {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  }

  // Storage estimation
  async getStorageEstimate() {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      return await navigator.storage.estimate();
    }
    return null;
  }
}

// Singleton instance
export const pwaManager = new PWAManager();
