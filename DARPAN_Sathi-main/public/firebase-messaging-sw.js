// --- 1. Imports ---
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// --- 2. Firebase Initialize ---
firebase.initializeApp({
  apiKey: "AIzaSyDxc_YQgHUeklyQ39qMDCLukkrxMyzfSlM",
  authDomain: "darpan-c4404.firebaseapp.com",
  projectId: "darpan-c4404",
  storageBucket: "darpan-c4404.firebasestorage.app",
  messagingSenderId: "544374777467",
  appId: "1:544374777467:web:9b70bf5b160a67f75ae4de"
});

const messaging = firebase.messaging();

// --- 3. Background Message Handler ---
messaging.onBackgroundMessage((payload) => {
  console.log('Background message received: ', payload);
  
  const notificationTitle = payload.notification.title || 'Darpan Update';
  const notificationOptions = {
    body: payload.notification.body || 'You have a new notification!',
    icon: '/logo2.png',
    badge: '/logo2.png',
    data: {
      url: 'https://darpan-sathi.vercel.app/'
    }
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// --- 4. Notification Click Handler (YEH ISKE BAHAR HOGA) ---
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Agar tab khula hai to focus karo, nahi to naya tab kholo
      for (let i = 0; i < clientList.length; i++) {
        let client = clientList[i];
        if (client.url === event.notification.data.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data.url);
      }
    })
  );
});