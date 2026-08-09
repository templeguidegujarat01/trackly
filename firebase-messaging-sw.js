/**
 * firebase-messaging-sw.js
 * Required by Firebase Cloud Messaging for web push — must be served
 * from the site root (not js/) so its scope covers the whole origin.
 * Service workers can't use ES module imports, hence importScripts()
 * and the older "compat" build here instead of the modular SDK used
 * everywhere else in this project.
 *
 * ACTION REQUIRED: fill in the same config values you used in
 * js/firebase-config.js — service workers can't import that file, so
 * the values are necessarily duplicated here.
 */

importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "REPLACE_WITH_YOUR_API_KEY",
  authDomain: "REPLACE_WITH_YOUR_PROJECT.firebaseapp.com",
  projectId: "REPLACE_WITH_YOUR_PROJECT_ID",
  storageBucket: "REPLACE_WITH_YOUR_PROJECT.appspot.com",
  messagingSenderId: "REPLACE_WITH_YOUR_SENDER_ID",
  appId: "REPLACE_WITH_YOUR_APP_ID",
});

const messaging = firebase.messaging();

// Shows a notification when a push arrives while Trackly isn't the
// focused tab — this is the entire point: it has to work with the
// site closed.
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || "Trackly";
  const options = {
    body: payload.notification?.body || "An update was released.",
    icon: "/assets/favicons/icon-192.png",
    badge: "/assets/favicons/icon-192.png",
    data: { url: payload.data?.url || "/" },
  };
  self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(clients.openWindow(url));
});
