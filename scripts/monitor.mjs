// scripts/monitor.mjs
//
// The real monitoring engine, run on a schedule by
// .github/workflows/monitor.yml — NOT by anything in this project's
// frontend. GitHub's Action runners have normal internet access (this
// development sandbox's network is restricted to package registries
// and github.com, so this script's fetch step cannot be exercised
// here — it's written correctly for where it actually runs).
//
// What it does, for every supported institute:
//   1. Fetch the institute's official notification page.
//   2. Normalize + hash the text content.
//   3. Compare against the last known hash (monitoring_state/{instituteId}).
//   4. If different: classify which tracker type the new content
//      relates to (keyword matching — the same "page comparison"
//      method documented as the only viable option for these five
//      sites, none of which have RSS or a public API).
//   5. Find active subscriptions for that institute + tracker.
//   6. Send a push notification (Firebase Cloud Messaging) to each
//      matching subscriber, and record it in `notifications` so the
//      dashboard and Notifications page can show it.
//
// Requires a GitHub secret named FIREBASE_SERVICE_ACCOUNT containing
// the full JSON of a Firebase service account key (Firebase Console →
// Project settings → Service accounts → Generate new private key).
// This uses the Admin SDK, which authenticates with that key and
// bypasses Firestore Security Rules by design — this script IS the
// trusted server-side actor those rules are written to keep everyone
// else out of.

import admin from "firebase-admin";
import crypto from "node:crypto";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!serviceAccountJson) {
  console.error("Missing FIREBASE_SERVICE_ACCOUNT environment variable. See README setup steps.");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(serviceAccountJson)),
});
const db = admin.firestore();
const messaging = admin.messaging();

// ---------------------------------------------------------------------------
// Config: which page to check per institute, and how to classify a
// change into a tracker type. Mirrors data/institutes.json and
// data/trackers.json — kept here (not re-fetched from the live site)
// so this script has zero runtime dependency on GitHub Pages being up.
// ---------------------------------------------------------------------------

const INSTITUTES = [
  { id: "icai", name: "ICAI", checkUrl: "https://www.icai.org/category/notifications" },
  { id: "icsi", name: "ICSI", checkUrl: "https://www.icsi.edu/student_rpn/" },
  { id: "upsc", name: "UPSC", checkUrl: "https://upsc.gov.in/examinations/active-exams" },
  { id: "ssc", name: "SSC", checkUrl: "https://ssc.gov.in" },
  { id: "ibps", name: "IBPS", checkUrl: "https://www.ibps.in" },
];

// Ordered by specificity — first match wins, so "admit card" is
// checked before the more generic "result".
const TRACKER_KEYWORDS = [
  { trackerId: "admit-cards", keywords: ["admit card", "hall ticket"] },
  { trackerId: "answer-keys", keywords: ["answer key"] },
  { trackerId: "interview-updates", keywords: ["interview"] },
  { trackerId: "training-updates", keywords: ["training programme", "training program"] },
  { trackerId: "mtp", keywords: ["mock test paper", "mtp"] },
  { trackerId: "rtp", keywords: ["revision test paper", "rtp"] },
  { trackerId: "recruitments", keywords: ["recruitment", "vacancy", "vacancies"] },
  { trackerId: "exam-timetable", keywords: ["time table", "timetable"] },
  { trackerId: "exam-calendar", keywords: ["exam calendar", "examination calendar"] },
  { trackerId: "exam-dates", keywords: ["exam date"] },
  { trackerId: "important-circulars", keywords: ["important circular"] },
  { trackerId: "circulars", keywords: ["circular"] },
  { trackerId: "results", keywords: ["result"] },
  { trackerId: "notifications", keywords: [] }, // fallback: matches any change
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function hashOf(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

/** Very small, deliberately conservative diff: returns the words that
 *  appear in `next` but not `prev`, joined back into a rough excerpt.
 *  Good enough to classify a change's topic; not meant to be a precise
 *  diff algorithm. */
function newContentExcerpt(prevText, nextText) {
  const prevWords = new Set(prevText.split(" "));
  const nextWords = nextText.split(" ");
  const added = nextWords.filter((w) => !prevWords.has(w));
  return added.join(" ").slice(0, 2000);
}

function classifyTracker(excerptLower) {
  for (const entry of TRACKER_KEYWORDS) {
    if (entry.keywords.length === 0) continue;
    if (entry.keywords.some((kw) => excerptLower.includes(kw))) {
      return entry.trackerId;
    }
  }
  return "notifications"; // fallback bucket — a real change, unclassified
}

async function fetchPage(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; TracklyMonitor/1.0)" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`Fetch failed (${res.status}) for ${url}`);
  return res.text();
}

// ---------------------------------------------------------------------------
// Core per-institute check
// ---------------------------------------------------------------------------

async function checkInstitute(institute) {
  console.log(`Checking ${institute.name} (${institute.checkUrl})...`);

  let html;
  try {
    html = await fetchPage(institute.checkUrl);
  } catch (err) {
    console.error(`  fetch error: ${err.message}`);
    await db.collection("monitoring_state").doc(institute.id).set(
      { lastCheckedAt: admin.firestore.FieldValue.serverTimestamp(), lastError: err.message },
      { merge: true }
    );
    return;
  }

  const text = normalizeText(html);
  const newHash = hashOf(text);

  const stateRef = db.collection("monitoring_state").doc(institute.id);
  const stateSnap = await stateRef.get();
  const prevState = stateSnap.exists ? stateSnap.data() : null;

  if (!prevState) {
    // First run for this institute: record a baseline, don't notify —
    // there's nothing to compare against yet, so "changed" would be
    // meaningless noise on day one.
    await stateRef.set({
      contentHash: newHash,
      lastCheckedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastChangedAt: null,
    });
    console.log(`  baseline recorded, no prior state to compare`);
    return;
  }

  if (prevState.contentHash === newHash) {
    await stateRef.set({ lastCheckedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    console.log(`  no change`);
    return;
  }

  console.log(`  CHANGE DETECTED`);
  const excerpt = newContentExcerpt(prevState.lastText || "", text);
  const trackerId = classifyTracker(excerpt || text);

  const changeRef = await db.collection("changes").add({
    instituteId: institute.id,
    instituteName: institute.name,
    trackerId,
    detectedAt: admin.firestore.FieldValue.serverTimestamp(),
    sourceUrl: institute.checkUrl,
    excerpt: excerpt.slice(0, 500),
    contentHash: newHash,
  });

  await stateRef.set(
    {
      contentHash: newHash,
      lastText: text.slice(0, 20000), // capped, just enough for next diff
      lastCheckedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastChangedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await notifySubscribers(institute, trackerId, changeRef.id);
}

// ---------------------------------------------------------------------------
// Notification dispatch
// ---------------------------------------------------------------------------

async function notifySubscribers(institute, trackerId, changeId) {
  const subsSnap = await db
    .collection("subscriptions")
    .where("instituteId", "==", institute.id)
    .where("trackerId", "==", trackerId)
    .where("active", "==", true)
    .get();

  if (subsSnap.empty) {
    console.log(`  no active subscriptions for ${institute.id}/${trackerId}`);
    return;
  }

  console.log(`  notifying ${subsSnap.size} subscriber(s)`);

  for (const subDoc of subsSnap.docs) {
    const sub = subDoc.data();
    const userSnap = await db.collection("users").doc(sub.userId).get();
    const user = userSnap.exists ? userSnap.data() : null;

    const title = `${institute.name}: new ${sub.trackerLabel || trackerId} update`;
    const body = "Tap to see what changed on the official source.";

    // Write the notification record regardless of whether push succeeds —
    // the dashboard/Notifications page should show it either way.
    await db.collection("notifications").add({
      userId: sub.userId,
      subscriptionId: subDoc.id,
      changeId,
      instituteId: institute.id,
      trackerId,
      title,
      body,
      read: false,
      pushStatus: "pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    if (user?.fcmToken && user?.pushEnabled !== false) {
      try {
        await messaging.send({
          token: user.fcmToken,
          notification: { title, body },
          data: { url: `/track.html?org=${institute.id}&tracker=${trackerId}` },
        });
        console.log(`    push sent to user ${sub.userId}`);
      } catch (err) {
        console.error(`    push failed for user ${sub.userId}: ${err.message}`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

async function main() {
  for (const institute of INSTITUTES) {
    await checkInstitute(institute);
  }
  console.log("Monitoring run complete.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Fatal error in monitoring run:", err);
    process.exit(1);
  });
