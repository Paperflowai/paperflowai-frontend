// src/lib/notifications.ts
import { getReminderSettings } from './reminders';

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission === 'denied') {
    return false;
  }

  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.log('Service Worker not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    console.log('Service Worker registered:', registration);
    return registration;
  } catch (error) {
    console.error('Service Worker registration failed:', error);
    return null;
  }
}

export async function subscribeToPushNotifications(): Promise<PushSubscription | null> {
  const registration = await registerServiceWorker();
  if (!registration) return null;

  try {
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(
        'BEl62iUYgUivxIkv69yViEuiBIa40HI80NqIHSUHVi358b4MjB_Qk_4qgD-Yz2c-GqvsuP2B13-oLCqjMUDkRjI' // VAPID public key
      )
    });

    console.log('Push subscription:', subscription);
    return subscription;
  } catch (error) {
    console.error('Failed to subscribe to push notifications:', error);
    return null;
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
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

export async function sendPushNotification(title: string, body: string, data: any = {}) {
  const settings = getReminderSettings();
  if (!settings.pushEnabled) return;

  // In a real app, this would send to your push service
  // For now, we'll use the local notification API
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, {
      body,
      icon: '/icon-192x192.png',
      tag: data.tag || 'bill-reminder',
      data
    });
  }
}

export function setupNotificationHandlers() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      const { type, billId, reminderId, days } = event.data;
      
      if (type === 'MARK_BILL_PAID') {
        // Trigger bill paid action
        window.dispatchEvent(new CustomEvent('bill:mark-paid', { detail: { billId } }));
      } else if (type === 'SNOOZE_REMINDER') {
        // Trigger snooze action
        window.dispatchEvent(new CustomEvent('reminder:snooze', { detail: { reminderId, days } }));
      }
    });
  }
}
