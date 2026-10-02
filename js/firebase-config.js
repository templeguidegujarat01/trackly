/**
 * firebase-config.js
 *
 * Real project config for Trackly (trackly-55d05), Spark (free) plan.
 *
 * This is safe to have in client-side, publicly-visible code — unlike a
 * typical API secret, a Firebase web config doesn't grant access to
 * anything on its own. Actual data access is controlled entirely by
 * Firestore Security Rules (see firestore.rules) and Firebase
 * Authentication, both of which run server-side regardless of what a
 * browser sends. This is Google's own documented guidance for Firebase
 * web apps, not a shortcut taken here.
 *
 * Loaded from Google's CDN as native ES modules — no npm, no build
 * step, works directly on GitHub Pages exactly like every other script
 * in this project.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC55EbITSBFx_N2hFafK7e9PkIyBpLA_q8",
  authDomain: "trackly-55d05.firebaseapp.com",
  projectId: "trackly-55d05",
  storageBucket: "trackly-55d05.firebasestorage.app",
  messagingSenderId: "93667285326",
  appId: "1:93667285326:web:f5f4f0359f379c1d11a61f",
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);

/** ACTION STILL NEEDED: Firebase Console -> Project settings -> Cloud
 *  Messaging -> Web configuration -> Generate key pair, then paste that
 *  value here. This one genuinely can't be filled in without you
 *  generating it yourself -- see SETUP.md step 5. */
export const VAPID_KEY = "REPLACE_WITH_YOUR_VAPID_KEY";
