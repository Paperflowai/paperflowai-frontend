// public/sw.js - Service Worker for push notifications
const CACHE_NAME = 'offertplattform-v1';

self.addEventListener('install', (event) => {
  console.log('Service Worker installing');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activating');
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  console.log('Push received:', event);
  
  if (!event.data) return;
  
  const data = event.data.json();
  const options = {
    body: data.body,
    icon: '/icon-192x192.png',
    badge: '/icon-72x72.png',
    tag: data.tag || 'bill-reminder',
    data: data.data || {},
    actions: [
      {
        action: 'mark-paid',
        title: '✓ Betald',
        icon: '/icon-check.png'
      },
      {
        action: 'snooze',
        title: '💤 Snooza 1 dag',
        icon: '/icon-snooze.png'
      },
      {
        action: 'open',
        title: '📄 Öppna faktura',
        icon: '/icon-open.png'
      }
    ],
    requireInteraction: true,
    silent: false
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  
  event.notification.close();
  
  const { action } = event;
  const { billId, reminderId } = event.notification.data;
  
  if (action === 'mark-paid') {
    // Send message to mark bill as paid
    event.waitUntil(
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'MARK_BILL_PAID',
            billId
          });
        });
      })
    );
  } else if (action === 'snooze') {
    // Send message to snooze reminder
    event.waitUntil(
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'SNOOZE_REMINDER',
            reminderId,
            days: 1
          });
        });
      })
    );
  } else {
    // Default action - open app
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then(clients => {
        // Check if app is already open
        for (const client of clients) {
          if (client.url.includes('/bills') && 'focus' in client) {
            return client.focus();
          }
        }
        // Open new window
        if (self.clients.openWindow) {
          return self.clients.openWindow('/bills');
        }
      })
    );
  }
});

self.addEventListener('notificationclose', (event) => {
  console.log('Notification closed:', event);
});
