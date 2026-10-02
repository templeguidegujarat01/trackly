# Trackly — Setup Guide

This is written for someone who has never used Firebase or GitHub
settings before. Follow it top to bottom, in order. Each step tells
you exactly where to click and what you should see when it worked.

If anything on your screen looks different from what's described here,
stop and send a screenshot rather than guessing — Firebase and GitHub
occasionally change their layouts, and it's easy to click the wrong
thing.

---

## Step 1 — Turn on sign-in methods

1. Go to https://console.firebase.google.com and open your **Trackly**
   project (the one with ID `trackly-55d05`).
2. In the left sidebar, click **Build**, then click **Authentication**.
3. Click the **Sign-in method** tab near the top.
4. You'll see a list of providers. Click **Google**.
   - Toggle **Enable** to on (it turns blue/green).
   - A field labeled "Project support email" appears — pick your own
     email from the dropdown.
   - Click **Save**.
5. Click **Add new provider** (or find **Email/Password** in the same
   list) → click it.
   - Toggle **Enable** to on for the first option ("Email/Password").
   - Leave "Email link (passwordless sign-in)" off.
   - Click **Save**.

**Success looks like:** the Sign-in method tab now shows "Google" and
"Email/Password" both listed as **Enabled**.

---

## Step 2 — Create the database

1. In the left sidebar: **Build → Firestore Database**.
2. Click **Create database**.
3. A dialog appears asking for a location. Pick the one closest to
   India (e.g. `asia-south1`), then click **Next**.
4. Choose **Start in production mode** (NOT test mode), then click
   **Create**.
5. Wait about 30 seconds for it to finish setting up.
6. Once it's ready, click the **Rules** tab (next to "Data", near the
   top of the Firestore page).
7. You'll see a text box with some default rules already in it.
   **Select everything in that box and delete it.**
8. Open the file named `firestore.rules` in the project folder you
   downloaded. Select all of its text and copy it.
9. Paste it into the empty Rules box in Firebase.
10. Click **Publish** (top right of the Rules box).

**Success looks like:** a small confirmation message appears saying
your rules were published, and the timestamp next to "Rules" updates
to "just now."

---

## Step 3 — Generate your push notification key

1. Click the **gear icon** next to "Project Overview" (top left) →
   **Project settings**.
2. Click the **Cloud Messaging** tab.
3. Scroll down to the section called **Web configuration**.
4. Under "Web Push certificates," click **Generate key pair**.
5. A long string of letters and numbers appears — this is your VAPID
   key. Click the copy icon next to it.
6. Open the file `js/firebase-config.js` in the project folder.
7. Find the line near the bottom that says:
   `export const VAPID_KEY = "REPLACE_WITH_YOUR_VAPID_KEY";`
8. Replace the text `REPLACE_WITH_YOUR_VAPID_KEY` (keep the quote
   marks around it) with the key you copied, so it looks like:
   `export const VAPID_KEY = "BF7x...(your actual key)...";`
9. Save the file.

**Success looks like:** the Cloud Messaging tab now shows a key
listed under "Web Push certificates" instead of an empty box.

---

## Step 4 — Create the service account key (for automatic monitoring)

This key lets the automatic checker (which runs on GitHub, not in
your browser) read and write to your database. It is powerful, so it
must never be pasted into any file in the project — only into GitHub's
secret storage, described in Step 5.

1. Still in **Project settings**, click the **Service accounts** tab.
2. Click **Generate new private key**.
3. A warning dialog appears — click **Generate key**.
4. A file starting with something like `trackly-55d05-firebase-...json`
   downloads to your computer. Leave it where it downloaded for now —
   you'll need it in the very next step.

**Success looks like:** a `.json` file appears in your Downloads
folder (or wherever your browser saves downloads).

---

## Step 5 — Add the secret to GitHub

1. Open the downloaded `.json` file from Step 4 in any text editor
   (Notepad, TextEdit, VS Code — anything that opens plain text).
   Select all of its contents and copy them.
2. Go to your repository on GitHub: `github.com/templeguidegujarat01/trackly`
3. Click **Settings** (top menu of the repo, not your account
   settings).
4. In the left sidebar: **Secrets and variables → Actions**.
5. Click the green **New repository secret** button.
6. In the "Name" field, type exactly: `FIREBASE_SERVICE_ACCOUNT`
7. In the "Secret" field, paste the entire contents of the `.json`
   file you copied in step 1.
8. Click **Add secret**.
9. **Now delete the downloaded `.json` file from your computer** — it
   only needs to exist inside GitHub's secret storage from here on.

**Success looks like:** `FIREBASE_SERVICE_ACCOUNT` appears in the list
of repository secrets (GitHub only shows the name, never the value
again — that's expected and correct).

---

## Step 6 — Push everything to GitHub

Upload/commit every file from the project folder to your repository,
replacing what's currently there. If you're not sure how, any of
these work:
- GitHub Desktop app (drag the folder in, write a commit message,
  click "Push")
- GitHub.com's web upload (open your repo → **Add file → Upload
  files** → drag in the whole folder)

**Success looks like:** your repository's file list on GitHub matches
the project folder, including the `.github` folder (it may be hidden
in your file browser, but it needs to be there).

---

## Step 7 — Test the monitor manually

1. On GitHub, go to your repo → click the **Actions** tab.
2. In the left sidebar, click **Monitor Official Sources**.
3. Click the **Run workflow** dropdown (right side) → **Run workflow**
   button.
4. Wait a few seconds, then click on the run that appears (it'll have
   a small orange dot while running, then a green check or red X when
   done).
5. Click into the run, then click the job named **monitor** to see the
   log output.

**Success looks like:** the log shows lines like "Checking ICAI...",
"Checking ICSI...", and so on for all five institutes, ending with
"Monitoring run complete." A red X instead means something failed —
the log text will say what (most commonly: the secret name was typed
wrong, or a site was briefly unreachable, which is expected sometimes
and not a bug).

---

## What happens automatically after this

Once all seven steps above are done, `.github/workflows/monitor.yml`
runs by itself every 4 hours — you don't need to trigger it again
unless you want to test something.

## If something doesn't match this guide

Send a screenshot of what you're seeing and which step you're on.
Don't guess and click around — Firebase's own screens change their
layout occasionally, and a wrong click in the Rules or Secrets screens
specifically can expose data that should stay private.

---

## Reference: what's genuinely free here, and why

- **Firebase Auth, Firestore** — Spark (free) plan, no card required
- **Firebase Cloud Messaging** — always free, on any plan
- **GitHub Actions** — unlimited minutes on a public repository
- **GitHub Pages** — free, unchanged, still hosting the site exactly as before

**Deliberately not used:** Firebase Cloud Functions — this requires
the Blaze plan and a linked credit card even if your actual usage
stays at $0. All server-side logic runs in GitHub Actions instead,
which needs no card at all.

## Known limitations (real ones, not hidden)

- Email notifications aren't wired up yet — only browser/device push
  notifications work right now.
- The automatic checker looks for keywords in a page's text to guess
  which category an update belongs to (e.g. "admit card" → Admit
  Cards). This works well in most cases but isn't perfect.
- ICAI's results portal (`icai.nic.in`) is monitored as a second,
  separate source now — but one source from May 2026 referenced a
  different subdomain (`caresults.icai.org`) instead. Worth
  double-checking which one ICAI is actually using if ICAI results
  notifications ever seem to stop arriving.
