/**
 * firebase-messaging-sw.js
 * Required by Firebase Cloud Messaging for web push -- must be served
 * from the site root (not js/) so its scope covers the whole origin.
 * Service workers can't use ES module imports, hence importScripts()
 * and the older "compat" build here instead of the modular SDK used
 * everywhere else in this project.
 *
 * Same real project config as js/firebase-config.js, necessarily
 * duplicated here for the reason above -- see that file for why these
 * values are safe to have in public client-side code.
 */

importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyC55EbITSBFx_N2hFafK7e9PkIyBpLA_q8",
  authDomain: "trackly-55d05.firebaseapp.com",
  projectId: "trackly-55d05",
  storageBucket: "trackly-55d05.firebasestorage.app",
  messagingSenderId: "93667285326",
  appId: "1:93667285326:web:f5f4f0359f379c1d11a61f",
});

const messaging = firebase.messaging();

// Shows a notification when a push arrives while Trackly isn't the
// focused tab -- this is the entire point: it has to work with the
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
