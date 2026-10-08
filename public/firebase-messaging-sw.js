// ═══════════════════════════════════════════════════════════════
// DARPAN Firebase Messaging Service Worker
// Handles background push notifications exactly like WhatsApp:
//   - Works when browser tab is closed
//   - Works when browser is minimized
//   - Works when phone screen is off (Android PWA)
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

// ── Map notification type → deep link URL ──────────────────────
function getLink(data) {
  const base = 'https://darpan-sathi.vercel.app';
  const map = {
    new_story: base + '/?page=stories',
    reaction:  base + '/?page=stories',
    comment:   base + '/?page=stories',
    reply:     base + '/?page=stories',
  };
  return map[data?.type] || base;
}

// ── Show a rich notification (called from both FCM and raw push) ─
function showRichNotification(title, body, data = {}) {
  const link = getLink(data);
  const type = data.type || 'general';

  // Emoji prefix for different notification types
  const prefixes = {
    new_story: '📖',
    reaction:  '❤️',
    comment:   '💬',
    reply:     '↩️',
    broadcast: '📢',
  };
  const emoji = prefixes[type] || '🔔';

  return self.registration.showNotification(`${emoji} ${title}`, {
    body: body,
    icon:  '/icon-192.png',
    badge: '/icon-192.png',      // Small icon shown in Android status bar
    image: '/icon-512.png',      // Large preview image in expanded notification
    vibrate: [100, 50, 100, 50, 200],   // WhatsApp-style vibration pattern
    sound: '/notification.mp3',  // (optional, most browsers ignore this)
    tag: type,                   // Replaces old notification of same type (no spam)
    renotify: true,              // Still vibrates even if replacing same tag
    requireInteraction: false,   // Auto-dismiss after a few seconds
    silent: false,
    timestamp: Date.now(),
    data: { url: link, type, ...data },
    actions: [
      { action: 'open',    title: '👁 View'   },
      { action: 'dismiss', title: '✖ Dismiss' },
    ],
  });
}

// ══════════════════════════════════════════════════════════════════
// FCM BACKGROUND MESSAGE HANDLER
// Fires when: app tab is closed, browser is minimized / in background
// ══════════════════════════════════════════════════════════════════
messaging.onBackgroundMessage((payload) => {
  console.log('[DARPAN SW] Background FCM message:', payload);

  const title = payload.notification?.title || 'DARPAN';
  const body  = payload.notification?.body  || 'You have a new update.';
  const data  = payload.data || {};

  return showRichNotification(title, body, data);
});

// ══════════════════════════════════════════════════════════════════
// RAW PUSH EVENT HANDLER (belt-and-suspenders for Android PWA)
// Catches pushes that FCM compat layer might miss on some devices
// ══════════════════════════════════════════════════════════════════
self.addEventListener('push', (event) => {
  // FCM compat already handles most cases above; this catches the rest
  if (!event.data) return;

  let payload = {};
  try { payload = event.data.json(); } catch { return; }

  // If FCM already handled it via onBackgroundMessage, skip
  if (payload.data?.handled === 'fcm') return;

  const title = payload.notification?.title || payload.data?.title || 'DARPAN';
  const body  = payload.notification?.body  || payload.data?.body  || 'New update!';
  const data  = payload.data || {};

  event.waitUntil(showRichNotification(title, body, data));
});

// ══════════════════════════════════════════════════════════════════
// NOTIFICATION CLICK HANDLER
// Opens the app or focuses existing tab — exactly like WhatsApp
// ══════════════════════════════════════════════════════════════════
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url || 'https://darpan-sathi.vercel.app/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If DARPAN is already open in a tab → focus it & navigate
      for (const client of windowClients) {
        if ('focus' in client) {
          client.focus();
          // Tell the React app which page to navigate to
          client.postMessage({ type: 'NOTIFICATION_CLICK', url: targetUrl });
          return;
        }
      }
      // Otherwise open a fresh tab
      return clients.openWindow(targetUrl);
    })
  );
});

// ══════════════════════════════════════════════════════════════════
// SERVICE WORKER LIFECYCLE — Skip waiting so updates apply instantly
// ══════════════════════════════════════════════════════════════════
self.addEventListener('install',  () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(clients.claim()));