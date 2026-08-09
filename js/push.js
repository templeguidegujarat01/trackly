/**
 * push.js
 * Handles the "Enable Browser Notifications" button: registers the
 * service worker, asks for permission, gets an FCM token, and saves it
 * to the signed-in user's profile — that token is what the monitoring
 * Action sends pushes to.
 */

import { getMessaging, getToken } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging.js";
import { firebaseApp, VAPID_KEY } from "./firebase-config.js";
import { qs, onReady } from "./utils.js";
import { isSignedIn, onAuthChange } from "./auth.js";
import { saveFcmToken } from "./firestore.js";
import { showToast } from "./toast.js";

async function enablePush() {
  const statusEl = qs("[data-push-status]");
  const setStatus = (text) => {
    if (statusEl) statusEl.textContent = text;
  };

  if (!isSignedIn()) {
    setStatus("Log in first, then enable notifications.");
    return;
  }

  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    setStatus("This browser doesn't support push notifications.");
    return;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setStatus("Notifications are blocked. Enable them in your browser's site settings to receive alerts.");
      return;
    }

    const registration = await navigator.serviceWorker.register("firebase-messaging-sw.js");
    const messaging = getMessaging(firebaseApp);
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });

    if (!token) {
      setStatus("Couldn't get a notification token. Please try again.");
      return;
    }

    await saveFcmToken(token);
    setStatus("Notifications are on for this browser.");
    showToast("Notifications enabled");
  } catch (err) {
    console.error("Push setup failed:", err);
    setStatus("Something went wrong enabling notifications. Please try again.");
  }
}

function init() {
  const btn = qs("[data-enable-push]");
  if (!btn) return;

  btn.addEventListener("click", enablePush);

  onAuthChange((user) => {
    const statusEl = qs("[data-push-status]");
    if (!user && statusEl) statusEl.textContent = "Log in to enable notifications.";
  });
}

onReady(init);
