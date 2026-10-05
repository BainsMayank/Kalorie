# Releasing Kalorie — step by step

Everything left between "the code is done" and "Kalorie is on the Play Store", in the order to
do it. Tick the boxes as you go. Written 2026-10-05; store menus get renamed now and then, so if
a button isn't exactly where this says, look for the nearest match.

Steps marked **🤖** are ones Claude can do for you in a session — just ask.

**How long it takes:** about a week of setup, then a **14-day closed test** that Google
requires, then about a week of Google review. Plan for roughly 4–5 weeks to the public listing.

| Phase | What | Time |
|---|---|---|
| 1 | Contact email | ✅ done |
| 2 | Web pages live (GitHub Pages) | 10 min |
| 3 | Permission emails | 15 min, then wait |
| 4 | Supabase: database + sign-in emails | 45 min |
| 5 | Name check | ✅ done |
| 6 | Small app changes before the first build | ✅ done |
| 7 | EAS: build an installable app | 1 hour |
| 8 | Checks on a real phone | an afternoon |
| 9 | Play Console account | 30 min, then 1–3 days of verification |
| 10 | Play Console: forms and store listing | 2 hours |
| 11 | Internal testing (family, straight away) | 30 min |
| 12 | Closed test: 12 testers × 14 days | 2 weeks |
| 13 | Apply for production, go public | ~1 week of review |
| 14 | iOS (optional, any time later) | — |

---

## Phase 1 — A contact email ✅ (done 2026-10-05)

Kalorie's contact address is **mynklabs@icloud.com**. The stores show it **publicly** on the
listing; it is already filled in on the privacy and account-deletion pages, in `app.json`
(`extra.contactEmail`, sent to Open Food Facts with barcode lookups, as their rules ask) and in
both permission emails. Phase 4 also uses it to send the sign-in codes.

## Phase 2 — Put the privacy pages online (10 min)

- [ ] On github.com, open **BainsMayank/Kalorie → Settings → Pages**.
- [ ] *Build and deployment* → Source: **Deploy from a branch** → Branch: **main**, folder
  **/docs** → **Save**.
- [ ] Wait 1–2 minutes, then open these and check they load:
  - https://bainsmayank.github.io/Kalorie/privacy.html
  - https://bainsmayank.github.io/Kalorie/delete-account.html
- [ ] Note both links; Phases 3 and 10 need them.

## Phase 3 — Send the two permission emails (15 min, then wait)

The drafts are in `data/permission-requests.md`.

- [ ] Replace `[link to privacy page]` with the privacy link from Phase 2.
- [ ] Send **email 1** to **nin@nic.in** (ICMR-NIN: IFCT 2017 + the 2020 targets).
- [ ] Send **email 2** through the contact form on **anuvaad.org.in** (INDB).
- [ ] Write the date sent in the table at the top of that file.
- [ ] No reply in 3 weeks: send a short, polite follow-up.
- [ ] When replies come, save them (PDF) next to the file and note them in the table.

You don't have to wait for the replies to do Phases 4–12 — only the **public** listing
(Phase 13) waits for them. If either says no, stop and ask Claude what to change before going
public.

## Phase 4 — Supabase: database and sign-in emails (45 min)

Right now only you can receive sign-in codes. This makes sign-in work for everyone.

### 4a. Create the tables (10 min)

Supabase dashboard (supabase.com/dashboard) → your Kalorie project → **SQL Editor**.
For each file, in this order: **New query** → paste the whole file → **Run**.

- [ ] `supabase/migrations/20260928100000_user_data.sql`
- [ ] `supabase/migrations/20260928100100_delete_account.sql`
- [ ] `supabase/migrations/20260928110000_groups.sql`

Each should say **"Success. No rows returned"**. If one says something "already exists", that
file was run before — skip it and go on.

- [ ] **New query** → paste all of `supabase/tests/rls.test.sql` → **Run**. You should get one
  row starting with **PASS**. (It changes nothing.) If it says `FAIL: …`, copy the message to
  Claude.

### 4b. Put the code in the sign-in email (5 min)

The app asks for a code, so the email must contain one, not only a link.

- [ ] **Authentication → Emails → Templates → Magic Link.** Set:
  - Subject: `Your Kalorie sign-in code`
  - Body (replace everything):
    ```html
    <h2>Your Kalorie code</h2>
    <p>Type this code in the app to sign in:</p>
    <p style="font-size:28px;font-weight:bold;letter-spacing:4px">{{ .Token }}</p>
    <p>If you didn't ask for it, you can ignore this email.</p>
    ```
  - **Save**.
- [ ] Do the same for the **Confirm signup** template (a first sign-in uses this one).

### 4c. Send emails through iCloud Mail (15 min)

Supabase's own mailer only sends to your project team, a few an hour. iCloud Mail can send them
from mynklabs@icloud.com instead (Apple allows about 1,000 emails a day — plenty for family and
friends).

- [ ] Make an **app-specific password**: go to **account.apple.com** → sign in with the Apple ID
  that owns mynklabs@icloud.com → **Sign-In and Security → App-Specific Passwords** → **+** →
  name it "Supabase" → copy the password (shown once). Two-factor authentication must be on.
- [ ] Supabase → **Authentication → Emails → SMTP Settings** → turn on **Enable custom SMTP**:
  - Sender email: `mynklabs@icloud.com`
  - Sender name: `Kalorie`
  - Host: `smtp.mail.me.com` · Port: `587`
  - Username: the Apple ID's **main iCloud email address** — that's `mynklabs@icloud.com` if it
    is the account's own address; if mynklabs is an *alias* on another iCloud account, use that
    account's main @icloud.com address here (the sender email stays mynklabs@icloud.com)
  - Password: the app-specific password
  - **Save**.
- [ ] **Authentication → Rate Limits** → *Rate limit for sending emails*: set it to about
  **100 per hour** → Save.

If test codes never arrive (step 4d), check the Supabase **Logs → Auth** page for an SMTP error
and give it to Claude.

### 4d. Try it (10 min)

- [ ] On your phone: Profile → Account → sign in with a **different** email (not a team member).
  The code should arrive within a minute (check spam the first time).
- [ ] Sign out — your log is still there. Sign in again → **Delete my account and data** →
  the person disappears from Supabase → Authentication → Users.
- [ ] Profile → My group → start a group; on a second phone, join with the code; share a food.

**Good to know:** a free Supabase project **pauses after 7 days with no activity**. Once people
use it daily that won't happen; if sign-in suddenly stops working, open the dashboard and press
**Restore project**.

## Phase 5 — Check the name ✅ (checked 2026-10-05)

- **Play Store** (India and US): no app called "Kalorie".
- **App Store**: several apps already use the word — *Kalorie - AI Nutrition Tracker*,
  *Kalorie · AI Food Scan*, *KalorieAI*, and *Kalorie: Food Tracker* (which also says "no ads,
  data stays on your device") — plus near names (Kalory, Kalorio, Kalori, Kalories). Apple
  needs a unique listing name, so add a descriptor there too.
- **Trademarks**: a 2021 US filing for "KALORIE" covers blockchain tokens, not food or health
  apps; its status couldn't be read (the page has a bot check). The Indian register
  (ipindia.gov.in → Trade Marks → Public Search, class 9) needs a captcha, so it wasn't
  checked — worth a 5-minute look yourself.
- "Kalorie" is close to the ordinary word *calorie* (it *is* the word in German), so others
  can't easily stop you using it — and you couldn't stop others either.
- **Decision:** keep **Kalorie** as the app's name on the phone; on the stores use a
  descriptive listing name, e.g. **"Kalorie – Indian Food Tracker"** (29 characters; Play's
  limit is 30). That also helps people find it, since a search for "Kalorie" is full of big
  calorie apps.

## Phase 6 — Small app changes before the first build ✅ (done 2026-10-05)

- [x] **"Not medical advice" note** on the About screen and on the first onboarding step (both
  stores look for this in diet apps).
- [x] **`eas.json`** with a *preview* profile (an installable APK for phones) and a *production*
  profile (the `.aab` file the Play Store wants). Build numbers are kept by EAS and go up by
  one on every production build, so you never have to change them by hand.
- [x] **`app.json` for iOS:** `supportsTablet: false` (otherwise Apple demands iPad screenshots)
  and `ITSAppUsesNonExemptEncryption: false` (skips an export question on every upload).
- [x] **Store graphics:** `store/icon-512.png` and `store/feature-graphic.png` (1024×500), drawn
  by `scripts/app-icon/make_icons.py`.
- [x] **Store listing text:** `store/listing.md` — short and full description in English and
  Hindi, ready to paste.
- [x] **Contrast check** of the colour tokens: `src/theme/colors.test.ts` checks every text and
  accent colour against WCAG AA; four shades were darkened or lightened to pass.
- [x] `npx tsc --noEmit` and `npm test` pass; committed and pushed.

## Phase 7 — EAS: build an app you can install (1 hour)

EAS is Expo's build service. It builds the real app in the cloud, so you don't need Android
Studio. The free plan gives a limited number of builds a month; builds may wait in a queue.

### 7a. Account and project (10 min) ✅ (done 2026-10-05)

- [x] Make a free account at **expo.dev**.
- [x] In the project folder:
  ```bash
  npx eas-cli@latest login
  ```
  ```bash
  npx eas-cli@latest init
  ```
  `init` creates the project on expo.dev and adds its id to `app.json` (commit that change).
  *Done: the id is in `app.json` → `extra.eas.projectId`.*

### 7b. Give the build your Supabase keys (10 min)

Your `.env` file is **not** sent to EAS (it's git-ignored, on purpose). Without this step the
built app has no sign-in.

- [ ] expo.dev → your Kalorie project → **Environment variables** → **Add variable**, twice:
  - `EXPO_PUBLIC_SUPABASE_URL` = the URL from your `.env`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY` = the key from your `.env`
  - For both: tick **preview** and **production**; visibility *Plain text* is fine (these two
    are meant to be public — the secret key must never go here).

### 7c. A test build for phones (30 min, mostly waiting)

```bash
npx eas-cli@latest build --platform android --profile preview
```

- [ ] Accept "Generate a new Android Keystore" (EAS keeps it safe for you).
- [ ] When it finishes, it shows a link and a QR code. Open it on an Android phone → download →
  install (allow "install unknown apps" when asked).
- [ ] Check: the new icon on the home screen, sign-in works (proves 7b worked), search, logging.

## Phase 8 — Checks on a real phone (an afternoon)

Use the **preview build** from Phase 7, not Expo Go — Expo Go is slower and isn't what people
will get. Use the cheapest Android phone in the family for the speed checks. Write down anything
odd and give the list to Claude.

- [ ] **Offline:** turn on airplane mode, then open every tab and screen: search, log, edit,
  delete, Trends, Goals, scan a barcode, Account, My group. Nothing may crash; messages should
  be friendly.
- [ ] **Speed:** typing in search feels instant; Today opens in about a second after the app
  starts.
- [ ] **TalkBack:** Settings → Accessibility → TalkBack on. Log a meal using only TalkBack.
  Every button should say what it does. (Triple-press volume keys or the shortcut to turn it
  off again.)
- [ ] **Big text:** Settings → Display → Font size at the largest. No text cut off or overlapping.
- [ ] **Dark mode** and **Hindi** (Profile → Language): look at every screen once.
- [ ] **Hide numbers** on: walk through Today, Log, Trends, the food screen.
- [ ] Final read of the wording (the last Stage 12 item).

## Phase 9 — Google Play Console account (30 min + 1–3 days waiting)

- [ ] Go to **play.google.com/console/signup** with the Google account you want to own the app
  (your own is fine).
- [ ] Choose **Yourself** (personal account), not an organisation.
- [ ] Pay the **US $25** one-time fee.
- [ ] Verify your identity with a government ID (Aadhaar, PAN or passport), and your phone and
  email. Your name is shown on the listing as the developer; your home address isn't shown,
  because the app has no payments.
- [ ] When asked, install the **Play Console** app on your Android phone and verify the device.
- [ ] Wait for the "identity verified" email (usually 1–3 days).

## Phase 10 — Play Console: create the app, forms and listing (2 hours)

### 10a. Create the app

- [ ] **Create app** → Name: **Kalorie** · Default language: **English (India) – en-IN** ·
  **App** · **Free** → tick the declarations → **Create app**.

Free can never be changed to paid later — that's fine for Kalorie.

### 10b. "Set up your app" — App content forms

Dashboard → *Set up your app* lists these. Answers for Kalorie:

- [ ] **Privacy policy:** the privacy link from Phase 2.
- [ ] **App access:** *All or some functionality is restricted* → add instructions:
  "Sign-in is optional. To test groups, sign in with any email address — a 6-digit code is
  emailed to it." (No password needed.)
- [ ] **Ads:** **No, my app does not contain ads.**
- [ ] **Content rating:** start the questionnaire → your email → category *All other app types*
  → answer honestly: no violence, no sexual content, no gambling…; *Does the app let users
  interact or share content?* → **Yes** (groups share foods and names). Submit.
- [ ] **Target audience:** **13–15, 16–17 and 18+** (not under 13). "Could the store listing
  unintentionally appeal to children?" → **No**.
- [ ] **News app:** No. **Government app:** No. **Financial features:** none.
- [ ] **Health apps:** declare it as a health app → pick the **nutrition / diet / weight
  management** option. It is **not** a medical device.
- [ ] **Data safety** (the most important form — it must match the privacy page):
  - Does your app collect or share user data? **Yes**
  - Is all data encrypted in transit? **Yes**
  - Account creation: **Email (one-time code)**, and accounts are **optional**
  - Account deletion URL: the delete-account link from Phase 2
  - Data types — tick only these:
    - **Personal info → Email address:** *Collected* (not shared) · purpose **Account
      management** and **App functionality** · users **can choose** (sign-in is optional).
    - **App activity → Other user-generated content** (foods shared with a group): *Collected*
      · purpose **App functionality** · users **can choose**.
  - Everything else — food log, weight, goals, photos, location, contacts — is **not collected**:
    it stays on the phone, and data handled only on the device doesn't count. Barcode numbers
    sent to Open Food Facts aren't about the person, so they don't count either.
  - Preview, then **Submit**.

### 10c. Store listing (Grow users → Store presence → Main store listing)

- [ ] **App name:** Kalorie – Indian Food Tracker (see Phase 5)
- [ ] **Short description** and **Full description:** copy them from `store/listing.md`.
  For Hindi: *Manage translations → Add your own translations → Hindi*, then paste the Hindi
  blocks from the same file.
- [ ] **App icon:** upload `store/icon-512.png`.
- [ ] **Feature graphic:** upload `store/feature-graphic.png`.
- [ ] **Phone screenshots:** at least 2, best 4–6. On the preview build, set up a nice day
  (a few logged meals) and take screenshots of Today, Log, a food screen, Trends. Use light
  mode for most.
- [ ] **Category:** Health & Fitness. **Tags:** calorie counter, nutrition, diet.
- [ ] **Contact details:** mynklabs@icloud.com; website:
  `https://bainsmayank.github.io/Kalorie/`.
- [ ] **Save**.

## Phase 11 — Internal testing: family gets it now (30 min)

Up to 100 people, usually live within minutes. Doesn't count toward the 14-day test, but it's
the quickest way to get family using the real app.

- [ ] Build the store version:
  ```bash
  npx eas-cli@latest build --platform android --profile production
  ```
  When done, download the **.aab** file from the link.
- [ ] Play Console → **Test and release → Testing → Internal testing** → **Testers** tab →
  create an email list ("Family") with the Gmail addresses of your testers → Save.
- [ ] **Create new release** → accept **Play App Signing** (Google keeps the release key) →
  upload the `.aab` → keep the release name Play fills in (like `1.0.0 (1)`) → release notes "First test version" →
  **Next** → **Save and publish**.

  The **first upload must be done by hand** like this; later ones can use
  `npx eas-cli@latest submit` (🤖 Claude can set that up).
- [ ] **Testers** tab → copy the **opt-in link** → send it to family. They open it on their
  phone, tap *Become a tester*, then install from the Play Store link.

## Phase 12 — Closed test: 12 testers for 14 days (2 weeks)

Google's rule for new personal accounts: before you can publish publicly, **at least 12
testers must be opted in to a closed test for 14 days in a row**. Plan for 15–20 people, since
some forget to opt in or drop out.

- [ ] Collect 15–20 Gmail addresses of family and friends with Android phones.
- [ ] Play Console → **Testing → Closed testing** → **Create track** (or use *Alpha*) →
  **Testers**: add an email list with those addresses → Save.
- [ ] **Create new release** → *Add from library* → pick the `.aab` already uploaded →
  **Save and publish**. A closed track is reviewed by Google first (a few hours to a few days).
- [ ] When it's approved, send the closed-test **opt-in link** to everyone. Ask them to:
  1. open it on their Android phone and tap **Become a tester**,
  2. install Kalorie from the Play Store,
  3. **stay opted in** and use it for two weeks (logging a few meals a day is perfect),
  4. tell you anything odd.
- [ ] Check the count on the closed-testing page now and then: it needs **12 or more** opted in.
- [ ] Fix what they report (🤖), build again with the production profile, upload to the closed
  track. New versions don't restart the 14 days.
- [ ] Meanwhile: watch for the permission replies (Phase 3).

## Phase 13 — Apply for production and go public (~1 week)

Do this only when **both** are true:
- the 14 days with 12+ testers are done, and
- ICMR-NIN and Anuvaad have said yes (Phase 3). If either said no or hasn't replied, ask Claude
  before going further.

- [ ] Dashboard → **Apply for production**. Google asks about your test: how many testers, what
  they said, what you changed. Answer in plain words (e.g. "18 family members logged meals
  daily for two weeks; we fixed X and Y"). Review takes up to about 7 days.
- [ ] When approved: **Production → Create new release** → *Add from library* (the latest
  `.aab`) → **Countries/regions: India** (add more any time) → release notes.
- [ ] Choose a **staged rollout** at **20%** for the first few days, then raise it to 100%
  if there are no crashes (Play Console → *Android vitals* shows crashes).
- [ ] 🎉 Share the Play Store link.
- [ ] Update `PLAN.md`: tick Stage 12, add a Stage log line.

## Phase 14 — iOS (optional, any time later)

Costs **US $99 a year**. Everything above still applies; these are the Apple-specific parts.

- [ ] Join the **Apple Developer Program** (developer.apple.com/programs) as an **Individual**,
  with an Apple ID that has two-factor authentication on. Approval takes 1–2 days.
- [ ] Build and upload (EAS makes the certificates for you):
  ```bash
  npx eas-cli@latest build --platform ios --profile production
  ```
  ```bash
  npx eas-cli@latest submit --platform ios
  ```
  `submit` creates the app in **App Store Connect** the first time.
- [ ] **TestFlight** → add family as internal testers (up to 100, no review needed). They
  install the TestFlight app and get Kalorie from there.
- [ ] App Store Connect → **App Privacy** labels — same answers as Play's Data safety:
  - Contact Info → **Email address**: linked to the person, used for app functionality, **not**
    used for tracking.
  - User Content → **Other user content** (group foods): same.
  - Everything else: not collected.
- [ ] **Age rating** questionnaire; **category** Health & Fitness; privacy policy URL.
- [ ] Screenshots for the **6.9-inch iPhone** (1320×2868) — take them on a big iPhone or the
  simulator.
- [ ] **Review notes:** "Sign-in is optional; sign in with any email to receive a one-time
  code. Account deletion: Profile → Account → Delete my account and data."
- [ ] **Submit for review** (usually 1–2 days). Apple has no 14-day rule.
