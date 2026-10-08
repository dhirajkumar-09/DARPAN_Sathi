// public/firebase-messaging-sw.js
// Handles background FCM push notifications when the app tab is closed or in background.

importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDxc_YQgHUeklyQ39qMDCLukkrxMyzfSlM",
  authDomain: "darpan-c4404.firebaseapp.com",
  projectId: "darpan-c4404",
  storageBucket: "darpan-c4404.firebasestorage.app",
  messagingSenderId: "544374777467",
  appId: "1:544374777467:web:9b70bf5b160a67f75ae4de"
});

const messaging = firebase.messaging();

// Handle background messages (when tab is closed / not focused)
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Background message received:', payload);

  const title = payload.notification?.title || 'DARPAN';
  const body  = payload.notification?.body  || 'You have a new update.';
  const type  = payload.data?.type || '';

  // Map notification types to relevant landing paths
  const linkMap = {
    new_story: '/?page=stories',
    reaction:  '/?page=stories',
    comment:   '/?page=stories',
    reply:     '/?page=stories',
  };
  const link = linkMap[type] || '/';

  const options = {
    body,
    icon:  '/logo2.png',
    badge: '/logo2.png',
    vibrate: [200, 100, 200],
    tag: type || 'darpan-notification',   // replaces older notif of same type (no spam)
    renotify: true,
    data: { url: link, ...payload.data },
    actions: [
      { action: 'open', title: '👁️ View' },
      { action: 'dismiss', title: 'Dismiss' },
    ]
  };

  self.registration.showNotification(title, options);
});

// Handle notification click — open or focus the app tab
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If app is already open in a tab, focus it
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.postMessage({ type: 'NOTIFICATION_CLICK', url: targetUrl });
          return;
        }
      }
      // Otherwise open a new tab
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});