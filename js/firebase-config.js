/**
 * firebase-config.js
 *
 * ============================================================
 * ACTION REQUIRED — this file will not work until you edit it.
 * ============================================================
 * The values below are placeholders. Replace them with your own
 * Firebase project's config (Firebase Console → Project settings →
 * General → "Your apps" → Web app → SDK setup and configuration).
 * These values are not secret — they identify your project, they
 * don't authorize access on their own (Firestore Security Rules do
 * that) — so it's normal and safe for them to live in this
 * client-side file on GitHub Pages.
 *
 * Loaded from Google's CDN as native ES modules — no npm, no build
 * step, works directly on GitHub Pages exactly like every other
 * script in this project.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "REPLACE_WITH_YOUR_API_KEY",
  authDomain: "REPLACE_WITH_YOUR_PROJECT.firebaseapp.com",
  projectId: "REPLACE_WITH_YOUR_PROJECT_ID",
  storageBucket: "REPLACE_WITH_YOUR_PROJECT.appspot.com",
  messagingSenderId: "REPLACE_WITH_YOUR_SENDER_ID",
  appId: "REPLACE_WITH_YOUR_APP_ID",
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);

/** Set once you've created a Web Push certificate in Firebase Console →
 *  Project settings → Cloud Messaging → Web configuration. Used by
 *  push.js when requesting a notification permission token. */
export const VAPID_KEY = "REPLACE_WITH_YOUR_VAPID_KEY";
