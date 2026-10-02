// scripts/monitor.mjs
//
// The real monitoring engine, run on a schedule by
// .github/workflows/monitor.yml — NOT by anything in this project's
// frontend. GitHub's Action runners have normal internet access (this
// development sandbox's network is restricted to package registries
// and github.com, so this script's fetch step cannot be exercised
// here — it's written correctly for where it actually runs).
//
// Requires a GitHub secret named FIREBASE_SERVICE_ACCOUNT containing
// the full JSON of a Firebase service account key. This uses the
// Admin SDK, which bypasses Firestore Security Rules by design — this
// script IS the trusted server-side actor those rules keep everyone
// else out of.

import admin from "firebase-admin";
import crypto from "node:crypto";

const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!serviceAccountJson) {
  console.error("Missing FIREBASE_SERVICE_ACCOUNT environment variable. See SETUP.md.");
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(serviceAccountJson)) });
const db = admin.firestore();
const messaging = admin.messaging();

// ---------------------------------------------------------------------------
// Config
//
// Each institute has one or more `checks` — a named source URL to
// fetch. Most institutes have exactly one (their general notifications
// page). ICAI has two: its notifications page, AND a separate results
// portal (icai.nic.in), because ICAI results are genuinely published
// on a different domain — verified via search across multiple
// 2022-2026 sources, not assumed. A change detected on the results
// portal is classified directly as "results" (forceTrackerId) rather
// than via keyword matching, since anything changing there is
// unambiguously a result by definition of what that domain is for.
// ---------------------------------------------------------------------------

const INSTITUTES = [
  {
    id: "icai", name: "ICAI",
    checks: [
      { key: "notifications", checkUrl: "https://www.icai.org/category/notifications" },
      { key: "results-portal", checkUrl: "https://icai.nic.in", forceTrackerId: "results" },
    ],
  },
  { id: "icsi", name: "ICSI", checks: [{ key: "notifications", checkUrl: "https://www.icsi.edu/student_rpn/" }] },
  { id: "upsc", name: "UPSC", checks: [{ key: "notifications", checkUrl: "https://upsc.gov.in/examinations/active-exams" }] },
  { id: "ssc", name: "SSC", checks: [{ key: "notifications", checkUrl: "https://ssc.gov.in" }] },
  { id: "ibps", name: "IBPS", checks: [{ key: "notifications", checkUrl: "https://www.ibps.in" }] },
];

// One real, verified limitation still open: a May-2026 source
// referenced "caresults.icai.org" as an alternative ICAI results
// subdomain instead of icai.nic.in. Worth re-checking periodically in
// case ICAI has migrated since — not re-verified as part of this pass.

// Directly motivated by a verified real failure mode: UPSC's site has
// been directly observed returning a "Website is too busy, please try
// again later" page instead of real content. If that page returns
// HTTP 200 (not a clean error status), a naive hash comparison would
// treat it as a legitimate content change. An error/loading page is
// reliably much shorter than a real one, so an implausibly short
// fetch is treated as a failure below, not a change.
const MIN_CONTENT_LENGTH = 500; // characters, after normalization

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
  { trackerId: "notifications", keywords: [] },
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

function newContentExcerpt(prevText, nextText) {
  const prevWords = new Set(prevText.split(" "));
  const nextWords = nextText.split(" ");
  return nextWords.filter((w) => !prevWords.has(w)).join(" ").slice(0, 2000);
}

/** Returns every tracker category whose keywords appear in the excerpt,
 *  not just the first match — a single diff can legitimately span more
 *  than one real update (e.g. a circular AND a result posted between
 *  checks). Falls back to "notifications" only if nothing more
 *  specific matched, so an unclassifiable-but-real change still
 *  reaches subscribers instead of being silently dropped. */
function classifyTrackers(excerptLower) {
  const matched = TRACKER_KEYWORDS
    .filter((entry) => entry.keywords.length > 0)
    .filter((entry) => entry.keywords.some((kw) => excerptLower.includes(kw)))
    .map((entry) => entry.trackerId);
  return matched.length > 0 ? [...new Set(matched)] : ["notifications"];
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
// Core per-check logic. Runs once per entry in an institute's `checks`
// array. State is stored per check (instituteId__checkKey), not per
// institute, so ICAI's two independent sources never clobber each other.
// ---------------------------------------------------------------------------

async function runCheck(institute, check) {
  const stateId = `${institute.id}__${check.key}`;
  console.log(`Checking ${institute.name} / ${check.key} (${check.checkUrl})...`);

  let html;
  try {
    html = await fetchPage(check.checkUrl);
  } catch (err) {
    console.error(`  fetch error: ${err.message}`);
    await db.collection("monitoring_state").doc(stateId).set(
      { lastCheckedAt: admin.firestore.FieldValue.serverTimestamp(), lastError: err.message },
      { merge: true }
    );
    return;
  }

  const text = normalizeText(html);

  if (text.length < MIN_CONTENT_LENGTH) {
    console.warn(`  suspiciously short content (${text.length} chars) — likely an error/loading page. Skipping.`);
    await db.collection("monitoring_state").doc(stateId).set(
      {
        lastCheckedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastError: `Content too short (${text.length} chars) — probably a temporary error page, not real content.`,
      },
      { merge: true }
    );
    return;
  }

  const newHash = hashOf(text);
  const stateRef = db.collection("monitoring_state").doc(stateId);
  const stateSnap = await stateRef.get();
  const prevState = stateSnap.exists ? stateSnap.data() : null;

  if (!prevState) {
    // First run for this check: record a baseline, don't notify —
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
  const trackerIds = check.forceTrackerId ? [check.forceTrackerId] : classifyTrackers(excerpt || text);
  console.log(`  classified as: ${trackerIds.join(", ")}`);

  await stateRef.set(
    {
      contentHash: newHash,
      lastText: text.slice(0, 20000), // capped, just enough for next diff
      lastCheckedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastChangedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  for (const trackerId of trackerIds) {
    const changeRef = await db.collection("changes").add({
      instituteId: institute.id,
      instituteName: institute.name,
      trackerId,
      detectedAt: admin.firestore.FieldValue.serverTimestamp(),
      sourceUrl: check.checkUrl,
      excerpt: excerpt.slice(0, 500),
      contentHash: newHash,
    });
    await notifySubscribers(institute, trackerId, changeRef.id);
  }
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

    // Written regardless of push success — the dashboard/Notifications
    // page should show it either way. Notification deduplication is
    // structural, not a separate check: a change record is only ever
    // created once per genuine content change (see runCheck above), so
    // this loop only runs once per real event, never repeatedly for
    // the same detected change.
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
    for (const check of institute.checks) {
      await runCheck(institute, check);
    }
  }
  console.log("Monitoring run complete.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Fatal error in monitoring run:", err);
    process.exit(1);
  });
