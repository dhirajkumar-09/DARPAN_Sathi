// public/firebase-messaging-sw.js

// 1. Import Firebase scripts inside the service worker
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// 2. Initialize Firebase (YAHAN APNI MAIN DETAILS DAALNA)
firebase.initializeApp({
  apiKey: "AIzaSyDxc_YQgHUeklyQ39qMDCLukkrxMyzfSlM",
  authDomain: "darpan-c4404.firebaseapp.com",
  projectId: "darpan-c4404",
  storageBucket: "darpan-c4404.firebasestorage.app",
  messagingSenderId: "544374777467",
  appId: "1:544374777467:web:9b70bf5b160a67f75ae4de"
});

// 3. Setup messaging
const messaging = firebase.messaging();

// 4. Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('Background message received: ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/logo2.png' // Tumhara logo jo public folder mein hai
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});