/**
 * auth.js
 * Real authentication using Firebase Auth. Session persistence is
 * handled entirely by the Firebase SDK (IndexedDB-backed, survives
 * closing the browser — this is what makes "close the site, get
 * notified later" possible: the subscription written while logged in
 * belongs to a durable account, not a browser session).
 */

import {
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { auth, db } from "./firebase-config.js";

const googleProvider = new GoogleAuthProvider();

let currentUser = null;
const authStateListeners = [];

// Persist across browser restarts (default is already local, set
// explicitly so this behavior doesn't silently change on an SDK update).
setPersistence(auth, browserLocalPersistence).catch((err) => console.error("Auth persistence error:", err));

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (user) {
    await ensureUserProfile(user);
  }
  authStateListeners.forEach((cb) => cb(user));
});

/** Creates/updates the user's profile doc on every sign-in. Cheap
 *  (single merged write) and keeps displayName/email/photo current if
 *  they change on the provider side. */
async function ensureUserProfile(user) {
  try {
    await setDoc(
      doc(db, "users", user.uid),
      {
        email: user.email,
        displayName: user.displayName || null,
        photoURL: user.photoURL || null,
        lastSeenAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    console.error("Failed to write user profile:", err);
  }
}

export function getCurrentUser() {
  return currentUser;
}

export function isSignedIn() {
  return Boolean(currentUser);
}

/** Registers a callback invoked immediately with the current user (or
 *  null) and again on every future auth state change. Returns an
 *  unsubscribe function. */
export function onAuthChange(callback) {
  callback(currentUser);
  authStateListeners.push(callback);
  return () => {
    const i = authStateListeners.indexOf(callback);
    if (i > -1) authStateListeners.splice(i, 1);
  };
}

export async function signInWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signUpWithEmail(email, password) {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  return result.user;
}

export async function signInWithEmail(email, password) {
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
}

export async function signOut() {
  await firebaseSignOut(auth);
}

/** Maps Firebase's error codes to messages a student, not a developer,
 *  should see — the site-wide "never show technical errors" rule
 *  applies here too. */
export function friendlyAuthError(error) {
  const map = {
    "auth/invalid-email": "That doesn't look like a valid email address.",
    "auth/user-not-found": "No account found with that email.",
    "auth/wrong-password": "Incorrect password.",
    "auth/invalid-credential": "Incorrect email or password.",
    "auth/email-already-in-use": "An account already exists with that email — try signing in instead.",
    "auth/weak-password": "Please choose a password with at least 6 characters.",
    "auth/popup-closed-by-user": "Sign-in was cancelled.",
    "auth/network-request-failed": "Couldn't reach the sign-in service. Check your connection and try again.",
    "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
  };
  return map[error?.code] || "Something went wrong signing you in. Please try again.";
}
