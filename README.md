# طبيّة | The Easiest in Dentistry

A real, working Arabic (RTL) educational PWA for second-stage (المرحلة
الثانية) dentistry students: a lecture library split into **محاضرات
(video lectures)** and **قسم الملازم (PDF handouts)**, a daily-interaction
streak tracker, QR attendance, a real profile editor (photo + password),
a live "registered students" counter, and a separate **teacher dashboard**
for publishing content — plus a one-time welcome screen with the app's
doors-themed logo.

Built with **vanilla HTML/CSS/JS + Firebase** (Auth + Firestore + Storage)
— no build step, no framework, free to host on Vercel/Netlify/GitHub
Pages/Firebase Hosting.

> A parallel Supabase implementation (`sql/schema.sql`) is also included
> in case you ever want to switch backends — but the app currently runs
> on Firebase, wired in `js/firebase-client.js`.

## 1. File structure
```
dentistry-app/
├── index.html                 # login / register + live student counter
├── app.html                    # student app: lectures, ملازم, profile, contact, settings
├── teacher.html                 # teacher dashboard: publish lectures & ملازم
├── manifest.json               # PWA manifest
├── sw.js                        # offline shell caching
├── css/style.css                # design system: cards, modals, tabs, teacher UI
├── js/
│   ├── firebase-client.js          # Firebase config + Auth/Api (roles, uploads, counter)
│   ├── supabase-client.js          # alternate Supabase version (unused unless you switch back)
│   ├── i18n.js                       # AR/EN dictionary + language toggle
│   ├── auth-page.js                  # login/register page logic + counter animation
│   ├── app.js                         # student app: nav, drawer, profile modal, ملازم tabs
│   └── teacher.js                     # teacher dashboard: upload + manage content
├── sql/schema.sql              # Postgres schema (only needed if using Supabase)
├── firestore-rules/
│   ├── firestore.rules            # Firestore security rules (roles, ملازم, counter)
│   └── storage.rules               # Storage rules (avatar + ملازم/lecture files)
├── seed-firestore.js            # seeds real 2nd-stage subjects + counter doc
└── assets/                      # PWA icons
```

## 2. Firebase setup (project `ppo32-dbe59`, already configured)
1. **Authentication → Sign-in method**: enable Email/Password, Google,
   Apple (needs an Apple Developer Services ID), and Phone (used for the
   WhatsApp-style button — Firebase only sends SMS, there's no native
   WhatsApp OTP channel).
2. **Firestore Database → Create database** (production mode), then open
   **Rules** and paste in `firestore-rules/firestore.rules` → Publish.
   This is what enforces, server-side:
   - every new profile is `role:"student"` and can never self-promote
   - only a `role:"teacher"` profile can create/delete lectures & ملازم
   - `meta/stats` (the registered-students counter) is publicly readable
     but only writable by a signed-in user's own account creation
3. **Storage → Get started**, then open **Rules** and paste in
   `firestore-rules/storage.rules` → Publish. This is what lets students
   upload their own avatar, and only teachers upload lecture/ملزمة files.
4. Seed real content:
   ```bash
   npm install firebase-admin
   # Project Settings → Service Accounts → Generate new private key
   # save as serviceAccountKey.json next to seed-firestore.js
   node seed-firestore.js
   ```
   This adds the six second-stage subjects (رتّبها أو غيّرها متى ما
   حبيت) and initializes the public student counter at 0.
5. **Promote a teacher account** (there is no public "become a teacher"
   button on purpose): sign up normally through the app once with the
   instructor's email, then in the **Firestore console** open
   `profiles/{that user's uid}` and change the field `role` from
   `"student"` to `"teacher"`. That account now sees a "🎓 لوحة الاستاذ"
   entry in the drawer and can open `teacher.html` directly.

## 3. Run locally
```bash
npx serve dentistry-app
# or
python3 -m http.server --directory dentistry-app 8080
```

## 4. Deploy (Vercel / Netlify — both free)
- **Vercel**: `vercel deploy` from inside `dentistry-app/`.
- **Netlify**: drag-and-drop the folder into Netlify's dashboard, or
  `netlify deploy --dir=dentistry-app --prod`.
- Installable as a PWA on Android/desktop; "Add to Home Screen" on iOS.

## 5. What's wired to real, working data
- Login/register (email+password, Google, Apple, phone/SMS OTP)
- **Two real roles**: `student` (app.html) and `teacher` (teacher.html),
  enforced by both the UI and Firestore/Storage rules
- **قسم الملازم**: every subject page has two tabs — 🎬 المحاضرات and
  📑 قسم الملازم — each backed by real Firestore documents a teacher
  publishes from the dashboard (video URL/file, or a PDF URL/file)
- **Teacher dashboard**: pick a subject → publish a lecture or a ملزمة
  (paste a link, or upload a file straight to Firebase Storage with a
  live progress bar) → see everything already published, with delete
  buttons
- **Real profile editing**: upload an actual photo (replaces the
  initial-letter avatar everywhere in the app), rename yourself, and
  change your password with proper re-authentication — no more `prompt()`
- **One-time welcome screen**: shown right after a brand-new account's
  first login, with the doors logo and a short greeting, never shown
  again afterward
- **Live "registered students" counter** on the login screen, backed by
  a public `meta/stats.studentCount` doc bumped once per real signup
- Streak ring + تفاعل stat cards, lecture/ملازم view logging, saved
  items, sign out — all pulled live from Firestore as before

## 6. Notes on the design
The doors logo (two open door leaves revealing a tooth) replaces the
previous plain tooth mark — it's used consistently in the login screen,
the app top bar, the teacher dashboard, and the welcome overlay. The
palette stays the original deep navy `#14304A` + amber `#F4A340`. The
Instagram link in Contact → تابعنا points to the project's real account;
Telegram intentionally stays only there too, not on the dashboard.

Swap in your own PNG icons in `assets/` (used by the PWA manifest) any
time you want them to match the new logo exactly.

## 7. Next steps you'll likely want
- Real QR generation/scanning (`qrcode` / `jsQR` JS libraries)
- Push notifications (Web Push + a Cloud Function)
- Per-subject "المحاضر" attribution field if more than one teacher
  publishes for the same subject
- A proper admin UI for renaming/reordering/adding subjects (currently
  done via `seed-firestore.js` or directly in the Firestore console)
