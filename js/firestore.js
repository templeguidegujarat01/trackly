/**
 * firestore.js
 * Every read/write a signed-in user's data needs, in one place — no
 * page should import the Firestore SDK directly, they import from
 * here. Collections:
 *
 *   users/{uid}                      profile (written by auth.js)
 *   subscriptions/{subId}            what a user is tracking
 *   notifications/{notifId}          delivered/queued alerts for a user
 *   monitoring_state/{instituteId_trackerId}   last-known hash per source (written by the GitHub Action, read-only here)
 *   changes/{changeId}               detected change history (written by the GitHub Action, read-only here)
 */

import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDocs,
  query, where, orderBy, limit as fsLimit, onSnapshot, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { getCurrentUser } from "./auth.js";

function requireUser() {
  const user = getCurrentUser();
  if (!user) throw new Error("not-signed-in");
  return user;
}

/**
 * Creates a subscription. Shape matches the Change Record / Monitoring
 * Job contract already documented in this project's data model, plus
 * the user-facing fields (course, exam session) the Track flow collects.
 */
export async function createSubscription({ instituteId, instituteName, courseId, trackerId, trackerLabel, examSession }) {
  const user = requireUser();
  const ref = await addDoc(collection(db, "subscriptions"), {
    userId: user.uid,
    instituteId,
    instituteName,
    courseId: courseId || null,
    trackerId,
    trackerLabel,
    examSession: examSession || null,
    active: true,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getUserSubscriptions() {
  const user = requireUser();
  const q = query(
    collection(db, "subscriptions"),
    where("userId", "==", user.uid),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Live-updating version for the dashboard, so a subscription that
 *  changes state (e.g. a match found) updates without a page reload. */
export function watchUserSubscriptions(callback) {
  const user = requireUser();
  const q = query(
    collection(db, "subscriptions"),
    where("userId", "==", user.uid),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function deleteSubscription(subscriptionId) {
  await deleteDoc(doc(db, "subscriptions", subscriptionId));
}

export async function setSubscriptionActive(subscriptionId, active) {
  await updateDoc(doc(db, "subscriptions", subscriptionId), { active });
}

/** Checks whether the signed-in user already tracks this exact
 *  institute+tracker(+course+session) combination, so the Track button
 *  can say "Already tracking" instead of creating a duplicate. */
export async function findExistingSubscription({ instituteId, trackerId, courseId, examSession }) {
  const user = requireUser();
  const q = query(
    collection(db, "subscriptions"),
    where("userId", "==", user.uid),
    where("instituteId", "==", instituteId),
    where("trackerId", "==", trackerId)
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .find((s) => (s.courseId || null) === (courseId || null) && (s.examSession || null) === (examSession || null));
}

export async function getUserNotifications(max = 50) {
  const user = requireUser();
  const q = query(
    collection(db, "notifications"),
    where("userId", "==", user.uid),
    orderBy("createdAt", "desc"),
    fsLimit(max)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function markNotificationRead(notificationId) {
  await updateDoc(doc(db, "notifications", notificationId), { read: true });
}

/** Recent detected changes, public read (no auth required) — this is
 *  what results.html / notifications.html / important-dates.html
 *  render once real monitoring data exists, replacing the static demo
 *  JSON files. */
export async function getRecentChanges(max = 100) {
  const q = query(collection(db, "changes"), orderBy("detectedAt", "desc"), fsLimit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Stores/updates the signed-in user's FCM token, so the monitoring
 *  Action knows where to deliver a push. Called by push.js once
 *  notification permission is granted. */
export async function saveFcmToken(token) {
  const user = requireUser();
  await updateDoc(doc(db, "users", user.uid), { fcmToken: token, fcmTokenUpdatedAt: serverTimestamp() }).catch(async () => {
    // Profile doc may not exist yet on a brand-new account — retry as a set.
    const { setDoc } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");
    await setDoc(doc(db, "users", user.uid), { fcmToken: token, fcmTokenUpdatedAt: serverTimestamp() }, { merge: true });
  });
}

export async function updateNotificationPreferences({ pushEnabled, emailEnabled }) {
  const user = requireUser();
  await updateDoc(doc(db, "users", user.uid), { pushEnabled, emailEnabled });
}
