# Trackly — Going Live (Free Setup)

Everything in this repo is real, working code. Nothing is running yet —
these are the one-time steps to turn it on, entirely on free tiers,
no credit card required for any of them.

## 1. Create a Firebase project
1. https://console.firebase.google.com → Add project → name it anything → skip Google Analytics (not needed).
2. Stay on the **Spark (free) plan**. Nothing in this project needs Blaze.

## 2. Register a Web App
1. Project settings (gear icon) → General → "Your apps" → Web (`</>`) icon.
2. Copy the `firebaseConfig` object shown.
3. Paste those values into **`js/firebase-config.js`** (replace every `REPLACE_WITH_...` placeholder) **and** into **`firebase-messaging-sw.js`** (same values, duplicated — service workers can't import other files).

## 3. Enable Authentication
1. Build → Authentication → Get started.
2. Sign-in method tab → enable **Google** and **Email/Password**.
3. For Google sign-in, add your GitHub Pages URL to Authorized domains: `templeguidegujarat01.github.io`.

## 4. Create the Firestore database
1. Build → Firestore Database → Create database → **Production mode** → pick any region.
2. Rules tab → paste the contents of **`firestore.rules`** from this repo → Publish.

## 5. Enable Cloud Messaging (push notifications)
1. Project settings → Cloud Messaging tab.
2. Under "Web configuration", click **Generate key pair** — this is your VAPID key.
3. Paste it into `VAPID_KEY` in **`js/firebase-config.js`**.

## 6. Create a service account for the monitoring Action
1. Project settings → Service accounts → **Generate new private key** → downloads a JSON file.
2. Open that file, copy its entire contents.
3. In your GitHub repo: Settings → Secrets and variables → Actions → New repository secret.
   - Name: `FIREBASE_SERVICE_ACCOUNT`
   - Value: paste the entire JSON file contents.
4. **Never commit this file to the repo.** The secret is the only place it should live.

## 7. Push everything
Commit and push all these files to your GitHub repo (`templeguidegujarat01/trackly`), with GitHub Pages already serving the `main` branch (or whichever you use).

## 8. Turn on the scheduler
The workflow at `.github/workflows/monitor.yml` starts running automatically once it's on the default branch — every 4 hours, checking all 5 institutes. You can also trigger it manually: repo → Actions tab → "Monitor Official Sources" → Run workflow, to test it immediately instead of waiting.

## 9. (Optional) Email notifications
`scripts/monitor.mjs` currently sends push notifications only. Email requires
picking a transactional email API (e.g. Resend, Brevo) — verify their current
free-tier signup doesn't require a card before choosing one, since that can
change. Not wired up yet; push notifications are fully functional without it.

---

## What's genuinely free, forever, at this scale
- **Firebase Auth** — Spark plan, no card, generous free quota for this traffic
- **Firestore** — Spark plan, no card, 50K reads / 20K writes per day free
- **Cloud Messaging (FCM)** — always free, on any plan
- **GitHub Actions** — unlimited minutes on a public repo
- **GitHub Pages** — free, unchanged, still hosting the frontend exactly as before

**Deliberately not used:** Firebase Cloud Functions — requires the Blaze plan
and a linked credit card even at $0 usage, which conflicts with the
free-forever requirement. All server-side logic runs in GitHub Actions instead.
