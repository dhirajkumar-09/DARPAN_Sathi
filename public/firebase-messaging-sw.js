// ═══════════════════════════════════════════════════════════════
// DARPAN Firebase Messaging Service Worker
// Handles background push notifications when website is CLOSED / MINIMIZED
// ═══════════════════════════════════════════════════════════════

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDxc_YQgHUeklyQ39qMDCLukkrxMyzfSlM",
  authDomain: "darpan-c4404.firebaseapp.com",
  projectId: "darpan-c4404",
  storageBucket: "darpan-c4404.firebasestorage.app",
  messagingSenderId: "544374777467",
  appId: "1:544374777467:web:9b70bf5b160a67f75ae4de"
});

const messaging = firebase.messaging();

// Map notification type → deep link URL
function getLink(data) {
  const base = 'https://darpan-sathi.vercel.app';
  const map = {
    new_story: base + '/?page=stories',
    reaction:  base + '/?page=stories',
    comment:   base + '/?page=stories',
    reply:     base + '/?page=stories',
  };
  return map[data?.type] || (data?.url || base + '/?page=stories');
}

// Show native OS notification (Windows toast / Android push)
function showRichNotification(title, body, data = {}) {
  const link = getLink(data);
  const type = data.type || 'general';

  const prefixes = {
    new_story: '📖',
    reaction:  '❤️',
    comment:   '💬',
    reply:     '↩️',
    broadcast: '📢',
  };
  const emoji = prefixes[type] || '🔔';
  const safeTitle = (title || 'DARPAN').startsWith(emoji) ? title : `${emoji} ${title || 'DARPAN'}`;

  return self.registration.showNotification(safeTitle, {
    body: body || 'You have a new update on DARPAN',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [150, 50, 150],
    tag: `${type}_${Date.now()}`,
    renotify: true,
    requireInteraction: false,
    silent: false,
    timestamp: Date.now(),
    data: { url: link, type, ...data },
    actions: [
      { action: 'open', title: 'Open DARPAN' }
    ]
  });
}

// FCM background message handler (data messages)
messaging.onBackgroundMessage((payload) => {
  console.log('[DARPAN SW] Background FCM message:', payload);
  const title = payload.notification?.title || payload.data?.title || 'DARPAN';
  const body  = payload.notification?.body  || payload.data?.body  || 'You have a new update.';
  const data  = { ...(payload.data || {}), ...(payload.notification || {}) };
  return showRichNotification(title, body, data);
});

// Raw push event fallback (ensures notifications appear even if FCM compat doesn't auto-display)
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch (err) {
    // If text only
    const text = event.data.text();
    return event.waitUntil(showRichNotification('DARPAN', text, {}));
  }

  // If this push already contained a notification block that FCM SDK auto-displayed, skip raw display
  // But if payload was data-only, display it here
  if (payload.notification && payload.notification.title) {
    // Already displayed by browser or FCM SDK if handled
    return;
  }

  const title = payload.data?.title || 'DARPAN';
  const body  = payload.data?.body  || 'New update on DARPAN!';
  const data  = payload.data || {};

  event.waitUntil(showRichNotification(title, body, data));
});

// Notification click handler — opens DARPAN and navigates to stories
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url || 'https://darpan-sathi.vercel.app/?page=stories';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If DARPAN is already open in an existing tab → focus and navigate
      for (const client of windowClients) {
        if ('focus' in client) {
          client.focus();
          client.postMessage({ type: 'NOTIFICATION_CLICK', url: targetUrl });
          if ('navigate' in client && client.url !== targetUrl) {
            client.navigate(targetUrl);
          }
          return;
        }
      }
      // If closed, open fresh window/tab
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Instant SW updates
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(clients.claim()));