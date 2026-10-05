# Kalorie — Product & Technical Spec

Kalorie is a free, ad-free calorie and nutrition tracker for Android and iOS, built for
one person, their family and friends in India. It must be **simple, fast to log, and
never feel like a chore**.

- App name: **Kalorie** (same everywhere, Latin script)
- App ID (Android package + iOS bundle ID): **`com.mynklabs.kalorie`** — permanent
- Users: **one adult (18+) per phone**. No profile switcher.
- Language: **English and Hindi** (Devanagari) UI since Stage 10b — the phone's language, or
  one picked in Profile → Language. Every string goes through i18next (`en.json`, `hi.json`, same
  keys). Search understands **Hindi food names typed in Roman letters** (daal, bhindi, dahi);
  food names and unit words come from the food data, so they stay English.
- Platforms: Expo SDK default minimums (about Android 7+, iOS 15.1+).
- Theme: follows the phone's light/dark setting, with a manual override.

---

## 1. Decisions log (from the interview, 2026-09-26)

| Topic | Decision |
|---|---|
| Profiles | One person per phone |
| Age | 18+ gets targets. Under 18: logging only, friendly note, no calorie target |
| Units | Per-food gram weights, fallback to default unit volumes × density |
| Katori | Fixed 150 ml |
| Roti | Small / medium / large = 25 / 35 / 50 g |
| Duplicates across sources | Merge; priority INDB → IFCT 2017 → USDA; show source tag |
| USDA in search | Yes, ranked below Indian foods |
| Synonyms | Hand-curated `data/curated/synonyms.csv` + typo-tolerant matching |
| Hindi | Roman-letter Hindi names in search; **Hindi UI added in Stage 10b** (was: no Hindi UI) |
| Default slots | Breakfast, Lunch, Snacks, Dinner (+ custom) |
| Day boundary | 4:00 am — earlier entries belong to the previous day |
| Auto slot | By editable time window |
| Goals | Lose / Maintain / Gain with pace, or Just track |
| Safe floor | 1200 kcal (female / not stated), 1500 kcal (male), and never below BMR — warn, never block |
| Macro split | 55% carb / 15% protein / 30% fat; protein ≥ 0.83 g/kg |
| Measurements | kg + cm; height can be entered in ft/in (stored as cm) |
| Sex input | Male / Female / Prefer not to say |
| Limits | ICMR-NIN / WHO defaults (see §6) |
| Alerts | Soft note at 100%, on Today only |
| Sugar | Total sugar ≤ 10% of kcal |
| Calendar | On track = within ±10% of calorie target |
| Streak | ≥ 1 entry keeps the day; 2 free days per Mon–Sun week |
| Photo-now-log-later | **Dropped** |
| Water | 250 ml glass, 2000 ml goal (both editable) |
| Weight trend | Exponential moving average, 10% |
| Reminders | All off; switched on on onboarding's last step or in Profile → Reminders (Stage 10a) |
| Image picker | Used to scan a barcode from a gallery photo |
| Offline barcode | Queue and look up when online |
| OFF contribute | Optional button, Stage 12, login kept in expo-secure-store |
| Oil adjuster | Scale the recipe's oil/ghee grams (0.5× / 1× / 1.5×) |
| Thalis | ~6 built-in starters + user-saved |
| Micros reference | ICMR-NIN 2020 RDA, with TUL note |
| Incomplete marker | > 20% of the day's grams lack a value |
| Hide numbers | Hides kcal, grams, %, weight; keeps shapes and words (Stage 10b, §8.3) |
| CSV export | Entries, daily totals, weight, water (4 files, one share at a time, Stage 10b, §5.14) |
| Extra libraries approved | expo-file-system, expo-sharing, expo-asset, expo-haptics, expo-secure-store (used from Stage 11a for the sign-in session), @supabase/supabase-js (Stage 11a); dev-only: xlsx, csv-parse, tsx, drizzle-kit (better-sqlite3 not needed — see Stage 2 row) |
| Colours | Monochrome base; accent colours only where they carry meaning; no red for "over" |
| Undo | 5-second Undo bar + soft delete kept 30 days |
| Sync (Stage 11) | Email one-time code (11a); user.db tables mirrored in Supabase Postgres and synced row by row (11b, replaces the JSON-file backup); shared foods pool via invite code (11c) |
| Food data build (Stage 2) | Node's built-in `node:sqlite` (has FTS5) instead of better-sqlite3 · IFCT from `@ifct2017/compositions` **2.0.9** (MIT, pinned) because `ifct2017` ≥ 2.1 is AGPL-3.0 · `xlsx` 0.20.3 from the SheetJS CDN (the npm copy is outdated) · foods get a Roman Hindi `name_hi` and 4 completeness flags |
| Tabs (changed in Stage 1) | Today · Log · Trends · Profile. Log = timeline + calendar (was History); Profile = settings and account (was More) |
| Search ranking (Stage 2b, 2026-09-27) | Match tiers refined (§5.1 step 4) and hand-picked **search pins** added for staples the data can't rank on its own (plain curd exists only in USDA). In Stage 2b the Log tab showed food search + a food detail screen (`app/food/[id].tsx`) so search could be tried on the phone; since Stage 3a search lives in Add food |
| Core logging (Stage 3a, 2026-09-27) | `log_entries` gains an optional `note`; no `photo_uri`/`status` (photo-now-log-later is removed from the plan) · built-in `meal_slots.name` is NULL so the name comes from en.json · the Log tab shows the day's timeline and the food search moved to an *Add food* screen (`app/add/index.tsx`, a pushed screen until the full modal) · swipe-to-delete built on React Native's PanResponder and the time picker is an hour grid + quarter hours, so no gesture or date-time-picker library is needed · *Pick a date* uses react-native-calendars · entries go to the day chosen in the Log tab |
| Fast logging (Stage 3b, 2026-09-27) | Add food: one line of slot chips, **no search autofocus** (the keyboard hid the one-tap suggestions), *Often at {slot}* suggestions on top then Recent · Favourites tabs, each row with ☆ and a one-tap ⊕ · usual amount = most common qty + unit for that food in that slot (last 30 days); recents use the last amount; favourites their usual amount or the food's own portion · copy keeps the time of day when the slot stays the same, else the target slot's start time · Undo removes an undone log/copy for good (no *Recently deleted* clutter) and restores an undone delete · the Undo bar is drawn inside each screen (Log tab, Add food): on iOS a bar outside the native screens can't receive taps · quick add without a label is stored with an empty name and shown as "Quick add" · `favourites` rows are removed when un-starred · expo-haptics added (approved list) for the logged tick |
| Today screen (Stage 4, 2026-09-27) | Today and Log show the **same day** (the log store's `day`), so *+ Add* always goes to the day on screen; ‹ › step a day, › stops at today, tapping the day's name opens the calendar · until goals existed (Stage 5) the targets came from a placeholder file (2000 kcal · 60 g protein · 250 g carbs · 65 g fat), shown with a "sample targets" line — removed in Stage 5 · the ring fills in the neutral text colour on a grey track; above target a thin soft-blue (`offTarget`) outer arc grows up to one more full circle · macro pie = share of calories from macros (4/4/9 kcal per g); bars stop at full, the grams say the rest · **Top contributors** is a card on Today (all three macros), not a sheet: the same food logged more than once counts once and tapping it opens its biggest entry; each quick add is its own item · a meal card's time is when its first item was eaten · pull to refresh reads the slots and the day again · react-native-svg added (required by react-native-gifted-charts); `PieChart` is imported from `react-native-gifted-charts/dist/PieChart` because the package's main file also loads charts that need a gradient library |
| Barcode (Stage 6, 2026-09-28) | *Scan barcode* on the **Log tab** and in Add food's buttons row → `app/scan.tsx` (camera with frame + light, *Type the number*, *Pick from gallery* on **Android only**: expo-camera 57's `scanFromURLAsync` on iOS uses Apple's QR-only detector) · EAN-13, EAN-8, UPC-A, UPC-E, every code checked by its **check digit** (`src/lib/barcode.ts`); one stored spelling per packet: UPC-A gets a leading 0 (= its EAN-13), UPC-E is written out in full first · lookup: `custom_foods` first, then Open Food Facts API v2 with `User-Agent: Kalorie/<version> (<app.json extra.contactEmail>)`, 10 s timeout; no answer, a network error or a 5xx = offline → `barcode_queue` · products are **`custom_foods` kind `product`** (not a separate `custom_products` table), with `custom_food_units` rows *serving* / *pack* / *ml* (drinks) so the normal portion chips and Add sheet work; pack is left out when it equals the serving · a found product with no usable numbers (no energy, > 950 kcal/100 g, or macros > 105 g/100 g) goes to the label form with its name filled in · **incomplete data**: a food whose minerals or vitamins are < 80% known shows an *Incomplete data* tag and note on the food screen (worked out from NULLs, not stored) · label form: per 100 g / 100 ml / one serving, kcal required, carbs stored as labelled, optional photo of the label (camera or gallery, copied into the app's `labels/` folder, `custom_foods.label_photo_uri`) · the queue is retried on app open, whenever the app comes back to the front, on pull to refresh and with *Try again now* — **no network-state library** (not in the stack), so "when connectivity returns" means the next of those · a scanned product joins Recent / Favourites / suggestions and the Today totals (food lookups read foods.db and user.db, `src/features/foods/loadFoods.ts`); searching products by name waits for My foods (Stage 7) · About screen (`app/about.tsx`, Profile → About & data sources) credits INDB, IFCT, USDA, Open Food Facts ("Food data from Open Food Facts (ODbL)") and ICMR-NIN · expo-camera + expo-image-picker added (in the stack) |
| Recipes, oil, thalis (Stage 7, 2026-09-28) | **Oil control uses the recipe's own fat**: foods.db already has `recipe_ingredients` for all 1,014 INDB dishes (921 oil/ghee rows, Stage 2a), so Less / More scales that dish's actual oil or ghee; the 5 g-per-150 g formula is only a fallback for `cooked_with_fat` foods without a recipe (none yet). It is applied as a **delta on the portion** (the same katori, with less or more oil in it), so only energy and the fats change — protein, carbs, fibre, minerals and vitamins stay (§5.5) · recipes: Profile → **Recipes** (list; swipe to delete with Undo; ⧉ duplicate) and *My foods* in Add food; builder `app/recipe.tsx` (`?id=` edit, `?copy=` duplicate), ingredient search `app/recipe-ingredient.tsx`; a recipe's units are *serving* (pot ÷ servings) and **katori only once the cooked weight is typed** (raw weight can't tell what a katori weighs) · editing a recipe updates the days it was already logged (totals are computed, never stored) · `recipe_items` keep each ingredient's per-100 g values (so the oil control and the recipe survive a deleted food) · recipes and products appear in search, ranked by the same match tiers, first on a tie, tagged **My recipe** / Product · thalis: **Save as thali** is an icon on each meal card next to Copy (a ⋯ menu would open one sheet from another, which iOS modals don't do reliably); quick adds are left out; **Add food → Thalis** tab opens a checklist (tick, − / + each amount, pick the meal) → *Log selected* = one batch, one Undo; a thali item keeps its oil level · the 6 built-in starter thalis came with the 2026-09-28 audit |
| Audit (2026-09-28) | Stage 1–7 loose ends closed: **search ranks personal use** (foods logged in the last 30 days first, most often first, §5.1) · **30-day purge** of soft-deleted rows at app start, keeping any recipe or product an entry, thali or recipe still uses (`src/db/user/purge.ts`) · **Recently deleted** on the Log tab for the day shown, with *Bring back* (§2.10) · the 6 **starter thalis** (`data/curated/thalis.csv`) and **slot starter foods** (`slot_suggestions.csv`) in foods.db, db_version 4 — a new user sees *Often at {slot}* from the first day, with the search hint above it until something is logged · tapping a food in Add food opens the food screen **with its Add to log sheet already up** (+ Add → tap → Log = 3 taps, §8.2) · an entry whose food no longer exists opens a small sheet that can still delete it · licences: INDB has no stated licence and IFCT's numbers are © ICMR-NIN whatever the npm package's licence — both added to the Stage 12 permission list (`data/SOURCES.md`); About cites the INDB paper and credits USDA ARS |
| History, weight, water (Stage 8, 2026-09-28) | **The history calendar lives on the Trends tab** (segment *Calendar · Week · Month*), not the Log tab: tapping a day opens a **read-only** copy of the Today layout for that date (`app/day/[day].tsx`) with *Edit*, which opens the Log tab on that day. The Log tab keeps its plain *Pick a date* calendar · **five calendar colours** (§5.6): on target (±10%) soft green, *a bit under or over* (10–25%) pale blue, *further from target* (> 25%) deeper blue, partly logged grey, not logged none — **today is judged only once it looks finished** (under target it shows as partly logged) · Trends averages count **logged days only**, and today only once it looks finished · weight: the SPEC's 10% EMA (§5.7) over every weigh-in, weekly change = trend change since the latest weigh-in ≥ 7 days earlier, scaled to a week ("−0.3 kg a week", "steady" under 0.05) · water: − and + on Today (long-press + for any ml), goal and glass size in **Goals** (not Profile), saved in `settings` · charts are drawn with **react-native-svg** (`src/components/charts/`): gifted-charts' bar chart needs a gradient library at load (`expo-linear-gradient`, not in the stack) and its line chart spaces points evenly, not by date |
| Micronutrients (Stage 9, 2026-09-28) | **Vitamins & minerals** (`app/nutrients.tsx`) opens from a card on Today, on a past day and in Trends Week / Month; periods *Day · 7-day average · 30-day average* (the SPEC's Week avg, plus the Trends month) · averages count **logged days only, today only once it looks finished** — the same days Trends averages (`periodStats`) · bars fill towards the ICMR-NIN need; fibre, sodium, sugar and saturated fat use the person's own target and limits from Goals (so the numbers match the limit card); MUFA, PUFA, trans fat and cholesterol show amounts only · **incomplete** = < 80% of the grams have data **or any quick add** that day: the amount gets "≈", the bar is drawn lighter and the line says "At least this · based on 2 of 3 foods" (foods counted once each; quick adds count as foods with no data); when no food eaten has the nutrient, "No data for the foods eaten" and no bar — never a 0% · magnesium's upper level is for supplements only, so food is never held against it · tap a nutrient → a sheet: amount vs need, which foods had no data, **top 3 foods it came from**, and **5 Good sources** · good sources come from a hand-picked list of ~80 everyday foods with everyday portions (`data/curated/common_foods.csv` → foods.db `common_foods`, db_version 5), ranked by the amount in one portion — ranking all of foods.db put a 480 g bowl of soup first for iron and a cake first for vitamin C; B12 and iodine sources come from USDA (INDB and IFCT have none) · **Profile → Food → I eat** (Everything · Vegetarian · Vegetarian + eggs, `settings.diet_preference`): vegetarian (or veg + egg) sources come first, others only fill the list · foods.db: vitamin A now uses ICMR-NIN's 6:1 (β-carotene) and 12:1 (α-carotene, β-cryptoxanthin); IFCT's fish vitamin B6 and biotin (1000× too big) are divided by 1000; IFCT's vitamin D in plant foods and INDB's vitamin D (built from it) are unknown (`data/SOURCES.md`) |
| Habits (Stage 10a, 2026-09-28) | **Streak**: a small line under the date on Today ("12 day streak · 2 free days left this week"), today only, nothing at all at 0 — no "Fresh start" line and no pop-ups; tap → a sheet that explains the 2 free days. A miss only counts once a logged day comes before it, so the misses that ended an old streak don't use this week's free days (§5.7) · **Weekly check-in** (§8.4): last week Monday–Sunday, from Monday until ✕; days logged, average vs target, **best day** (the fuller day closest to the target; Just track: the most logged), weight trend, one encouraging line and **ONE suggestion**: the nutrient furthest under 75% of its need (protein, iron, calcium, fibre, B12, folate, vitamin C — only when ≥ 80% of the grams have data and quick adds carry ≤ 20% of the kcal) with **2 food ideas** from `common_foods` (matching *I eat*, new foods first), else water under 75% of the goal, else "keep going"; fewer than 3 logged days → "log a few more days" · no week logged → no card · **Reminders**: the day-3 offer card is dropped — reminders are switched on at onboarding's last step (*Remind me at meal times* = breakfast, lunch, dinner) or in **Profile → Reminders** (a switch + time per visible meal, and the **pending scans** evening nudge, 9 pm, only while scans wait — it replaces the dropped photo-now-log-later nudge); at most 3 on; all local notifications, so **Expo Go is enough** (only remote push needs a development build) · `weekly_checkins` (migration `0007_weekly_checkins`) |
| Comfort (Stage 10b, 2026-09-28) | **Hide numbers** (Profile → Numbers, `settings.hide_numbers`): Today's ring shows the §8.3 words in its middle ("About halfway"), Just track counts items logged; macro bars, Trends macro lines and vitamin/mineral bars keep their shapes with the same words (towards a *target*, a daily *need* or a daily *limit*, `bandText`); kcal, grams and % leave the meal cards, Log total, Add food lists, search results, portion sheet, thalis, recipes list, check-in (no average; "came out lower than your daily need"), limits card and its notification ("… has reached today's limit."), Trends (days on target instead of kcal, no axis numbers, weight as *Trending down / up / Steady*, weigh-ins listed by day) and the food screen (a line instead of the nutrient table). Water ml stays (not a body or food number). Goals, onboarding, the recipe builder and the label form keep their numbers: they are where numbers are typed · **CSV export** (Profile → Export CSV, `app/export.tsx`): Last 7 / 30 / 90 days, Everything (from the first entry, water or weigh-in) or two picked dates; four files, each shared on its own (expo-sharing opens one file at a time), written to the cache folder with expo-file-system; expo-sharing added (asked for and approved in this stage) · **Hindi UI** (`src/i18n/hi.json`, user's call — replaces "English UI only"): Profile → Language (Same as phone · English · हिन्दी), calendars in Hindi too; units (kcal, g, ml, kg) and am/pm stay in Latin letters; a test keeps both files' keys and {{placeholders}} the same · **Accessibility**: tap targets ≥ 44 pt everywhere (48 dp in the theme; calendar days 44 pt, text links 48 dp tall), the ring's big number and the calendar's day numbers grow at most 1.3–1.4× so they stay inside their circles (the full value is in the screen-reader label), the hour grid has 4 columns instead of 6 with large text, amounts wrap onto 2 lines · **Wording**: a test scans every string in both languages for the §7 banned words (plus "over"); "A bit under or over" → "Close to target", "averaged over" → "across" |
| Accounts (Stage 11a, 2026-09-28) | **Optional sign-in with an emailed code** (Profile → **Account**, `app/account.tsx`): email → *Send me a code* → type the code → signed in; signing up is the same step (`shouldCreateUser`). Nothing else in the app reads the account, so it works exactly the same signed out · Supabase keys only in `.env` (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` = the publishable or legacy anon key); without them accounts are hidden (Privacy stays); **a secret / service_role key is refused** by the app (`isPublicKey`) · the session is kept in **expo-secure-store** (Keychain / Keystore) in 1000-character pieces (secure storage is meant for values under 2 kB), apart from user.db · Postgres tables **mirror user.db** (§4.3) in `supabase/migrations/`; nothing is uploaded until 11b · **Row Level Security**: one *Only your own rows* policy per table; `supabase/tests/rls.test.sql` proves it with two people (run in the SQL Editor; rolled back) and `src/db/cloud/migrations.test.ts` keeps the SQL in step with user.db · **Delete my account and data**: a confirmation sheet → `delete_my_account()` (security definer, deletes the caller from `auth.users`; every table cascades) → signed out on this phone; **the phone's own data stays** (uninstalling removes it) · sign out = this phone only, works offline · **Privacy** (`app/privacy.tsx`, Profile → Privacy and from Account): one screen, six short sections — what is on the phone, what an account keeps (only the email in 11a), where (Supabase, Mumbai), never sold or used for ads, barcode lookups, deleting |
| Groups (Stage 11c, 2026-09-28) | Built **before 11b sync** (the user's call), so sharing has its own small upload instead of waiting for sync · **one group per person**, up to 50 people, **no owner**: everyone can send the code, make a new code and leave; the last person out ends the group · **invite code**: 6 characters from `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (no 0 O 1 I L), made by the server from `gen_random_uuid()`; typing ignores spaces, dashes and small letters; shown as "K7M Q2P"; **at most 10 wrong codes an hour** per account · **your name in the group** (1–30 characters) is asked when starting or joining and shown next to your foods · Profile → **My group** (`app/group.tsx`): start / join, the code with *Send the code* (the phone's share sheet) and *Make a new code*, people, *Shared by you* / *Shared by others*, *Leave group* (confirmation sheet) · **sharing** is a switch on the food screen of the person's own recipes and products (*Share with my group*); the group gets name, brand, barcode, per-100 g nutrients (`null` stays unknown), units, density and cooked-with-fat — never label photos, recipe ingredients or the log · **group foods** are kept in `custom_foods` (`shared_food_id` + `added_by`), so search (tag *Group*, "Shared by Asha"), logging, recents and favourites work offline; they are left out of My foods and Recipes and can't be edited here; a newer version from the sharer updates days already logged (like an edited recipe) · a change made offline is sent next time (`shared_at` vs `updated_at`, `planShareUploads`), at start, when the app comes back to the front (at most every 5 min) and a second after any food change · **flags**: anyone else in the group can flag a food (*Something looks wrong?* → Calories · Other nutrients · Name or brand · Something else + an optional 200-character note); everyone sees the count, the sharer sees who and why and has *Mark as fixed*; flags are read live (online only) · **leaving** (or deleting the account) removes your shared foods and flags from the group; group foods leave this phone's search on leaving or signing out (soft delete, so logged days keep their numbers) · a product the person saves themselves takes the barcode over from a group copy of the same packet |
| Goals (Stage 5, 2026-09-27) | Requirements come from the **ICMR-NIN 2020 short report** (`data/raw/ICMR-NIN.pdf`), typed into `src/lib/targets/icmr.ts` with the printed page beside every value — it replaces `rda_icmr_nin_2020.csv` / `rda_reference` (removed, foods.db db_version 3). Checked against the PDF: B12 is 2.2 µg (not 2.5), copper 1.7 mg (not 2), vitamin E "7.5–10 mg" (10 used), no TUL in the report for phosphorus, copper, manganese, selenium or vitamin E · groups: 16–18 y (for 18-year-olds), 19–59 y, ≥ 60 y (anything the elderly table leaves out = adult value, p. 11) · Kalorie's 5 activity levels map to ICMR's 3: sedentary + light → sedentary, moderate + active → moderate, very active → heavy · **fibre target = ICMR adequate intake by sex/age/activity** (e.g. 25 g sedentary woman) instead of 20 g per 1000 kcal · onboarding is **4 screens** (goal with the welcome line · about you · activity · targets), every question has *Skip*; skipped sex = "prefer not to say", skipped activity = mostly sitting, skipped goal = maintain, and without age + height + weight there is no calorie target yet (limits still apply) · the floor suggestion is rounded **up** to 50 · limit alerts: one calm card, a line per nutrient ("Fat is 12 g above today's limit."), fired once per nutrient per day (`limit_alerts`), ✕ closes them for the day · **optional phone notification, off by default** (expo-notifications, local only), once per nutrient per day · Goals: *Save* starts a targets row from today, *Reset to suggested* saves the suggestion; changing calories moves macros and the %-based limits with it |

---

## 2. Screens

Navigation uses expo-router. There are four bottom tabs: **Today · Log · Trends · Profile**.
- **Today** — the main overview of the day.
- **Log** — the meal timeline for today, and past days picked from a calendar.
- **Trends** — stats over days and weeks, and insights.
- **Profile** — settings, your profile and account, and other options.

Route files in `app/` only re-export a screen from `src/features/<name>/`.
"Add food" is a pushed screen (a full-screen modal later), opened by *+ Add* on Today and the Log tab.

### 2.1 Onboarding (`app/onboarding.tsx`) — target under 60 seconds
Four steps in one screen, big tap targets, a progress bar, *Back* (and the phone's back button),
and *Skip* on every question. No typing except numbers. Nothing is saved until the last step.
Until onboarding is finished (or skipped) the app shows only this screen (`Stack.Protected`).

1. **Goal** — the welcome line ("Kalorie helps you notice what you eat. Setup takes under a
   minute.") above Lose weight · Keep my weight · Gain weight · Just track.
   If Lose: pace chips *Gentle (0.25 kg/week)* · *Steady (0.5 kg/week)*. If Gain: *0.25 kg/week*.
   *Skip — just let me log* saves goal = track straight away.
2. **About you** — Sex (Male · Female · Prefer not to say), Age, Weight (kg), Height (cm, or
   ft + in). Each can be left empty. Under 18 → friendly note, goal becomes Just track.
3. **Activity** — 5 cards with plain examples:
   Mostly sitting · Light (walks, housework) · Moderate (exercise 3–5 days) ·
   Active (exercise 6–7 days) · Very active (physical job + exercise).
4. **Your starting targets** — calorie number, macro grams, fibre, the four limits, a line that
   says "These are a starting point. You can change them any time." Shows the floor note (§5.4)
   with a *Use {floor} kcal* button if it applies, or why there is no calorie target (Just track,
   under 18, or age/height/weight skipped). Under it, **Remind me at meal times** (off; switching
   it on asks for notification permission, and *Start logging* turns on breakfast 9:00 am, lunch
   1:30 pm, dinner 8:30 pm — Stage 10a). Button: *Start logging* → Today.

Skipped answers: sex → "prefer not to say" in the maths (stored as NULL), activity → mostly
sitting, goal → maintain. Without age, height and weight there is no calorie target until they
are added in Goals.

### 2.2 Today (`app/(tabs)/index.tsx`)
Top to bottom:
- **Date header** — "Today" / date, ‹ › arrows, tap for a date picker. Under it, on today only, a
  small streak line ("12 day streak · 2 free days left this week", §5.7), nothing when there is no
  streak; tap → a sheet explaining free days.
- **Calorie ring** — eaten, target, "left" or "more than planned". The ring fills to 100%;
  anything beyond shows as a thin soft-blue outer arc. In hide-numbers mode: shape + words
  only (§8.3). In Just-track mode: shows eaten only, no ring target.
- **Macro pie** — protein / carbs / fat by kcal share, legend with grams eaten vs target.
  Tap a macro → **Top 3 foods** sheet (food, grams of that macro, % of the day's total).
- **Water row** — glasses as small icons (the goal in glasses, filled as they're drunk), *−* (takes
  off the day's last water) and *+* (one glass); long-press + for a custom ml amount.
- **Notice cards** (only if relevant, in this order, max 3 visible):
  alert card (§6), weekly check-in (from Monday, §8.4), pending barcode lookups (§2.8).
- **Timeline by meal slot** — one card per visible slot in order. Each card: slot name,
  slot kcal, entry rows (name, amount like "1 katori", kcal), *+ Add* button, and (when the meal
  has entries) *Save as thali* and *Copy this meal to…* icons. *(Clear meal: later.)*
  Tapping an entry opens **Edit entry**. Swipe left → delete (with Undo).
- **Copy this day** and **Recently deleted** are on the Log tab (§2.10), for the day it shows
  (copying from yesterday goes to today by default). Today has no ⋯ day menu.
- **Undo bar** — after log, delete, copy or clear; 5 seconds; one tap reverses the whole action.

### 2.3 Add food (`app/add/index.tsx` — a pushed screen for now, a modal later)
- **Slot chips** at top (one scrolling line), pre-selected by time window (§5.8), or the slot
  whose *+ Add* was tapped; tap to change.
- **Search bar** (not focused on open, so the suggestions below stay visible). Results in a
  FlashList: name, source tag (INDB / IFCT / USDA / My food / Product), a typical portion + its
  kcal, ☆ favourite.
- When the search box is empty: the search hint ("Daal, bhindi and dahi all work") until the first
  food is logged, then **Often at {slot}** (time-of-day suggestions, §5.9 — starter foods from
  `slot_suggestions` for a new user), then tabs **Recent** · **Favourites** · **My foods**
  (recipes and products, with *New recipe*) · **Thalis** (the person's own, then the 6 *Starter
  thalis*; tap → the thali checklist, §2.9). Every row shows the amount it would be logged at +
  kcal, ☆, and a ⊕ that logs it in one tap (haptic tick + Undo bar).
- Buttons row: **Quick add** · **Scan barcode** (· **Create food** later).
- Tap a result or a row → the food screen with its **Portion sheet** (*Add to log*) already open;
  closing the sheet shows the food's nutrients.

### 2.4 Portion sheet (bottom sheet)
- Food name, source tag, ☆ favourite toggle.
- Quantity stepper (0.25 steps for katori/cup/glass, 0.5 for roti/piece, free number for g/ml).
- Unit chips: only the units valid for this food (§5.2), default unit pre-selected.
- Grams preview ("≈ 150 g").
- **Oil/ghee**: Less · Normal · More (only if the food has fat ingredients or `cooked_with_fat = 1`).
  Changes only the calories and fats (§5.5). Stored as the entry's `oil_level`.
- Live numbers for this portion: kcal, P / C / F.
- *Log to Lunch* button (slot name shown). After logging: haptic tick + Undo bar, sheet
  closes, the search stays open for the next item ("Add more" flow).

### 2.5 Quick add
kcal (required), optional protein / carbs / fat grams, optional name ("Wedding buffet"),
slot. Stored without grams (§4.2 `log_entries`).

### 2.6 Edit entry
Same as the portion sheet plus: slot picker, time picker, *Delete*. Changes save on *Done*.

### 2.7 Barcode scanner (`app/scan.tsx`)
Opened by *Scan barcode* on the Log tab and in Add food (which passes its slot on).
- Live camera (expo-camera) with a frame, torch toggle. Reads EAN-13, EAN-8, UPC-A, UPC-E; a code
  whose check digit is wrong is ignored and the camera keeps looking. Before the camera: a friendly
  reason ("only to read barcodes on food packets"), *Allow camera*, or *Open settings* if it was
  refused for good.
- *Pick from gallery* (expo-image-picker → expo-camera `scanFromURLAsync`) — **Android only**:
  on iOS it reads only QR codes from images (checked in Stage 6).
- *Type the number* → numeric field; the check digit catches a mistyped digit.
- Flow: check local cache (`custom_foods` where `barcode = code`) → if found, the product's food
  screen (portion chips: serving · pack · g, ml for drinks) → the normal *Add to log* sheet.
  Else Open Food Facts lookup → if found, save as product → food screen.
  Else if offline (or Open Food Facts doesn't answer) → add to `barcode_queue`, offer
  *Quick add now* · *Add from label* · *Scan another*.
  Else (not found, or found without nutrition numbers) → **Add from label** form.

### 2.8 Add from label (`app/label.tsx`)
Name, brand, barcode (pre-filled; the name too if Open Food Facts knows it), "Values are per:
100 g · 100 ml · one serving" + serving size in g (needed for per serving), pack size (optional).
Fields: energy kcal (required), protein, carbs, of which sugar, fat, of which saturated fat, trans
fat, fibre, sodium (mg), cholesterol (mg); empty = unknown. Optional **photo of the label**
(camera or gallery). Saved as per-100 g (§5.3) with the barcode, so the next scan finds it at once.
Stage 12 adds a toggle: *Also share with Open Food Facts*.
The **Pending lookups** card on Today lists queued barcodes: pending ones are retried on app open,
when the app comes back to the front and with *Try again now*; a found one opens the product (to
log it to the day and meal it was scanned for), a not-found one opens this form; ✕ removes one.

### 2.9 My foods, recipes, thalis (Add food → *My foods* / *Thalis*; Profile → Recipes)
- **My foods list** — custom foods + cached products, search, edit, delete.
- **Create / edit food** — same fields as §2.8, plus custom units ("1 bowl = 180 g").
- **Recipe list** (`app/recipes.tsx`, Profile → Recipes) — name + kcal per serving; tap to edit,
  ⧉ to duplicate, swipe left to delete (Undo). *New recipe* on top.
- **Recipe builder** (`app/recipe.tsx`; `?id=` edit, `?copy=` duplicate as "… (copy)") — name,
  servings, optional *cooked weight* (the whole pot after cooking; default = sum of raw ingredient
  grams), ingredients (*Add ingredient* → search any food, including other recipes and products
  but not itself → unit + amount; oil/ghee/butter/vanaspati/margarine ticked as fat on their own,
  a switch changes it). Shows per serving (kcal + P/C/F, serving grams), per 100 g (cooked, or
  "raw weight"), and 1 katori's kcal once the cooked weight is typed. *Save recipe* needs a name,
  servings and one ingredient. Saved as a food (kind = recipe) with units *serving* and — with a
  cooked weight — *katori* (150 g). Editing updates the days it was already logged.
- **Thalis** — *My thalis*, then 6 built-in *Starter thalis* (`thali_templates`: North Indian veg,
  South Indian meals, Gujarati, Punjabi non-veg, Bengali fish, Simple dal-chawal; logged the same
  way, but they can't be deleted). *Save as thali* from any meal card: a name
  (default "Lunch thali"), the meal's foods and amounts (quick adds are left out), oil levels
  kept. Add food → **Thalis** → tap one → checklist: tick/untick, − / + each amount, pick the
  meal → *Log N items to Lunch* (one batch, one Undo). *Delete thali* (Undo) in the same sheet.

### 2.10 Log tab (`app/(tabs)/log.tsx`)
- Opens on **today's timeline** (meal-slot cards as in §2.2), editable. At the top: the day's
  name and date, and *Yesterday* · *Today* · *Pick a date* (calendar sheet). New entries go to
  the day shown here. *(Stage 3a)*
- *(The adherence calendar moved to Trends in Stage 8, §2.11; *Pick a date* here stays a plain
  calendar.)*
- Streak summary ("Longest: 34 days · This week: 5 of 7 logged"). *(Stage 10b; Today has the streak
  line since Stage 10a.)*
- A day opened from the Trends calendar with *Edit* shows here: that day's timeline (editable), day
  totals, *Recently deleted* for that day (restore within 30 days). *Recently deleted* is done: a line under the day's meals when it
  has deleted entries ("Recently deleted (2)") opens a sheet with *Bring back* on each (with Undo).

### 2.11 Trends tab (`app/(tabs)/trends.tsx`)
Segment: **Calendar · Week · Month** (opens on Calendar).
- **Calendar** (react-native-calendars, Monday first, swipe or ‹ › for months) — each day's number on
  a soft fill by adherence (§5.6), today with a ring, days after today greyed; a line for the month
  ("12 days logged · 7 on target") and a legend. Tap a day → **the day, read-only**
  (`app/day/[day].tsx`): the Today layout (ring, macros, top contributors, water, meals with
  something in them) with no buttons, and *Edit* → the Log tab on that day.

Week = the last 7 days, Month = the last 30, today included. Averages count logged days only;
today counts once it looks finished (not partly logged, §5.6). Sections:
- **Calories** — bar per day (green on target, soft blue away from it, grey partly logged), dashed
  line at each day's target, "On average 1,840 of 2,000 kcal a day · 5 of 7 days on target".
- **Macros** — average grams vs the average target for protein / carbs / fat, and a line per macro
  through the logged days (gaps stay gaps).
- **Weight** — faded dots for weigh-ins, the trend line (§5.7) through them, "Trend 72.1 kg · −0.3 kg
  a week", *Add weight* (today or yesterday; starts at the latest weight) and the last 3 weigh-ins
  (tap to change or delete). Hidden in hide-numbers mode (shows direction words only, Stage 10).
- **Water** — bar per day vs the goal (dashed), "On average 1,750 ml a day · goal 2,000 ml".
- **Nutrients** — a card that opens Vitamins & minerals for the selected period (7- or 30-day
  average, per logged day), shown once something is logged in it.

### 2.12 Micronutrients (`app/nutrients.tsx`, *Vitamins & minerals*)
Opened from a card on Today and on a past day (`?day=`, period Day) and from Trends Week / Month
(`?period=week|month`). Period chips: **Day · 7-day average · 30-day average** (the 7 or 30 days
ending on the day; averages count logged days only, today only once it looks finished, §2.11).
Three groups: **Vitamins**, **Minerals**, and **Fibre, fats and sugar** (fibre, sugar, sat /
mono / poly / trans fat, cholesterol). Each row: name, amount + unit, a bar towards the goal and
"41% of 29 mg" (a need: ICMR-NIN RDA or adequate intake, fibre = the fibre target) or "73% of the
2,000 mg limit" (sodium, sugar, saturated fat = the limits in Goals); MUFA, PUFA, trans fat and
cholesterol show the amount only. Bars are monochrome (fibre in its olive accent), stop at full,
and are never red. **Incomplete** (§5.10): "≈ 12 mg", a lighter bar and "At least this · based on
3 of 5 foods"; nothing known: "No data for the foods eaten", no bar. Above TUL: "Above the safe
upper level". A line at the top explains ≈ when any row has it. Under 18: amounts only.
Tap a row → sheet: amount vs need, *Some foods have no data for this* (which foods, quick adds
note), the TUL note (§6 rule 5), **Where it came from** (top 3 foods, amount a day + share) and,
for needs only, **Good sources**: 5 everyday foods from `common_foods` (§4.1) with their portion,
amount and % of the need, vegetarian first when *I eat* says so (§2.14); tap → the food screen.

### 2.13 Goals (`Profile` → Goals, `app/goals.tsx`)
- **About you** — sex, age, height, weight, activity, goal + pace (same controls as onboarding).
- **Daily targets** — kcal, protein, carbs, fat, fibre, each editable. Changing kcal moves
  protein/carbs/fat and the %-based limits with it; an empty kcal = no calorie target.
- **Daily limits** — sodium, sugar, saturated fat, fat, each editable, each with an on/off switch
  for its note on Today. *Also send a phone notification* — off by default; asks for permission.
- **Water** — daily goal (ml) and one glass (ml); saved with *Save* (Stage 8).
- Floor note shown inline when kcal is below the floor (with *Use {floor} kcal*), never blocking.
- *Save* saves the answers and the typed targets as a new `targets` row from today (past days keep
  their targets; saving twice in a day replaces that day's row). *Reset to suggested* saves the
  answers and the suggested targets.
- **Vitamins and minerals** — the person's ICMR-NIN 2020 needs and upper limits (read-only: they
  come from the report, not from the person).

### 2.14 Profile tab / Settings (`app/(tabs)/profile.tsx`)
Goals (includes Water: glass ml, goal ml) · **Food → I eat** (Everything · Vegetarian ·
Vegetarian + eggs; Stage 9 — good sources are suggested to match) · My foods · Recipes · Thalis · Meal slots (rename,
reorder, hide, add custom, edit time windows) · Hide numbers · Theme (System / Light / Dark) · Language (Same as phone · English · हिन्दी, Stage 10b) ·
Reminders (`app/reminders.tsx`, Stage 10a: a switch + time per visible meal slot, and the evening
pending-scans nudge; at most 3 on) · Alerts · Export CSV · About & data sources (`app/about.tsx`, Stage 6:
version and credits — INDB, IFCT 2017/NIN, USDA FoodData Central, "Food data from Open Food Facts
(ODbL)", ICMR-NIN 2020) ·
*Stage 11a:* Account (`app/account.tsx`: sign in with an emailed code, sign out, *Delete my account and data*) and Privacy (`app/privacy.tsx`) · *Stage 11b:* Sync · *Stage 11c:* My group (`app/group.tsx`, shown when accounts are switched on) · *Stage 12:* Open Food Facts account.

---

## 3. Nutrients tracked (exact list)

All values are **per 100 g of edible portion**. `NULL` = unknown (not zero).
The same column names are used in `foods` (foods.db) and `custom_foods` (user.db).

| # | Column | Label | Unit | Group |
|---|---|---|---|---|
| 1 | `energy_kcal` | Energy | kcal | Energy |
| 2 | `protein_g` | Protein | g | Macro |
| 3 | `carb_g` | Carbohydrate (available) | g | Macro |
| 4 | `fat_g` | Total fat | g | Macro |
| 5 | `fibre_g` | Dietary fibre | g | Other |
| 6 | `sugar_g` | Total sugars | g | Other |
| 7 | `sat_fat_g` | Saturated fat | g | Other |
| 8 | `mufa_g` | Monounsaturated fat | g | Other |
| 9 | `pufa_g` | Polyunsaturated fat | g | Other |
| 10 | `trans_fat_g` | Trans fat | g | Other |
| 11 | `cholesterol_mg` | Cholesterol | mg | Other |
| 12 | `sodium_mg` | Sodium | mg | Mineral |
| 13 | `potassium_mg` | Potassium | mg | Mineral |
| 14 | `calcium_mg` | Calcium | mg | Mineral |
| 15 | `iron_mg` | Iron | mg | Mineral |
| 16 | `magnesium_mg` | Magnesium | mg | Mineral |
| 17 | `phosphorus_mg` | Phosphorus | mg | Mineral |
| 18 | `zinc_mg` | Zinc | mg | Mineral |
| 19 | `copper_mg` | Copper | mg | Mineral |
| 20 | `manganese_mg` | Manganese | mg | Mineral |
| 21 | `selenium_ug` | Selenium | µg | Mineral |
| 22 | `iodine_ug` | Iodine | µg | Mineral |
| 23 | `vit_a_ug` | Vitamin A (RAE) | µg | Vitamin |
| 24 | `thiamine_mg` | Vitamin B1 (thiamine) | mg | Vitamin |
| 25 | `riboflavin_mg` | Vitamin B2 (riboflavin) | mg | Vitamin |
| 26 | `niacin_mg` | Vitamin B3 (niacin) | mg | Vitamin |
| 27 | `pantothenic_mg` | Vitamin B5 (pantothenic acid) | mg | Vitamin |
| 28 | `vit_b6_mg` | Vitamin B6 | mg | Vitamin |
| 29 | `biotin_ug` | Vitamin B7 (biotin) | µg | Vitamin |
| 30 | `folate_ug` | Vitamin B9 (folate) | µg | Vitamin |
| 31 | `vit_b12_ug` | Vitamin B12 | µg | Vitamin |
| 32 | `vit_c_mg` | Vitamin C | mg | Vitamin |
| 33 | `vit_d_ug` | Vitamin D | µg | Vitamin |
| 34 | `vit_e_mg` | Vitamin E (α-tocopherol) | mg | Vitamin |
| 35 | `vit_k_ug` | Vitamin K | µg | Vitamin |

Build-time conversions:
- IFCT energy is in kJ → `kcal = kJ / 4.184`. Every other IFCT value (from
  `@ifct2017/compositions`) is in **grams** per 100 g → × 1000 for mg, × 10⁶ for µg. IFCT writes
  a missing value as 0: when a whole group (minerals, vitamins, fatty acids) is 0 for a food it
  is stored as `NULL`.
- INDB fatty acids are in mg → ÷ 1000. INDB's `vita_ug` is retinol only, so
  `vit_a_ug = vita + carotenoids / 6` (ICMR-NIN). INDB serving grams = serving kcal ÷ kcal per
  100 g × 100. INDB's vitamin D is stored as unknown: it is built from IFCT's plant values (below).
- INDB recipe fixes (INDB counts every ingredient as eaten, per 100 g of the raw recipe):
  - **Frying oil** (INDB writes "for frying" / "for deep frying"; often 2 cups): only
    `min(listed, 0.15 × other ingredients' grams)` stays in the food (`FRYING_OIL_ABSORBED`,
    `src/lib/oil.ts`); the rest, with its nutrients, comes out of the per-100 g values.
  - **Water that never reaches the plate** ("enough to immerse egg", "water for steaming") comes
    out too. Soaking water stays (sago soaks it up, dates are ground with it).
  - **Servings**: INDB's serving is the recipe ÷ its number of pieces, so it shrinks with the
    recipe. `data/curated/indb_servings.csv` sets the piece count where INDB's is off (gulab
    jamun, chhena sweets). A serving is then dropped if it is outside 5–600 g, a piece or slice
    over 450 kcal, any other serving over 700 kcal, or a cup/glass bigger than one (tea cup
    250 g, cup 300 g, glass 350 g, tall glass 450 g).
  - Not fixed: water that boils off while cooking. INDB's per-100 g is per raw weight, so dals,
    curries, chhena sweets and dry fried snacks (sev, chips) are low per 100 g when weighed;
    per piece/serving they are right.
- If a source has no energy value: `kcal = 4·protein + 4·carb + 9·fat` (+ `energy_estimated = 1`).
- Vitamin A = retinol + β-carotene / 6 + (α-carotene + β-cryptoxanthin) / 12 (µg) — ICMR-NIN
  2020's factors (p. 10; `vitaminAUg`, Stage 9). IFCT: retinol + β-carotene equivalents / 6. USDA:
  the same from retinol and the carotenoids when listed, else USDA's own RAE (12:1 / 24:1).
- IFCT slips fixed in the build (Stage 9, `data/SOURCES.md`): fish vitamin B6 and biotin ÷ 1000;
  vitamin D of plant foods (not mushrooms) → unknown.
- Sodium from Open Food Facts is in g/100 g → × 1000.
- `carb_g` = available carbohydrate (IFCT "by difference minus fibre"; USDA
  "carbohydrate by difference" minus fibre).

### 3.1 ICMR-NIN 2020 reference values (adult, sedentary)

Source: *Short Report of Nutrient Requirements for Indians — RDA and EAR 2020* (ICMR-NIN),
`data/raw/ICMR-NIN.pdf`. **`src/lib/targets/icmr.ts` is the single source**: every EAR, RDA,
adequate intake and TUL for 16–18 y, adults and ≥ 60 y, by sex and category of work, with the
printed page number beside each value (PDF page = printed + 3). Checked against the PDF in
Stage 5. Below: adult (19–59 y), sedentary.

| Nutrient | Man | Woman | TUL | Page |
|---|---|---|---|---|
| Fibre (adequate intake) | 30 g | 25 g | — | 13 (40/30 moderate, 50/40 heavy) |
| Calcium | 1000 mg | 1000 mg | 2500 mg | 13, 17 (≥ 60 y: 1200 mg, p. 15) |
| Iron | 19 mg | 29 mg | 45 mg | 13, 17 (women ≥ 60 y: 19 mg) |
| Magnesium | 440 mg | 370 mg | 350 mg (supplements only) | 13, 17 |
| Phosphorus | 1000 mg | 1000 mg | — | 16 |
| Zinc | 17 mg | 13.2 mg | 40 mg | 13, 17 |
| Sodium | ≤ 2000 mg (safe intake ≈ 5 g salt) | same | — | 6, 16 |
| Potassium | 3500 mg | 3500 mg | — | 16 |
| Copper | 1.7 mg | 1.7 mg | — | 16 |
| Manganese | 4 mg | 4 mg | — | 16 |
| Selenium | 40 µg | 40 µg | — | 7, 16 |
| Iodine | 140 µg | 140 µg | 1100 µg | 13, 17 |
| Vitamin A | 1000 µg | 840 µg | 3000 µg | 13, 17 |
| Thiamine | 1.4 mg | 1.4 mg | — | 13 (varies with work) |
| Riboflavin | 2.0 mg | 1.9 mg | — | 13 (varies with work) |
| Niacin | 14 mg | 11 mg | 35 mg | 13, 17 (varies with work) |
| Pantothenic acid | 5 mg | 5 mg | — | 8 |
| Vitamin B6 | 1.9 mg | 1.9 mg | 100 mg | 13, 17 (varies with work) |
| Biotin | 40 µg | 40 µg | — | 9 |
| Folate | 300 µg | 220 µg | 1000 µg | 13, 17 (women ≥ 60 y: 200 µg) |
| Vitamin B12 | 2.2 µg | 2.2 µg | — | 13 |
| Vitamin C | 80 mg | 65 mg | 2000 mg | 13, 17 |
| Vitamin D | 15 µg (600 IU) | 15 µg | 100 µg (4000 IU) | 13, 17 (≥ 60 y: 20 µg) |
| Vitamin E | 10 mg ("7.5–10 mg") | 10 mg | — | 10 |
| Vitamin K | 55 µg | 55 µg | — | 10 |

"Prefer not to say" uses the **higher** need of the two and the **lower** TUL. Kalorie's activity
levels map to ICMR's categories of work: sedentary + light → sedentary, moderate + active →
moderate, very active → heavy. Vitamin A in foods: ICMR-NIN uses **6:1** for β-carotene (12:1 for
α-carotene and β-cryptoxanthin, p. 10) — foods.db uses the same since Stage 9.

---

## 4. Data model

SQLite types: `INTEGER`, `REAL`, `TEXT`. Booleans are `INTEGER` 0/1.
Dates are `TEXT 'YYYY-MM-DD'` (the **logical day**, §5.8). Timestamps are
`INTEGER` epoch milliseconds. `NUTRIENTS` means all 35 columns from §3, all `REAL NULL`.

### 4.1 foods.db — read-only, bundled at `assets/db/foods.db`

Built by `scripts/build-foods-db/` from `data/raw/` + `data/curated/`. The app never
writes to it (the connection runs with `PRAGMA query_only = ON`). On first launch the bundled
file is copied into the phone's SQLite folder; when an app update brings a different file the
copy is replaced — the setting `foods_db_version` stores the bundled asset's hash, and
`meta.db_version` is bumped whenever tables change. Opened with expo-sqlite's
`finalizeUnusedStatementsBeforeClosing: false`: the default finalizes FTS5's own statements
before closing and crashes the app on reload.

**`foods`**
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | stable across builds (hash of source + source_code) |
| source | TEXT | `indb`, `ifct`, `usda_fnd`, `usda_sr` |
| source_code | TEXT | ID in the original dataset |
| name | TEXT | display name, English |
| category | TEXT | e.g. `cereal`, `pulse`, `vegetable`, `dish`, `beverage`, `sweet` |
| kind | TEXT | `ingredient` or `dish` |
| diet | TEXT NULL | `veg`, `egg`, `nonveg` |
| cooked_with_fat | INTEGER | 1 if the oil adjuster applies without a recipe (0 for all foods.db rows: every INDB dish has a recipe) |
| density_g_per_ml | REAL | default 1.0 |
| default_unit | TEXT | e.g. `katori`, `roti_m`, `piece`, `g` |
| default_qty | REAL | e.g. 1 |
| yield_g | REAL NULL | weight of the whole recipe that the per-100 g values refer to (INDB dishes: the **raw** ingredient weight — INDB divides recipe totals by it, checked in the build — minus frying oil left in the pan and discarded water, §3) |
| energy_estimated | INTEGER | 1 if energy was calculated from macros |
| search_rank | INTEGER | source priority: indb 1, ifct 2, usda 3 |
| name_hi | TEXT NULL | Roman-letter Hindi name ("Garam Chai", "Bhindi"), from INDB brackets / IFCT |
| complete_macro | INTEGER | 1 if energy, protein, carbs and fat are all known |
| complete_other, complete_mineral, complete_vitamin | INTEGER | 1 if ≥ 80% of that §3 group is known |
| NUTRIENTS | REAL NULL | per 100 g |

**`food_synonyms`** — `food_id INTEGER`, `term TEXT` (lowercase, Roman letters),
`kind TEXT` (`hindi`, `spelling`, `regional`, `english`). Index on `term`.

**`foods_fts`** — FTS5 virtual table: `food_id UNINDEXED`, `text` (name + synonyms +
their phonetic keys, §5.1). Tokenizer `unicode61 remove_diacritics 2`, prefix index `2 3`.

**`food_units`** — `food_id INTEGER`, `unit TEXT` (`katori`, `roti_s`, `roti_m`,
`roti_l`, `piece`, `glass`, `cup`, `tsp`, `tbsp`, `slice`, `bowl`…), `label TEXT`
("medium roti" — no number, so the app can show "2 medium roti"), `grams REAL` (for 1 unit),
`is_default INTEGER`. PK (`food_id`, `unit`). Every unit a food offers has a row, including
standard measures (katori = 150 ml × density), so the portion sheet reads its chips from here;
`g` is always offered and has no row. INDB servings become `piece`, `slice`, `bowl`, `plate`,
`serving`, `tbsp` or `tsp` (label = INDB's word, e.g. "parantha", "tall glass"); USDA portions
become `cup`, `tbsp`, `tsp`, `slice`, `piece`, `piece_s`, `piece_l` or `serving`.

**`unit_defaults`** — `unit TEXT PK`, `ml REAL NULL`, `grams REAL NULL`, `label TEXT`.
Rows: katori 150 ml · glass 250 ml · cup 240 ml · tbsp 15 ml · tsp 5 ml · ml 1 ml ·
g 1 g. (Roti, piece, slice have no default: they exist only per food.)

**`recipe_ingredients`** — `recipe_food_id INTEGER`, `position INTEGER`,
`ingredient_food_id INTEGER NULL`, `ingredient_name TEXT`, `grams REAL`,
`is_fat INTEGER` (oil, ghee, butter, vanaspati, margarine), NUTRIENTS (per 100 g of the
ingredient — filled **only for fat rows**, which is all the adjuster needs; other ingredients
are looked up by `ingredient_food_id`, or are unknown if it is NULL).
PK (`recipe_food_id`, `position`). `grams` is the amount in the dish as eaten: frying oil only
the part the food soaks up, discarded water 0 (§3). Built from `data/raw/recipes.xlsx`: kitchen measures become
grams with tsp 5 ml · tbsp 15 ml · cup 240 ml · ml × density; Anuvaad's own ingredient codes
are linked to foods through `data/curated/indb_ingredients.csv`.

**`search_pins`** — `term TEXT PK` (phonetic key text, §5.1), `food_id INTEGER`. The food shown
first for that exact search term. Built from `data/curated/search_pins.csv`.

**`thali_templates`** — `id INTEGER PK`, `name TEXT`, `region TEXT` (`north`, `south`, `east`,
`west`, `any`).
**`thali_template_items`** — `template_id INTEGER`, `position INTEGER`, `food_id INTEGER`,
`qty REAL`, `unit TEXT` (a unit the food offers, or `g`). Starters: North Indian veg · South
Indian meals · Gujarati · Punjabi non-veg · Bengali fish · Simple dal-chawal. Built from
`data/curated/thalis.csv` (db_version 4); the build checks every ref, name and unit.

**`slot_suggestions`** — `slot TEXT` (`breakfast`, `lunch`, `snacks`, `dinner`),
`food_id INTEGER`, `position INTEGER`. Starter suggestions for new users (8 per slot), built from
`data/curated/slot_suggestions.csv` (db_version 4).

**`common_foods`** — `food_id INTEGER PK`, `qty REAL`, `unit TEXT` (a unit the food offers, or
`g`), `grams REAL` (in the portion), `diet TEXT` (`veg`, `egg`, `nonveg`: the food's, or the file's
when foods.db doesn't know). About 80 everyday foods with an everyday portion (1 katori dal, 1
guava, 10 almonds, 1 glass milk) — the pool for *Good sources* on the Nutrients screen (§2.12).
Built from `data/curated/common_foods.csv` (db_version 5); the build checks every ref, name, unit
and that the diet is known.

*(`rda_reference` was removed in db_version 3: requirements live in `src/lib/targets/icmr.ts`, §3.1.)*

**`meta`** — `key TEXT PK`, `value TEXT`: `db_version` (5), `built_at`, `indb_version`,
`indb_recipes_version`, `ifct_version`, `usda_fnd_version`, `usda_sr_version`, `food_count`.

### 4.2 user.db — read-write, Drizzle ORM, migrations in `drizzle/`

Every table that will sync later has `id TEXT` (UUID v4), `created_at`, `updated_at`,
and `deleted_at INTEGER NULL` (soft delete). Rows with `deleted_at` older than 30 days
are hard-deleted at app start (`src/db/user/purge.ts`) — except a deleted recipe or product that
an entry, a thali or a recipe still uses: those need its numbers, so it stays (hidden).

**`profile`** (single row, `id = 1`; every answer can be skipped, so every answer is NULLable)
| Column | Type |
|---|---|
| id | INTEGER PK (always 1) |
| sex | TEXT (`m`, `f`, `x` = prefer not to say) |
| birth_year | INTEGER |
| height_cm | REAL |
| activity | TEXT (`sedentary`, `light`, `moderate`, `active`, `very_active`) |
| goal | TEXT (`lose`, `maintain`, `gain`, `track`) |
| pace_kg_week | REAL (0, 0.25, 0.5) |
| onboarded_at | INTEGER NULL |
| updated_at | INTEGER |

**`targets`** — a new row every time targets change, so old days keep old targets.
| Column | Type |
|---|---|
| id | TEXT PK |
| effective_from | TEXT (day) — unique |
| kcal | REAL NULL (NULL in Just-track mode) |
| protein_g, carb_g, fat_g, fibre_g | REAL NULL |
| sodium_mg_limit, sugar_g_limit, sat_fat_g_limit, fat_g_limit | REAL |
| is_custom | INTEGER (0 = calculated, 1 = user edited) |
| created_at, updated_at, deleted_at | INTEGER |

Targets for a day = the row with the latest `effective_from <= day`.

**`settings`** — `key TEXT PK`, `value TEXT` (JSON). Keys: `theme`, `hide_numbers`,
`water_glass_ml` (250), `water_goal_ml` (2000), `alerts_enabled`
(`{"sodium":true,"sugar":true,"sat_fat":true,"fat":true}`), `alert_notifications` (false), `reminders`
(`{"meals":{"<slot_id>":{"on":true,"at":"13:30"}},"pendingScans":{"on":false,"at":"21:00"}}`, Stage 10a),
`first_open_day`, `foods_db_version`, `diet_preference` (`any` · `veg` · `egg`, Stage 9), `hide_numbers`
(false), `language` (`system` · `en` · `hi`, Stage 10b).

**`meal_slots`**
| Column | Type |
|---|---|
| id | TEXT PK (`breakfast`, `lunch`, `snacks`, `dinner`, or UUID for custom) |
| name | TEXT NULL (NULL for a built-in slot that hasn't been renamed: the name comes from en.json) |
| position | INTEGER |
| start_min | INTEGER (minutes after midnight, e.g. 240 = 4:00) |
| end_min | INTEGER |
| is_hidden | INTEGER |
| is_builtin | INTEGER |
| created_at, updated_at, deleted_at | INTEGER |

Defaults: Breakfast 04:00–11:00 · Lunch 11:00–16:00 · Snacks 16:00–19:00 · Dinner 19:00–04:00.

**`log_entries`**
| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | |
| day | TEXT | logical day (§5.8) |
| logged_at | INTEGER | when it was eaten (editable) |
| slot_id | TEXT | → meal_slots.id |
| food_source | TEXT | `base` (foods.db), `custom` (custom_foods), `quick` |
| food_id | TEXT NULL | foods.id as text, or custom_foods.id; NULL for quick |
| name | TEXT | snapshot of the name at log time |
| qty | REAL NULL | e.g. 1.5 |
| unit | TEXT NULL | e.g. `katori` |
| grams | REAL NULL | qty × unit grams, computed at log time; NULL for quick |
| oil_level | INTEGER | −1 less, 0 normal, +1 more |
| quick_kcal, quick_protein_g, quick_carb_g, quick_fat_g | REAL NULL | quick add only |
| note | TEXT NULL | optional note from the user |
| batch_id | TEXT NULL | shared by entries created in one action (copy/thali) — used by Undo |
| created_at, updated_at, deleted_at | INTEGER | |

Indexes: (`day`, `deleted_at`), (`food_source`, `food_id`), (`slot_id`, `logged_at`). A day or a
range of days (calendar month, Trends) is one index search on (`day`, `deleted_at`) — checked with
`EXPLAIN QUERY PLAN` in `src/db/user/history.test.ts`.
**No nutrient totals are stored.** Totals are computed from `grams` × the food's per-100 g
values (§5.3).

**`custom_foods`** — foods the user creates, cached barcode products, and recipes.
| Column | Type |
|---|---|
| id | TEXT PK |
| kind | TEXT (`custom`, `product`, `recipe`) |
| name | TEXT |
| brand | TEXT NULL |
| barcode | TEXT NULL UNIQUE (one spelling per packet, §5.13; a deleted product keeps it, and saving the barcode again brings the same row back) |
| serving_g | REAL NULL |
| density_g_per_ml | REAL (default 1.0) |
| cooked_with_fat | INTEGER |
| yield_g | REAL NULL (recipes: total cooked weight) |
| servings | REAL NULL (recipes) |
| off_status | TEXT NULL (`found`, `user_added`, `contributed`) |
| off_fetched_at | INTEGER NULL |
| label_photo_uri | TEXT NULL (photo of the label, in the app's `labels/` folder) |
| shared_food_id | TEXT NULL — set only on a **group food**: a copy of a food someone else in the group shared (= `shared_foods.id`, also this row's id; Stage 11c) |
| NUTRIENTS | REAL NULL, per 100 g (for recipes: recomputed and saved whenever the recipe is saved) |
| created_at, updated_at, deleted_at | INTEGER |
| share_with_group | INTEGER (own foods: *Share with my group* is on; Stage 11c) |
| shared_at | INTEGER NULL (own foods: the `updated_at` of the version the group has; NULL = the group doesn't have it) |
| added_by | TEXT NULL (group foods: the sharer's name in the group) |

**`custom_food_units`** — `id TEXT PK`, `custom_food_id TEXT`, `unit TEXT`,
`label TEXT`, `grams REAL`, `is_default INTEGER`, timestamps.

**`recipe_items`** — `id TEXT PK`, `recipe_id TEXT` (→ custom_foods), `position INTEGER`,
`food_source TEXT` (`base`/`custom`), `food_id TEXT`, `name TEXT`, `qty REAL`,
`unit TEXT`, `grams REAL`, `is_fat INTEGER`, NUTRIENTS (the ingredient's per 100 g when the
recipe was saved: the oil control reads the fat rows, and a recipe still adds up if a food is
deleted), timestamps. Saving a recipe again soft-deletes its old rows and writes new ones.

**`favourites`** — `food_source TEXT`, `food_id TEXT`, `created_at INTEGER`.
PK (`food_source`, `food_id`).

**`my_thalis`** — `id TEXT PK`, `name TEXT`, timestamps.
**`my_thali_items`** — `id TEXT PK`, `thali_id TEXT`, `position INTEGER`,
`food_source TEXT`, `food_id TEXT`, `name TEXT`, `qty REAL`, `unit TEXT`, `grams REAL` (for
`qty`, used if the food loses that unit), `oil_level INTEGER`, timestamps.

**`barcode_queue`** — `barcode TEXT PK`, `scanned_at INTEGER`, `day TEXT`,
`slot_id TEXT NULL` (none when scanned from the Log tab), `status TEXT` (`pending`, `found`,
`not_found`), `custom_food_id TEXT NULL` (the product, once found), `last_try_at INTEGER NULL`.
A row is removed once it is dealt with (opened when found, label saved, or ✕).

**`weights`** — `id TEXT PK`, `day TEXT` (unique while not deleted; a new weigh-in the
same day replaces it), `weight_kg REAL`, `logged_at INTEGER`, timestamps.

**`water_logs`** — `id TEXT PK`, `day TEXT`, `logged_at INTEGER`, `ml INTEGER`, timestamps. Index
(`day`, `deleted_at`). − soft-deletes the day's latest row (migration `0006_water_logs`).

**`weekly_checkins`** — `week_start TEXT PK` (the Monday of the week looked back on), `feeling TEXT NULL`
(`easy`, `okay`, `hard`), `dismissed_at INTEGER NULL`, `created_at INTEGER`.

**`limit_alerts`** — `day TEXT`, `alert TEXT` (`fat`, `sat_fat`, `sugar`, `sodium`),
`fired_at INTEGER` (first time it fired that day — it never fires twice), `dismissed_at INTEGER
NULL` (closed on the Today card). PK (`day`, `alert`).

Recents are not a table: they are the 30 most recent distinct (`food_source`, `food_id`)
in `log_entries` that are not deleted.

### 4.3 Supabase (Stage 11)
SQL lives in `supabase/migrations/` (run in the dashboard's SQL Editor, in name order); see
`supabase/README.md`. The project's region is **Mumbai (ap-south-1)** — the Privacy screen says so.

**Mirror tables (Stage 11a)** — one Postgres table per user.db table, same name and columns, plus
`user_id uuid not null default auth.uid() references auth.users on delete cascade`:
`profile`, `targets`, `settings`, `meal_slots`, `log_entries`, `favourites`, `custom_foods`,
`custom_food_units`, `recipe_items`, `my_thalis`, `my_thali_items`, `weights`, `water_logs`.
Types: text → `text`, real → `double precision`, integer → `bigint`, true/false integers →
`boolean`; times stay epoch milliseconds so a row goes up and comes back unchanged. The primary
key is (`user_id`, the user.db key), so ids never clash between people. Only the primary key and
NOT NULL rules are copied: the phone is the source of truth and checks the rest. Phone-only (not
mirrored): `barcode_queue`, `limit_alerts`, `weekly_checkins`. `src/db/cloud/migrations.test.ts`
fails when a user.db table or column changes without the SQL.

**Row Level Security** on every table: one policy *Only your own rows* — `for all to
authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)`;
`anon` has no rights on them. `supabase/tests/rls.test.sql` proves it with two people.

**`delete_my_account()`** — security definer; deletes the caller (`auth.uid()`) from `auth.users`,
and every table cascades. Callable by `authenticated` only.

*Stage 11b (sync)* adds whatever the upload/download needs (a server-side change time, backups
listing).

**Groups (Stage 11c)** — `supabase/migrations/20260928110000_groups.sql`; only online, not mirrored:
`groups` (id uuid, name 1–40 chars, invite_code 6 chars unique, created_at) · `group_members`
(group_id, user_id, display_name 1–30 chars, joined_at; PK (group_id, user_id), **unique user_id** =
one group per person) · `shared_foods` (id = the sharer's `custom_foods.id`, group_id, created_by,
kind, name, brand, barcode, serving_g, density_g_per_ml, cooked_with_fat, nutrients JSONB per 100 g,
units JSONB, created_at, updated_at = server clock; FK (group_id, created_by) → group_members **on
delete cascade**, so leaving takes your foods with you; removed foods are deleted, not soft-deleted) ·
`shared_food_flags` (shared_food_id, user_id, reason `kcal`/`nutrients`/`name`/`other`, note ≤ 200
chars; PK (shared_food_id, user_id)) · `private.join_attempts` (wrong codes, for the 10-an-hour
limit). No owner column: every member is equal. Nobody writes `groups` or `group_members`
directly: `create_group(group_name, member_name)`, `join_group(code, member_name)` (NULL = no such
code), `leave_group()` and `new_invite_code()` are security-definer functions for `authenticated`
only (errors KG001 already in a group · KG002 too many wrong codes · KG003 full, 50 people · KG004
not in a group). A trigger removes a leaving person's flags and ends a group when its last person
leaves; `custom_foods` gains `share_with_group`, `shared_at`, `added_by` like user.db.
**RLS**: members see their own group, its people, its foods and its flags (`private.my_group_id()`);
only the sharer adds (into their own group), changes or removes a shared food; anyone else in the
group flags it; a person changes or removes their own flag, and the sharer clears flags on their
food; members may change only their own `display_name`; `anon` gets nothing. `rls.test.sql` step 4
proves it with four people (two groups and one outsider), and was checked to fail when any policy,
grant or rule is loosened.

---

## 5. Formulas and rules

All formulas live as **pure functions** in `src/lib/` with unit tests.

### 5.1 Search
1. **Normalise** query and indexed terms: lowercase → trim → remove punctuation →
   `ee`→`i`, `oo`→`u` → collapse repeated letters (`daal`→`dal`, `pappad`→`papad`) →
   `w`→`v`, `ph`→`f` → this is the **phonetic key**.
2. Query `foods_fts` with each token as a prefix, as typed and as its phonetic key
   (`("daal"* OR "dal"*) AND "tadka"*`) against name, synonyms and phonetic keys (up to 500
   candidates, shortest names first). Also look up `search_pins` for the whole query. Queries
   shorter than 2 letters are not searched. `custom_foods` (recipes, products) match when every
   query word begins a word of the name or brand (apostrophes ignored: "moms" → "Mom's rajma");
   they get the same match tiers and come first on a tie (`customFoodMatch`, `mergeByTier`,
   `src/features/foods/searchAll.ts`).
3. If fewer than 5 results: typo pass — also accept index words within Levenshtein distance ≤ 1
   (tokens ≤ 5 letters) or ≤ 2 (longer) of each token or its phonetic key (up to 3 per token,
   closest then most common first); tokens under 3 letters are not corrected.
4. **Rank** (lower is better):
   - **match type**, checked against the food's own names — the name, its "a/b" alternatives
     ("Dal parantha/paratha" → *dal parantha*, *dal paratha*), the Roman Hindi name, and for
     IFCT/USDA the part before the first comma or bracket ("Okra, raw" → *okra*). Words match
     as typed, by phonetic key, or as a plural. The last word may be unfinished.
     pinned 0 · exact 1 · name starts with the query 2 · name has all query words 3 ·
     all words found only among synonyms 4 · starts with, last word unfinished 5 · has all
     words, last unfinished 6 · anything else the index found 7 · found only by the typo pass
     +10 (then matched against the corrected words)
   - personal use: foods logged in the last 30 days first, most often first (counted by
     `countFoodUsesSince`, passed to `rankFoods` and `mergeByTier`)
   - source (custom/product 0 · INDB 1 · IFCT 2 · USDA 3)
   - fewer extra words in the best-matching name → shorter name.
5. Limit 50 results. Target: results in under 100 ms on a mid-range Android phone.
6. **Pins** (`data/curated/search_pins.csv`): for common words whose everyday meaning the rules
   can't know, a hand-picked food comes first — e.g. INDB/IFCT have no plain curd, so *dahi*,
   *curd*, *yogurt* → "Yogurt, plain, whole milk"; *dal*, *daal*, *dhal* → "Mixed dal". A pin
   applies only when the whole query is that term (compared by phonetic key).
7. The search box waits 150 ms after the last key press before searching (debounce).

### 5.2 Unit → grams
```
grams = qty × gramsPerUnit(food, unit)

gramsPerUnit(food, unit):
  1. food_units / custom_food_units row for (food, unit)  → its grams
  2. unit_defaults.grams                                   → that value (g = 1)
  3. unit_defaults.ml × food.density_g_per_ml              → e.g. katori 150 × 1.0 = 150 g
  4. otherwise the unit is not offered for this food
```
Roti sizes: `roti_s` 25 g · `roti_m` 35 g · `roti_l` 50 g (as `food_units` rows on
roti/chapati/phulka/paratha-type foods; parathas get their own larger weights).
`piece` and `slice` are offered only when a food has them.

### 5.3 Nutrients of an entry and of a day
```
entryNutrient(n) = grams / 100 × food[n]  (+ oil delta, §5.5)
quick entries    : kcal / P / C / F from the quick_* columns, other nutrients = none
dayTotal(n)      = Σ entryNutrient(n) over the day's non-deleted entries
```
Label per serving → per 100 g: `per100 = value × 100 / serving_g`.
Per 100 ml (liquids): `per100g = per100ml / density_g_per_ml`.
Implemented in `src/lib/label.ts` (`labelToPer100g`, `productUnits`).

### 5.4 Targets (Mifflin-St Jeor)
```
age      = currentYear − birth_year
BMR      = 10·weight_kg + 6.25·height_cm − 5·age + s
           s = +5 (male), −161 (female), −78 (prefer not to say)
TDEE     = BMR × activity factor
           sedentary 1.2 · light 1.375 · moderate 1.55 · active 1.725 · very_active 1.9
delta    = pace_kg_week × 7700 / 7          (0.25 → 275 kcal, 0.5 → 550 kcal)
kcal     = TDEE − delta (lose) · TDEE (maintain) · TDEE + delta (gain) · NULL (track)
kcal     rounded to the nearest 50
floor    = max(sexFloor, BMR)   sexFloor: male 1500, female 1200, not stated 1200
```
- If `kcal < floor` → show the **floor note**, suggest `floor` rounded **up** to 50, never block.
  Without age/height/weight only the sex floor applies (to a typed calorie number).
- `protein_g = max(kcal × 0.15 / 4, 0.83 × weight_kg)` (0.83 g/kg: ICMR-NIN p. 4)
- `fat_g = kcal × 0.30 / 9`
- `carb_g = (kcal − 4·protein_g − 9·fat_g) / 4` (carbs absorb any protein increase)
- `fibre_g` = ICMR-NIN adequate intake for sex, age and category of work (§3.1), not per kcal
- Round grams to whole numbers. The weight used is the latest from `weights`
  (or the onboarding weight).
- Skipped answers (§2.1): sex → −78 (prefer not to say), activity → 1.2, goal → maintain;
  no age, height or weight → kcal NULL (limits on 2000 kcal, fibre still set). Under 18 → no
  targets at all.
- Implemented in `src/lib/targets/formulas.ts` (`suggestTargets`, `targetsForKcal`, `checkFloor`)
  with 4 worked examples in its tests.

### 5.5 Oil / ghee adjuster
Levels: Less · Normal · More (stored as −1 / 0 / +1). One **step** = what Less → Normal or
Normal → More adds to 100 g of the dish, for energy and the fats only
(`OIL_NUTRIENTS` = energy_kcal, fat_g, sat_fat_g, mufa_g, pufa_g, trans_fat_g, cholesterol_mg).
A logged portion keeps its grams — it is the same katori, with less or more oil in it — so
protein, carbs, fibre, minerals and vitamins never change:
```
entry(n) = grams/100 × per100(n) + level × step(n) × grams/100       (n in OIL_NUTRIENTS)
           never below 0 (Less can't take out more fat than the portion has); unknown stays unknown
```
**Foods with a recipe** (INDB dishes with `recipe_ingredients`, and user recipes) — the recipe's
own oil and ghee, scaled 0.5× / 1× / 1.5×:
```
N_fat(n) = Σ over fat ingredients of grams/100 × fat(n)     (unknown counts as 0)
Y        = yield_g (or Σ ingredient grams if unknown)
step(n)  = 0.5 × N_fat(n) / Y × 100
```
**Foods without a recipe** but `cooked_with_fat = 1` — 5 g of oil per katori-sized 150 g:
```
step(n) = OIL(n) × 5 / 150        (OIL = sunflower oil per 100 g, `GENERIC_OIL`)
```
Implemented in `src/lib/oil.ts` (`recipeOilStep`, `genericOilStep`, `withOilLevel`; used by
`entryNutrients` in `src/lib/nutrition.ts`). Example: Mixed dal (302 g recipe, 9.2 g oil) — 1
katori with More oil = + 2.3 g oil ≈ + 21 kcal. `oilAdjustedPer100` (the per-100 g form, which
also re-weighs the dish) is kept for the build report and the frying-oil fix (§3).

### 5.6 Adherence colour (calendar)
```
entries = non-deleted entries that day;  target = that day's kcal target (§4.2)
away    = (kcal − target) / target
if entries = 0                               → empty     (no fill, "Not logged")
else if entries < 3                          → partial   (light grey, "Partly logged")
else if no target (Just track)               → logged    (soft green, "Logged")
else if today and away < −10%                → partial   (the day isn't over yet)
else if |away| ≤ 10%                         → on target (soft green)
else if |away| ≤ 25%                         → near      (pale blue, "Close to target")
else                                         → far       (deeper blue, "Further from target")
```
Days after today have no colour. Never red. Implemented in `src/lib/adherence.ts`; Trends
averages in `src/lib/history.ts` (`periodStats`).

### 5.7 Streaks and weight trend
Streak (forgiving):
```
A day is "logged" if it has ≥ 1 non-deleted entry (quick add counts).
Walk backwards from yesterday (today counts if already logged; if not, it never breaks the streak).
Week = Monday–Sunday. Each week allows 2 missed days ("free days").
The 3rd missed day in one week ends the streak.
streak = number of logged days in the unbroken run.
freeDaysLeft = 2 − misses so far this week that lie inside the run (a miss counts once a logged
               day comes before it, so a fresh start this week has 2 free days).
```
Implemented in `src/lib/streak.ts` (`forgivingStreak`, `weekStart`). At 0 nothing is shown.
Weight trend (exponential moving average):
```
trend_1 = w_1
trend_i = trend_(i−1) + 0.1 × (w_i − trend_(i−1))   (one step per weigh-in, in date order)
weekly change = (trend_last − trend_ref) × 7 / days(ref → last)
                ref = the latest weigh-in at least 7 days before the last; none yet → not shown
                |change| < 0.05 kg → "steady"
```
Implemented in `src/lib/trend.ts` (`weightTrend`, `weeklyChange`, `trendDirection`).

### 5.8 Logical day and auto slot
```
logicalDay(time) = calendar date of (time − 4 hours)
autoSlot(time)   = first visible slot whose window [start_min, end_min) contains the
                   local minute-of-day (windows may wrap past midnight, e.g. 19:00–04:00);
                   if none matches → the last visible slot
```

### 5.9 Time-of-day suggestions
```
For the current slot, over the last 30 days (days ago 0–29, never future days):
  score(food) = Σ over its entries in that slot of 0.9 ^ (days ago)
Show the top 8 (tie → the food logged most recently). If the user has fewer than 3, fill from
slot_suggestions (skipping foods already shown), up to 8.
Usual amount (what ⊕ logs): the most common qty + unit of that food's entries in that slot;
tie → the one used most recently. Recents use the amount used last time; favourites use their
usual amount over the last 30 days, else the last amount, else the food's default portion.
```
Implemented in `src/lib/suggestions.ts` (`rankSuggestions`, `usualPortion`, `fillSuggestions`).

### 5.10 Micronutrient % and "incomplete data"
```
goal(n)      = need: ICMR-NIN RDA, else adequate intake, for sex/age/activity (§3.1)
               fibre: the day's fibre target (§5.4)
               limit: sodium, sugar, saturated fat → the day's limits (§6)
               none : MUFA, PUFA, trans fat, cholesterol (amount only)
share(n)     = total(n) / goal(n)        (not capped; the bar stops at full)
coverage(n)  = Σ grams of entries whose food has n ≠ NULL / Σ grams of all gram entries
               (1 when no gram entries)
foods        = distinct foods eaten (the same food twice = one; each quick add = one, with no data)
knownFoods   = those with n ≠ NULL                → "based on knownFoods of foods foods"
incomplete   = coverage(n) < 0.8 OR any quick add → "≈", lighter bar, "At least this"
no data      = no food eaten has n                → "No data for the foods eaten", no share, no bar
aboveTUL     = tul(n) exists AND total(n) > tul(n)   (magnesium: never — its TUL is supplements only)
Average      = Σ over the counted days ÷ counted days; counted = logged days, today only once it
               looks finished (the days Trends averages, §2.11); coverage over all their entries
```
**Good sources** (`rankRichFoods`): each `common_foods` food's amount in its portion
(`per100(n) × grams / 100`), unknown or 0 left out, most first, ties by name; with *I eat* =
Vegetarian (or + eggs) those foods come first and the rest only fill up to 5. Shown for needs only.
Implemented in `src/lib/micros.ts` (`coverage`, `isIncomplete`, `shareOf`, `microGoals`,
`microRows`, `rankRichFoods`).

### 5.11 Undo, copy and soft delete
- Every user action that creates or deletes rows records an **undo action** in a Zustand
  store (`src/stores/undo.ts`): the message to show and how to reverse it, for 5 s; a new
  action replaces the old one. Undo removes the created rows for good, or clears `deleted_at`
  on the deleted ones.
- Copy meal/day: new rows with new IDs, same qty/unit/grams/oil_level/note, the target day
  (and slot, for a meal), one shared `batch_id`. `logged_at` = the target day at the same time
  of day when the slot stays the same (a copied day reads like the original), else at the
  target slot's start time. Implemented in `src/lib/copy.ts`.
- Default target: tomorrow when copying today, otherwise today.
- Deleted entries stay restorable from *Recently deleted* (Log tab, §2.10) for 30 days, then the
  purge at app start removes them.

### 5.12 Reminders
All off by default. Switched on at onboarding's last step (*Remind me at meal times* → Breakfast
09:00, Lunch 13:30, Dinner 20:30) or in Profile → Reminders (any visible slot, any time; Snacks
17:00, a custom slot an hour after its window opens). Switching one on asks for notification
permission first; if it's refused the switch stays off with a note. Local notifications only.
```
plan (next 7 days, from now):
  each visible slot switched on, at its time on each logical day
    − skipped if that slot already has an entry that day, or its time has passed
  pending scans nudge (9 pm): only while barcode_queue has rows, and only its next time
  at most 3 a day (earliest kept); the screen lets at most 3 be switched on
Re-plan (cancel Kalorie's scheduled reminders, schedule the plan) on app open, on return to the
front, and after any change to entries, slots, reminder settings or the scan queue.
```
Text: *"Had lunch? Tap to add it — takes 10 seconds."* (custom slot: *"{meal}: tap to add what you
had — takes 10 seconds."*); scans: *"A packet you scanned still needs finishing. Tap to see it."*
Tapping a meal reminder opens Add food for that meal on today; the scans nudge opens Today. A
reminder that comes while Kalorie is open is not shown. Implemented in `src/lib/reminders.ts`
(`planReminders`) and `src/features/reminders/` (`schedule.ts`, `ReminderEffects.tsx`).

### 5.13 Barcode (Open Food Facts)
Barcodes (`src/lib/barcode.ts`): EAN-13, EAN-8, UPC-A, UPC-E; GS1 check digit (weights 3, 1, 3, 1…
from the right). One spelling per packet: UPC-A → `0` + UPC-A (its EAN-13); UPC-E → written out as
UPC-A first. Typed codes: spaces and dashes ignored; 8 digits = EAN-8, else UPC-E.

`GET https://world.openfoodfacts.org/api/v2/product/{code}.json?fields=code,product_name,product_name_en,brands,nutriments,serving_size,serving_quantity,serving_quantity_unit,quantity,product_quantity,product_quantity_unit`
with header `User-Agent: Kalorie/<version> (<contact>)` — version from app.json, contact from
app.json `extra.contactEmail` (the app ID `com.mynklabs.kalorie` while it is empty). 10 s timeout.
HTTP 404 or `status: 0` = not found; no answer or any other error = offline (queued).
Map `nutriments.<name>_100g` (all in **grams**; `_serving` × 100 / serving grams when there is no
`_100g`) to §3 columns: energy-kcal (else energy-kj or energy ÷ 4.184, else 4/4/9 from macros),
proteins, carbohydrates (as labelled), sugars, fat, saturated-/mono-/polyunsaturated-/trans-fat,
fiber, cholesterol, sodium (else salt × 0.4) and minerals × 1000 → mg, selenium / iodine /
vitamin A, D, K, B9, B12, biotin × 10⁶ → µg, other vitamins × 1000 → mg. Drinks (ml, cl, l) are
per 100 ml, stored as per 100 g (density 1) with an `ml` unit. Numbers that can't be real (no
energy, > 950 kcal per 100 g, protein + carbs + fat > 105 g) → the label form instead.
Cache as `custom_foods` kind `product` (`off_status = found`). Queue retries run on app open,
whenever the app comes back to the front, on pull to refresh on Today and with *Try again now*.
Implemented in `src/lib/off.ts` (mapping, tests with saved answers in `src/lib/testdata/off/`) and
`src/features/barcode/lookup.ts`. Show the OFF attribution (ODbL) in About.

### 5.14 CSV export
Profile → Export CSV. Range: Last 7 / 30 / 90 days (today included), Everything (from the first
day with an entry, water or a weigh-in) or two picked dates (in order, never after today). Four
files, each with its own *Share* button (the share sheet takes one file; expo-sharing), named
`kalorie_<file>_<from>_to_<to>.csv`:
- `entries` — day, time (24 h), meal, food, qty, unit (words), grams, kcal, protein_g, carb_g, fat_g
- `daily` — day, kcal, protein_g, carb_g, fat_g, fibre_g, sugar_g, sat_fat_g, sodium_mg, water_ml,
  weight_kg, target_kcal; one row per day with entries, water or a weigh-in
- `weight` — day, weight_kg, trend_kg (the §5.7 trend, over all weigh-ins)
- `water` — day, time, ml (one row per glass)

UTF-8 with a byte-order mark, CRLF, plain numbers (no thousands separators; kcal whole, grams one
decimal), **unknown = empty cell, never 0**; text that starts like a formula gets a leading `'`.
Implemented in `src/lib/csv.ts`, `src/lib/export.ts` (+ tests) and `src/features/export/`.

---

## 6. Alert rules

Limits (defaults, all editable in Goals):
| Alert | Default limit | Basis |
|---|---|---|
| Sodium | 2000 mg / day (≈ 5 g salt) | WHO / ICMR-NIN (short report pp. 6, 16) |
| Sugar (total sugars) | 10% of kcal target ÷ 4 (50 g at 2000 kcal) | WHO upper limit; our data has total, not added sugar |
| Saturated fat | 10% of kcal target ÷ 9 (22 g at 2000 kcal) | WHO / ICMR-NIN |
| Total fat | 30% of kcal target ÷ 9 (67 g at 2000 kcal) | ICMR-NIN |

In Just-track mode, percentage limits use 2000 kcal as the base.

Rules:
1. An alert **fires** when `dayTotal ≥ 100%` of its limit, for **today only** — once per
   nutrient per day (`limit_alerts`), even if the total dips under and crosses again. No
   pop-ups, no sounds. Implemented in `src/lib/alerts.ts` + `src/features/alerts/`.
2. All crossed limits are listed on **one card** on Today (under the ring), soft amber accent,
   amounts kept live, with a ✕ that closes them for the day.
3. Each alert can be switched off in Goals → Daily limits.
4. Wording is neutral and names a gentle next step, never blame: *"Fat is 12 g above today's
   limit."* (*"… has reached today's limit."* at exactly 100%) + *"A lighter next meal balances it
   out."*
4b. **Phone notification** — optional, **off by default** (Goals → *Also send a phone
   notification*, which asks for permission). A local notification with the same line, sent when
   an alert fires, so at most once per nutrient per day. Nothing is sent to a server.
5. Micronutrient **TUL**: a neutral note on the Micronutrients screen only:
   *"Above the safe upper level. This usually comes from supplements or fortified
   foods — worth a look at the label."*
6. **Floor note** (target below safe floor): shown on onboarding step 4 and Goals:
   *"This is lower than we'd suggest ({floor} kcal). Eating this little for long can be
   hard on your body — please check with a doctor. You can still keep it."*
7. Under 18: *"Kalorie's targets are made for adults, so we'll skip them. You can still
   log what you eat."*

---

## 7. Wording rules

1. **No guilt, no judgement.** Never use: *bad, cheat, junk, guilty, failed, over budget,
   exceeded, warning, blew it, sin, naughty, damage*.
2. Say **"more than planned"** / **"above your target"** instead of "over".
3. Partial days are fine: *"Partly logged — that still counts."* Missed days get **no
   message at all**.
4. Streak breaks are soft: *"Fresh start today."* — never "You lost your streak".
5. Talk about **patterns over the week**, not single meals.
6. Short sentences, everyday words, second person ("you"). No exclamation marks in
   anything about body weight or limits.
7. Numbers: kcal as whole numbers with thousands separators (1,840); grams whole
   (under 10 g: one decimal); weight one decimal.
8. Food names are never labelled good or bad. No food gets a colour grade.
9. Every string lives in `src/i18n/en.json` — none written directly in components.

## 8. Visual rules

### 8.1 Colour
- **Base is monochrome**: near-white / near-black backgrounds, neutral greys for
  surfaces, borders and secondary text. Most of the screen is black, white and grey.
- **Accent colours only where they carry meaning**, muted, each with light and dark variants:
  protein = indigo · carbs = wheat/ochre · fat = teal · fibre = olive ·
  water = sky blue · weight = violet · on track = soft green · off target = soft blue ·
  notice = soft amber · partial = light grey. Calendar days use soft tints of these behind the
  number (`onTargetFill`, `nearFill`, `farFill`, `partialFill`), so the number stays readable.
- **No red anywhere** for being above a target or limit. Delete confirmations use neutral
  text, not red.
- All colours come from theme tokens in `src/theme/`; both themes pass WCAG AA contrast
  for text.

### 8.2 Layout
Minimum tap target 48 dp. Logging a known food takes ≤ 3 taps from Today
(+ Add → tap food → Log). Everything should be reachable with one thumb.

### 8.3 Hide-numbers mode
Hides kcal, grams, percentages and weight values everywhere (Today, Log, Trends,
Micros, portion sheet). Keeps ring/pie shapes, bars and the calendar colours.
The ring shows words instead:
| Share of target | Words |
|---|---|
| < 25% | Just getting started |
| 25–60% | About halfway |
| 60–90% | Nearly there |
| 90–110% | Around your target |
| > 110% | A bit more than planned |
Portions still show units ("1 katori"). Weight shows direction only ("trending down").
The same bands label the macro bars, Trends macro averages and vitamin/mineral bars; for a daily
need the top two read "Around your daily need" / "More than your daily need", for a limit "Around
your daily limit" / "Above your daily limit" (`src/lib/bands.ts`, `src/i18n/bands.ts`). Screens
where numbers are typed (Goals, onboarding, recipe builder, label form, weigh-in sheet) keep them.

### 8.4 Weekly check-in card
Shown on Today (today only) from Monday 4 am until ✕, about last week (Monday–Sunday); no card when
nothing was logged last week. Contents: days logged ("5 of 7 days logged"), average kcal vs target
over the logged days (hidden in hide-numbers mode), **best day** (closest to its target among days
with 3+ entries, else among all logged days; Just track: the most logged; tie → later day), weight
trend direction (once there's a week of weigh-ins), one encouraging line (every day / most days /
some days), **one suggestion**, and optional *"How did last week feel?"* → Easy · Okay · Hard (saved
to `weekly_checkins`). If "Hard": *"Want gentler targets? You can change them in Goals."*
```
suggestion:
  logged days < 3                    → "Logging on a few more days … one meal a day counts."
  nutrients = protein (vs target), iron, calcium, fibre (vs target), B12, folate, vitamin C
    share = weekly average ÷ need;  trusted = coverage ≥ 80% AND quick-add kcal ≤ 20% of the week
  lowest trusted share < 75%         → "Iron averaged 48% of your daily need. Two easy adds:
                                        Rajma (1 katori) or Spinach (1 katori)."
                                        (2 common_foods richest in it, matching I eat, new first)
  else water average < 75% of goal   → "Water averaged 1,250 of 2,000 ml a day. …"
  else                               → "Nothing stands out. Keep doing what you're doing."
```
Implemented in `src/lib/checkin.ts` (`reviewedWeek`, `bestDay`, `pickSuggestion`, `foodIdeas`) and
`src/features/habits/`.

---

## 9. Data sources and licences
Details, versions, citations and open questions: `data/SOURCES.md`.
- **INDB** (Indian Nutrient Databank, Anuvaad) — dishes `data/raw/Anuvaad_INDB_2024.11.xlsx`,
  recipes `data/raw/recipes.xlsx`. Open access, but **no licence is stated**: confirm with
  Anuvaad before the public release.
- **IFCT 2017** (NIN, Hyderabad) — via the `@ifct2017/compositions` npm package, pinned to
  2.0.9 (MIT; the `ifct2017` package became AGPL-3.0 in 2.1.0). The MIT licence covers the
  package's code; **the numbers are © ICMR-NIN** — ask NIN together with the requirement tables.
- **USDA FoodData Central** — Foundation Foods + SR Legacy CSV folders in `data/raw/`.
  Public domain (CC0); credit USDA ARS.
- **Open Food Facts** — live lookups; ODbL — attribution required (About screen and every
  product). Products shared to a group (Stage 11c) stay ODbL; the About screen's credit covers them.
- **ICMR-NIN 2020** requirement tables — typed into `src/lib/targets/icmr.ts`; written permission
  to be asked (same letter as IFCT).
- Code libraries: all permissive (MIT / ISC / Apache-2.0 / BSD), checked 2026-09-28.
- Every permission above is answered before the public Play Store release (Stage 12).
