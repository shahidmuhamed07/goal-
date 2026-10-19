# Progress Tracker

> The living record of what Goal Path can do, what changed, and what is known to be wrong.
> **Update this file with every feature, fix or notable change** — in the same change/PR. Humans and AI agents both follow these rules.

## How to update this file

1. **Add a changelog entry** (newest first, under "Changelog") for every change that alters behaviour, UI, data model, rules, config, dependencies or docs. Use the template below. Typos and pure refactors with no visible effect can be one line.
2. **Update "Feature status"** if a feature was added, finished, changed or removed.
3. **Update "Known issues"**: add what you discover, delete what you fix (move it into the changelog entry as "Fixed").
4. If the change touches something described in another `context/` file, update that file too and list it under **Docs updated**.
5. Use absolute dates (`YYYY-MM-DD`). Reference the commit hash once it exists (`abc1234`), or `(uncommitted)` until then.
6. State what was **verified** and how (lint, build, manual test, two-account test). Say "not verified" when it wasn't.

### Entry template

```
### YYYY-MM-DD — Short title  (abc1234)
- **Type:** feature | fix | ui | data-model | rules | config | docs | refactor | chore
- **What & why:** one or two sentences — the user-visible effect and the reason.
- **Files:** main files touched.
- **Data/rules impact:** none | describe (and whether rules were deployed).
- **Verified:** lint ✓/✗ · build ✓/✗ · manual (phone + desktop) ✓/✗ · two-account ✓/✗ · notes.
- **Docs updated:** which context/*.md files.
```

---

## Current status (as of 2026-10-11, `main` @ `1e75ab7`)

- The app is a working single-page product: planning, collaboration, chat, streaks, phone-first navigation.
- Last development activity (2026-09-29) was a UI polish pass: phone tab bar, profile actions, leave-professional flow.
- Uncommitted on top of `main`: the Google sign-in fix and the **uniform design + goal editing flow + weekly routines** change (see the changelog). Neither has been committed, pushed or deployed.
- **2026-10-18, on branch `feature/mongo-data` (not merged yet):** goals, profiles, connections and chat no longer use Firestore. Firebase is for login only; the app talks to our API and MongoDB (see the changelog). Production `main` still runs the old Firestore version until this is merged.
- `npm run lint` passes. Tests: API 90 (permission rules for people's data included), web 74 (pure logic).
- Production = `main` (web on Firebase Hosting, API on Render, both auto-deploy).
- Unreviewed: remote branch `origin/fix/collaborator-edit-permissions` (name suggests permission work; contents and merge state not examined).

## Feature status

Legend: ✅ shipped · 🟡 shipped with caveats · ⬜ not present

| Area | Feature | Status | Notes |
|---|---|---|---|
| Auth | Google sign-in (popup → redirect fallback) | ✅ | |
| Auth | Email/password sign-up, sign-in, reset | ✅ | Needs Email/Password enabled in Firebase console |
| Onboarding | Guided first-run questions that build starter goals and weekly routines | 🟡 | Real-database write not yet tested with a brand-new account; persona itself is descriptive only |
| Goals | Create goal (1–24 months, presets or custom category) | ✅ | |
| Goals | Dashboard: stats, search, category filter, cards | ✅ | |
| Goals | Edit title/category/description; give-up flow; extend timeline | ✅ | Give-up permanently deletes the goal |
| Planning | Monthly milestones (auto-generated, editable notes) | ✅ | |
| Planning | Daily tasks by date, grouped into per-day subcategories | ✅ | Edits rewrite whole arrays (last write wins) |
| Planning | Guided editing flow on the goal page (pick a day on a week strip → plan it) | ✅ | Desktop first; phone is usable but not yet polished |
| Planning | Weekly routines (repeat a subcategory on chosen weekdays until the goal ends) | 🟡 | Logic and UI verified; the new Firestore writes were **not** exercised against the real database. Routines don't follow a goal that is extended later |
| Planning | Category quick picks in the add form | ✅ | 4 shown (recent names, then the category's routines). Starter-task suggestions were removed on purpose |
| Planning | Today's Focus across all goals | ✅ | |
| Engagement | Daily streak (current / longest / at-risk) | 🟡 | Counts the *scheduled* date of completed tasks (see Known issues #2). "Today" is now the person's own local day |
| Planning | Missed from earlier (Today screen): move to today or skip | ✅ | Last 14 days, goals the person can edit. Logic tested; **not** clicked through while signed in |
| Content | Popups and pages from the admin shown in the app | 🟡 | Popup on start (once / daily / every visit), banner and popup buttons to `/pages/x` open the page in a dialog. Logic and API tested; **not** seen in the signed-in app |
| Collaboration | Connection code, access requests, approve/deny with per-goal view/edit | ✅ | |
| Collaboration | Professional roster, workspace switcher, client workspace | ✅ | |
| Collaboration | Per-subcategory role tags | 🟡 | UI-only restriction, not enforced by rules |
| Collaboration | Remove professional (client) / remove client (professional) / leave professional mode | ✅ | Immediate on both sides since 2026-10-18 (server-side) |
| Collaboration | Professional public profile (qualifications, work, contact) | ✅ | Links, no file uploads |
| Collaboration | In-app chat with unread badges | 🟡 | Only between connected people (server-enforced). Refreshes every 3 s while open (polling); history unpaginated |
| Shell | Phone floating tab bar + centred "+" | ✅ | |
| Shell | Swipe navigation between tabs | ✅ | |
| Shell | Back-button handling, double-back to exit | ✅ | |
| Shell | Branded loader, Lovi-style pastel theme, reduced-motion support | ✅ | |
| Platform | CI deploy to Firebase Hosting on push to `main`; Render deploys the API | ✅ | Needs an outside pinger so the free Render API does not sleep (README) |
| Platform | Automated tests | 🟡 | API (permissions, content) and the web app's pure logic; no browser/UI tests |
| Platform | AI/Gemini features | ⬜ | SDK listed in `package.json`, never used |
| Platform | Notifications (push/email) | ⬜ | |

## Known issues & tech debt

Found by reading the code on 2026-10-11; none of these have been reproduced unless stated. Delete an item when it is fixed.

**Correctness**
1. *(Fixed 2026-10-18: `getTodayDateString()` now returns the local date. See the changelog.)*
2. **Streak semantics.** `computeStreak` counts `task.date` of completed tasks; tasks have no completion timestamp. Checking off yesterday's task today credits yesterday.
3. **Concurrent edits overwrite.** Tasks/milestones/subcategories are written as whole arrays from local state; a client and a professional editing the same goal at once can lose changes.

**Security (details in [backend-rules.md §7](backend-rules.md))**
5. Subcategory `editorRole` is not enforced by the server (UI-only).
6. The app now polls `/overview` every 10 s with whole goals; a "what changed" answer (ETag or `since`) will be needed for large accounts.
7. The API's per-user limits are in memory (single instance).

**Maintainability**
9. `App.tsx` is ~3,550 lines (state, listeners, 28 `handle…` functions, three full views). Natural extraction points: Goals/Today/Detail views, a `useGoals`/`useCollaboration` hook layer, the navigation/swipe logic.
10. `tsconfig.json` is not `strict`.
11. No tests in the repo and no formatter/linter config. The weekly-routine logic (`src/recurrence.ts`) was checked with a throwaway script outside the repo; it would be worth adding a real test runner and moving those checks in.
12. Dead code already in `App.tsx` (found with `tsc --noUnusedLocals`): unused imports `Trash2`, `getGoalAccessLevel`, `GlassBadge` and unused `setDailyMasterDate`, `canViewGoal`, `masterMonthDays`, `masterDateTasks`, `masterTasksByDate`.
12a. `src/categoryPresets.ts` still carries fields nothing reads any more: `suggestedTasks`, `contextDescription`, `presetGroupLabel`, `placeholder`, `accentColor`.

**Template / repo leftovers**
13. `package.json` name `react-example`; unused deps `express`, `dotenv`, `tsx`, `esbuild`, `@types/express`, `@google/genai`; `clean` script references a non-existent `server.js`.
14. `.env.example` and `metadata.json` describe the AI Studio origin (Gemini) — unused.
15. `bun.lock` alongside `package-lock.json` (CI uses npm).
16. `.claude/shahid.js/bro`, `bro2` are junk files from PR experiments; `assets/.aistudio/.gitignore` is an AI Studio artifact.
17. *(Fixed 2026-10-18: `firebase-blueprint.json` and `firestore.rules` were removed with Firestore.)*
18. `.vscode/launch.json` (untracked) points Chrome at port 8080; the dev server runs on 3000.

**UI polish**
19. Top bar in a client workspace always says "Trainer Mode", even for Dietitian/Doctor.
20. A native `<select>` is still used for the role picker in `CollaboratorsPanel` while `AppSelect` exists.
20a. Older screens (Goals cards, header, a few panels) still colour owner vs professional with `isOwner` ternaries instead of the new tone variables; they look right but the pattern should not spread.
21. Tailwind class names (`emerald`, `violet`, `blue`) no longer match the colours they render; documented in [ui-context.md](ui-context.md) but easy to trip over.

## Open questions for the owner

(Not decisions — things the docs could not determine from the code.)

- Delete the now-unused Firestore database in the Firebase console (Build → Firestore → Delete database) once the new version is live and working.
- Is anything planned for the Gemini/AI dependency, or should it be removed?
- Should `Staging/testing` be a formal staging channel (separate Hosting channel/project) or just a working branch?
- Should the leftover template files/dependencies (items 13–16) be cleaned up?
- What is in `origin/fix/collaborator-edit-permissions` and is it still needed?

---

## Changelog

### 2026-10-19 — Programs: every week new, written by the AI week by week; steps under tasks; fitness exercise menu  (branch `feature/ai-planner`)
- **Type:** feature
- **What & why:** Requested by the owner so the AI plans are not the same week repeated. (1) **Program goals:** with the AI on, "Help me plan" creates a goal whose weeks are all different. At creation the AI writes a one-line **outline** of the first weeks and **week 1 in full** (each chosen day is its own session); each later week is written when it is about to start (Today shows "Plan week 2"), using the outline and which tasks were finished or skipped the week before (a rough week gets an easier next one). Sessions are ordinary dated days, so everything on the goal page works as before. (2) **Fitness is menu-guided:** `exerciseMenu.ts` holds about 55 real exercises with written "how" lines; the person's place, level and limits decide which names the AI may use, and the server drops anything else. The app adds the warm up and cool down. New fixed questions: how to split training (you decide, full body, upper and lower, push-pull-legs) and a "No pain or limits" choice. (3) **Steps:** tasks may carry up to 4 short "how" lines, shown under the task behind a closed "How" button (goal page and Today). (4) Per-area instructions to the AI live in `AREA_NOTES` (`planAi.ts`).
- **Files:** new `apps/web/src/{exerciseMenu,program}.ts` + tests, `components/NextWeekCard.tsx`; edited `apps/api/src/{planAi,planAi.test,userSchemas,userRoutes}.ts`, `packages/shared/src/app.ts` (`TaskItem.steps`, `GoalProgram`), `apps/web/src/{App,guidedGoal,fitnessPlan,starterPlan,types}.ts(x)`, `api/appApi.ts`, `components/{GuidedGoal,SubcategoryBlock}.tsx`.
- **Data/rules impact:** goals may store `program` and tasks may store `steps` (validated, owner-only for `program`). Old goals unchanged. Goal size: week 1 only is written at creation, so the plan grows slowly.
- **Verified:** API tests 111/111 · web tests 154/154 · tsc ✓ · build ✓. In a throwaway harness (phone size, in-memory API, **a made-up AI, not the real Gemini**): Fitness → muscle → gym → beginner → split → no limits → one AI follow-up → week → preview with the month in brief and 3 sessions with warm up and cool down → created; "How" opens the written steps; with the start date moved back, Today showed "Plan week 2", and one tap wrote week 2 on new dates with no repeat series. **Not verified:** the real Gemini (plan quality, speed of the longer answer, that `gemini-2.5-flash` is free for the key); non-fitness areas end to end in the browser (covered by server tests); the day-one case where today is not one of the chosen days (the first session is then the next chosen day); "Push my plan" on program goals (not offered: it only works on repeating routines); editing steps (view only).
- **Docs updated:** `architecture.md`, `backend-rules.md`, `ui-context.md`.

### 2026-10-19 — AI planner (Gemini) for "Help me plan", simpler plan screen, one-week web card, today block on phone cards  (branch `feature/ai-planner`)
- **Type:** feature + simplification
- **What & why:** Requested by the owner: keep the app minimal and let an AI make the planning decisions, only while a goal is being made. (1) **AI planner:** new `POST /api/plan` on our API calls the free Google Gemini service (key `GEMINI_API_KEY` set on Render; model `GEMINI_MODEL`, default `gemini-2.5-flash`). Flow: the person picks an area and answers our fixed questions; then the AI is sent only those answers and returns 2 or 3 follow-up questions (tap options plus "Something else"); after the week step the AI writes the starter plan, shown on our own screen. If the AI is off, offline, slow (22 s), out of free quota or answers badly, the app silently uses its fixed questions and rules, so nothing breaks. The server checks every AI answer against a strict shape and cleans it, never sends name, email or account to the AI, treats typed text as data, and limits use (8 a minute and 30 a day per person, 900 a day in all). (2) **Simpler plan screen:** the routine editor, "Add a routine", reordering and per-routine options are gone from the guided preview (`RoutineEditor.tsx` deleted); the plan is shown read-only (goal name still editable), and everything is editable on the goal page after creating. (3) **Web goal card:** one week at a time: seven day keys and, under them, up to 4 planned days each with up to 2 routine names as chips and "+ N". (4) **Phone goal card:** larger description and a "Today" block with up to 3 of today's tasks; dots removed (from the earlier `feature/main-areas` work, which is not merged: its three-areas screen and fitness height/weight intake were dropped).
- **Files:** new `apps/api/src/planAi.ts`, `planAi.test.ts`, `apps/web/src/goalPreview.ts` + test; edited `apps/api/src/{app,env,server,userRoutes}.ts`, `.env.example`, `apps/web/src/{App.tsx,guidedGoal.ts,guidedGoal.test.ts,api/appApi.ts}`, `components/{GuidedGoal,GoalCard}.tsx`; deleted `components/RoutineEditor.tsx`.
- **Data/rules impact:** none stored. New route needs a login. New secret `GEMINI_API_KEY` (Render environment only). "Push my plan" and routine days/alternate weeks still exist on Today and on the goal page; only the editor inside Help me plan was removed.
- **Verified:** API tests 107/107 · web tests 141/141 · tsc ✓. In a throwaway harness (phone and laptop sizes, in-memory API, **a made-up AI, not the real Gemini**): Career → 3 of our questions → 2 AI follow-ups with tap options → week → read-only AI plan (3 routines on Mon/Wed/Fri) → created; the laptop card showed "This week" with Mon 19 / Wed 21 / Fri 23 and their routine chips; with the AI simulated as down, the flow skipped the follow-ups and produced the rules-based plan. **Not verified:** the real Gemini call (the key is only on Render; check the Render log for `AI planner: <model>` at start and `AI planner (...) failed:` lines), the model name `gemini-2.5-flash` being free for this key, phone card tick/tap, real sign-in. The first-run welcome still uses the older multi-question flow (unchanged).
- **Docs updated:** `architecture.md`, `backend-rules.md`, `ui-context.md`.

### 2026-10-19 — First-run questions: one goal, no age question; a new plan has work on its first day  (branch `feature/speed`)
- **Type:** fix + simplification
- **What & why:** Three things reported by the owner. (1) **One goal to start:** the first question ("What do you want to work on?") let people pick several goals; it is now a single choice ("Pick one to start. You can add more goals later."), so the plan is built around one goal with up to three routines. (2) **The age question is gone:** it was never used to shape the plan (it was only stored), so asking it was a wasted step. (3) **Work on the first day:** a new plan only wrote routines on the chosen weekdays, so if it was created on any other day, Today and the goal page showed nothing for that day. Now, when the first day is not a chosen weekday, the first routine is placed on that day too, once (a one-off day, not a new routine), so the person sees work straight away. This applies to both the first-run questions and Help me plan (`materializePlan(..., { startToday: true })`).
- **Files:** `apps/web/src/components/Onboarding.tsx`, `starterPlan.ts` (`startToday`, `AGE_OPTIONS` removed), `App.tsx`, `guidedGoal.test.ts` (4 new checks).
- **Data/rules impact:** none. New accounts no longer store `onboarding.age`.
- **Verified:** lint ✓ · build ✓ · web tests 132/132 ✓ · in a throwaway harness (real app on a phone-sized browser, in-memory API, made-up login; deleted): picking a second focus replaced the first; the questions went focus → activity with no age step; creating a plan with Tuesday and Thursday on a Monday saved "Push day" on Monday as a one-off with its three tasks, and the goal page showed "0/3 done" for that day. **Not verified:** the age question can be brought back with age bands (Under 18, 18-24, 25-34...) if it is wanted for something; a real sign-in; the other first-run screens beyond the ones walked through.
- **Docs updated:** `architecture.md`, `ui-context.md`.

### 2026-10-19 — Run the app and the API together locally  (branch `feature/speed`)
- **Type:** dev tooling + fix
- **What & why:** On the owner's computer the page at localhost:3000 stayed on its loading screen. Cause: since goals moved to the API, the app needs the API running (port 3002), and only the app was started. New root commands: **`npm run dev:all`** starts the API and the app together (output tagged `[api]` and `[web]`, Ctrl+C stops both; `scripts/dev-all.mjs`, no new dependency) and **`npm run dev:api`** starts only the API. Locally the API now uses its own database, **`goalpath_dev`**, instead of the live `goalpath`, so trying things out can never touch real accounts, goals or chats (use `MONGODB_DB=goalpath npm run dev:api` to choose another). The loading screen, on a local run only, now says "Cannot reach the API at http://localhost:3002. Start it with `npm run dev:api`…". The preview's `api` launch config uses `dev:api`. If the API's port is already taken (the usual start-up problem: another copy is running), it now says so in plain words and how to fix it instead of printing a crash trace.
- **Files:** `package.json`, `scripts/dev-all.mjs`, `apps/web/src/App.tsx`, `.claude/launch.json`, `README.md`.
- **Data/rules impact:** none for the live system; local runs now write to `goalpath_dev` in the same Atlas cluster.
- **Verified:** lint ✓ · build ✓ · the local API started with `dev:api` on port 3002 using `goalpath_dev`, answered `/health`, refused `/api/overview` without login (401) and allowed `http://localhost:3000`; the app at localhost:3000 then reached it (health and live content requests answered). **Not verified:** `npm run dev:all` start to finish (its ports were already in use here; only the script's syntax and process wiring were checked), a real sign-in on localhost.
- **Docs updated:** `README.md`.

### 2026-10-19 — Speed: the app opens on saved data, wakes the server early, loads less  (branch `feature/speed`)
- **Type:** performance
- **What & why:** Measured on the live site: the first request took **31.8 s** (the Render free server was asleep), later ones 0.4 to 0.8 s. The GitHub "keep awake" job ran only every 2 to 4 hours, not every 10 minutes (GitHub delays scheduled jobs), so it could not help; it was **removed**. The real cure is an outside uptime service pinging `/health` every 5 minutes (setup steps are in the README; free), or the paid Render plan. In the app and server: (1) **wake on open**: the page asks `/health` the moment it loads, before sign-in, so the server wakes while the person signs in; (2) **no more waiting in line**: the overview is asked for at the same time as account setup instead of after it (only a brand-new account still waits for setup); (3) **opens on the last saved view**: the last overview is kept on the device (one key per account, removed on sign-out) and shown at once with a small "Showing your last saved view. Connecting…" note until the server answers; the server's answer always replaces it; (4) the "Waking up the server…" note now appears after 4 s of silence (before, it appeared only after a failure, which a slow wake never produces); (5) `/overview` is sent as `private, no-cache` with an ETag, so a refresh with nothing new is a tiny "not modified"; (6) the server asks for its 9 database indexes together (one round trip) instead of one by one at every start; (7) rarely used screens (guided plan, first-run questions, chat, Connect, profiles, the give-up and assign windows) are loaded when first opened, and React and Firebase are separate cached files. Cloudflare in front of Render already compresses the API's answers, so no compression was added.
- **Files:** `apps/web/src/{App,main}.tsx`, `apps/web/src/api/{wake,overviewCache}.ts`, `apps/web/vite.config.ts`, `apps/api/src/{userRoutes,mongoStore}.ts`, removed `.github/workflows/keep-api-awake.yml`.
- **Data/rules impact:** none. The saved picture holds the same data the app already shows, in the browser's own storage, and is cleared on sign-out.
- **Verified:** lint ✓ · build ✓ · API tests 91/91 ✓ (new: not-modified replies, headers) · web tests ✓ (new: the saved picture is per account, versioned, size-limited, cleared on sign-out, harmless when storage is blocked) · in a throwaway harness (real app, in-memory API, made-up login; deleted): lazy screens (Connect, Help me plan) load; with the API stopped the app opened at once on the saved view with the "Connecting…" note; when the API came back (empty, so the account had to be created first) the note went and the saved goal was replaced by the server's answer. Bundle: first load went from one 695 KB file (185 KB compressed) to 402 KB of app code (121 KB compressed) plus cached React and Firebase files, with about 135 KB loaded only when needed. **Not verified:** the real cold start on Render (needs the pinger or the paid plan to compare), phones on a slow network, and the effect of the Render and Atlas regions.
- **Left to you:** set up the free pinger (README), and check the Render service region and the Atlas cluster region are the same and near your users.
- **Docs updated:** `README.md`, `architecture.md`, `backend-rules.md`.

### 2026-10-19 — Fitness in "Help me plan": a real framework, more choices  (branch `feature/guided-plan-editing`)
- **Type:** feature
- **What & why:** Fitness answers now shape the plan properly instead of choosing among three fixed splits. **Questions** (4, all with 4 or more choices): the aim (Build muscle, Get stronger, Lose fat, Build stamina, Move better, Stay active and healthy, or something else), where you train (gym, home with no equipment, home with dumbbells or bands, outdoors), experience (Beginner, Coming back, Some, Experienced) and, optional, anything to work around (sore knees, lower back, shoulders, easily out of breath). **The week follows the number of training days:** 1 to 2 days full body; 3 days full body for beginners or push/pull/legs for others; 4 days upper/lower alternating; 5 days five different sessions; 6 days push/pull/legs twice; 7 days adds an active-recovery session. Fat loss mixes strength with intervals and cardio, stamina is mostly cardio with some strength, "move better" is all mobility, "stay active" is a bit of everything. **The exercises depend on the place** (barbell and machines at the gym, push-ups and table rows at home, dumbbell presses and rows with equipment, pull-ups and bar work outdoors), **the doses on the level** ("3 sets of 8", "start light", longer holds, heavier low reps for a strength aim), **and the number of exercises on the session time** (15 min: 3, 30: 4, 45: 5, 60: 6, plus warm up and stretch; no time given means 30). Limits swap in gentler exercises (no running or lunges for sore knees, no deadlifts for a bad back, no overhead pressing for shoulders, shorter and easier cardio when out of breath). The plan's description says when to train and when to rest ("Train on Mon · Wed · Fri. Rest on Tue · Thu · Sat · Sun: an easy walk, a stretch and good sleep") and now shows on the last screen. Engine: a niche can now receive the days and time and say its routines are already sized to them (`sized`); the routine limit went from 4 to 6.
- **Files:** `apps/web/src/fitnessPlan.ts` (new) + `fitnessPlan.test.ts` (new, including about 17,000 combinations), `guidedGoal.ts` (fitness questions, `plan(answers, common)`, `sized`), `components/GuidedGoal.tsx` (description on the last screen), `guidedGoal.test.ts`.
- **Data/rules impact:** none.
- **Verified:** lint ✓ · build ✓ · web tests 122/122 ✓ · walked through in a throwaway harness (real app on a phone-sized browser, made-up login, deleted): all four questions with their choices, the week screen with four days and 45 minutes, and the last screen with a dumbbell, lose-fat, coming-back, sore-knees plan. **Not verified:** the exercise choices by a trainer (they are sensible defaults, not coaching advice), the other niches (Career, Business, Health, Money, Learning, Something else are unchanged; four questions there still have only 3 choices: Health "meals", Money "now", Learning "level", Something else "help"), a real phone.
- **Docs updated:** `architecture.md` (source map).

### 2026-10-18 — Guided plan: optional time and editable routines; push the plan after missed days  (branch `feature/guided-plan-editing`)
- **Type:** feature
- **What & why:** Three changes asked for by the user. (1) **Help me plan, "Plan your week":** the time for each session is now optional. It starts as one chip, "Add a time for each session (optional)"; only people who tap it see the 15/30/45/60 choices (with "Remove time"). Without a time the plan uses a normal amount of tasks (30 minutes' worth). (2) **"Here is a starting point" can be edited** without touching the quick path: each routine has **Edit** (name, the days it happens on, *every week* or *every other week*, its tasks with add and remove, move up/down, remove) and **Included**; **Add a routine** adds a new one. Leaving a day out skips it every week. The result is saved with the routine's `everyWeeks` (every other week is written as `repeatEvery: 2`). A routine needs a name and at least one day. (3) **After missed days:** on Today, *Missed from earlier* has a new **Push my plan** button for weekly routines with missed days (new `PushPlanDialog`). For each routine the person can change its days (an extra day, or fewer) and either **Push the plan** (the missed days and every later, not-yet-started day slide in order onto the routine's own weekdays from today, so nothing is lost and the plan ends later; it says when it next runs and when it ends, and how many days would not fit before the goal ends) or **Skip those days** and carry on as planned. Days that were started or finished stay where they are. Calendar-picked routines and one-off days are not pushable (they keep Move to today / Skip).
- **Files:** `apps/web/src/missed.ts` (`findPushableRoutines`, `pushRoutineForward`), `components/PushPlanDialog.tsx`, `components/MissedTasks.tsx`, `components/RoutineEditor.tsx`, `components/GuidedGoal.tsx`, `guidedGoal.ts` (`minutes` can be `null`), `starterPlan.ts` (`everyWeeks`), `App.tsx`.
- **Data/rules impact:** none (uses the existing goal fields; no API change).
- **Verified:** lint ✓ · build ✓ · web tests 89/89 ✓ (new: push logic, optional time, every-other-week routines) · end to end in a throwaway harness (real app on a phone-sized browser, real API with an in-memory store, made-up login; deleted): a gym routine with three missed days was pushed from the dialog (dates slid to Mon/Wed/Fri from Oct 19 to Nov 6, all 18 tasks kept, saved on the server, the missed card disappeared); the guided flow showed the optional time, and an edited routine (Mon + Thu, every other week, an extra task) was saved as written. **Not verified:** "Skip those days" and the extra-day case in the browser (covered by unit tests only), the desktop layout, a real phone, and the real signed-in site.
- **Docs updated:** `architecture.md` (missed.ts), `ui-context.md` (Today).

### 2026-10-18 — Move to MongoDB, stages 2–4: the app now uses the API; Firestore removed  (branch `feature/mongo-data`)
- **Type:** feature + refactor (data layer) + docs
- **What & why:** Goals, profiles, connections and chat now live in MongoDB behind our API; Firebase is for **login only**. The app (`apps/web`) no longer imports Firestore at all (`firebase.ts` exports only `auth` and the Google provider). New `src/api/` (`client.ts` adds the login token and renews it once, `appApi.ts` holds every call, `usePolling.ts` keeps data fresh). **One answer, `GET /api/overview`** (account, clients, requests, chat threads, own goals, shared goals), is asked every 10 s while the app is visible and again when you come back to it; an open chat is asked every 3 s. `saveGoal()` shows a change at once, sends `PATCH /api/goals/:id`, and on failure fetches the real state back. Handlers for connecting people were rewritten around the server's semantic routes and got simpler: approve/deny/remove are single calls; removing a client or leaving professional mode is **immediate on both sides** (the `withdrawnClients` list, the "client's browser finishes the job" effect and the goal-access backfill effect are gone). The server hides a client's invite code and first-run answers from their professional, requires a connection to chat, validates every body, and rate-limits code guessing. Because a sleeping Render server can take ~50 s, sign-in retries every 4 s and the loader says "Waking up the server…"; `.github/workflows/keep-api-awake.yml` pings `/health` every 10 minutes once merged. Removed: `firestore.rules`, `firebase-blueprint.json`, the Firestore block of `firebase.json`, `firestoreDatabaseId`, unused helpers. **Fresh start: nothing was migrated from Firestore, so existing accounts' goals are not carried over.** Small UI fix: an empty Goals list says "No goals yet" instead of "No matching goals found".
- **Files:** `apps/web/src/{App,firebase,types,utils,chat}.ts(x)`, `apps/web/src/api/*`, `apps/web/src/components/{ChatPanel,CollaboratorsPanel,ProfessionalProfilePanel}.tsx`, `apps/api/src/userRoutes.ts` (+ `/overview`), `.github/workflows/keep-api-awake.yml`, `firebase.json`, removed `firestore.rules` / `firebase-blueprint.json`.
- **Data/rules impact:** all people-data permissions are now the API's (tested). The old Firestore database is simply unused; delete it in the Firebase console after the switch. On merge, Render redeploys the API and creates the new collections and indexes on first start. CORS and the web build already point at the Render API.
- **Verified:** lint ✓ · build ✓ · API tests 90/90 ✓ · web tests ✓ · **end to end in a throwaway harness** (the real app in a phone-sized browser, the real API with an in-memory store, made-up login tokens in place of Firebase; all deleted afterwards): new account created, goal created, subcategory and task saved and still there after a reload, a second person's request appeared on the first person's Connect tab by polling, approving with edit access showed the goal in the professional's "Clients you work with" and their workspace ("Can edit · Trainer"), a chat message arrived by polling, raised the unread badge, and a reply showed at once. **Not verified:** against a real MongoDB (in-memory store only), with real Firebase login tokens and the deployed API, the cold-start path (a sleeping Render server), on a real phone, and the desktop layout of the changed screens.
- **Docs updated:** `context/backend-rules.md` (rewritten for the API), `architecture.md`, `coding-guidelines.md`, `project-overview.md`, this file, `README.md`.

### 2026-10-18 — Move to MongoDB, stage 1 of 4: the API for people's own data  (branch `feature/mongo-data`)
- **Type:** feature (backend)
- **What & why:** Goals, profiles, connections and chat still live in Firestore. The decision is to keep Firebase for **login only** and keep everything else in our own API and MongoDB. This first stage builds the server half, and nothing in the app uses it yet. New routes (all need a Firebase login token; the app's user id comes from the token, never from the request): `POST /api/me/sync` (creates the account and its unique 6-character code at sign-in), `GET/PATCH /api/me`, `GET /api/clients`, `GET /api/users/:uid`, public professional profiles, `GET/POST /api/access-requests` (+ `approve`, `deny`), `PUT /api/collaborators/:uid/access`, `DELETE /api/collaborators/:uid`, `PUT /api/goals/:id/assignments`, `DELETE /api/clients/:clientId`, `POST /api/me/leave-professional`, goals (`GET /api/goals?workspace=`, `/goals/shared`, `POST`, `PATCH`, `DELETE`) and chat (`GET /api/chats`, messages, `POST`, `read`). The old **Firestore security rules are rewritten as server rules with 52 tests**: an owner changes everything; an editor only the plan (tasks, subcategories, milestones); a viewer nothing (403 "read only"); anyone else is told the goal does not exist; nobody can write the access lists, the roster or an invite code through a request; a client's invite code and first-run answers are hidden from their professional; a professional's public profile is private until the client approves; chat is two people only and only while connected; links must be http(s); access-code guessing is rate-limited. Things that needed workarounds under Firestore get simpler: removing a client or a professional is immediate on both sides (no "withdrawn clients" dance), and goal access lists are recomputed on the server after every roster change. Shared types and the access helpers moved into `packages/shared` (`app.ts`); the web `types.ts` re-exports them. The data store gained `find()`, new collections, a unique index on access codes and lookup indexes.
- **Files:** `apps/api/src/{userRoutes,userSchemas,store,memoryStore,mongoStore,auth,app,server}.ts`, `apps/api/src/userRoutes.test.ts`, `packages/shared/src/app.ts`, `apps/web/src/{types,utils,chat}.ts`.
- **Data/rules impact:** new MongoDB collections (`users`, `goals`, `accessRequests`, `publicProfiles`, `chats`, `messages`) and indexes, created on the next API start. Firestore is untouched until the last stage. CORS now also allows POST and PATCH.
- **Verified:** API lint ✓ · API tests 86/86 ✓ (52 new) · web type-check ✓. **Not verified:** against a real MongoDB (tests use the in-memory store; `find` on Mongo is the one new query shape) and with real Firebase tokens.
- **Docs updated:** this entry; architecture and backend docs are updated in the final stage.

### 2026-10-18 — Deploy the admin to its own Firebase Hosting site  (branch `feature/phone-compact`)
- **Type:** config
- **What & why:** The admin was only runnable on a developer's machine. Added a second Hosting site config (`deploy/admin/firebase.json`, site `goal-path-admin`, single-page rewrite because the admin uses `BrowserRouter`) and a workflow (`.github/workflows/firebase-admin-hosting.yml`) that builds the admin with `VITE_API_URL=https://goal-tcrb.onrender.com` and deploys it on pushes to `main` that touch the admin or shared code, or by hand. The app's own workflow and `firebase.json` are unchanged. The README has a "Going live" section with the one-time console steps.
- **Files:** `deploy/admin/firebase.json`, `.github/workflows/firebase-admin-hosting.yml`, `README.md`.
- **Data/rules impact:** none. Needs, outside the repo: the Hosting site created in Firebase, its address in the Authentication authorized domains and in the API's `CORS_ORIGINS` on Render.
- **Verified:** `npm run build:admin` with the live API address builds, and the address is in the bundle. **Not verified:** the workflow itself (it cannot succeed until the Hosting site exists), the deployed admin, sign-in from the new domain.
- **Docs updated:** `README.md`.

### 2026-10-18 — Goal page on phone: less to read, readable small text  (branch `feature/phone-compact`)
- **Type:** ui
- **What & why:** The goal page still felt big and full of small print. On phones only: the goal description, the "Assigned:" label and "None assigned" are hidden (the **Manage** button stays), "0/0 done" is hidden until the day has tasks, the empty-day card loses its explanation line and is shorter, the "All goals" back button is 36px, and the step numbers are a little smaller. The smallest text got bigger: weekday labels on the week strip went from 9px to 11px, and every 11px label in the goal page parts (`DailyTaskSection`, `SubcategoryBlock`, `MonthlyMilestoneSection`, the Assigned row) went to 12px (`text-xs`) on every screen size.
- **Files:** `apps/web/src/App.tsx`, `apps/web/src/components/DailyTaskSection.tsx`, `SubcategoryBlock.tsx`, `MonthlyMilestoneSection.tsx`, `apps/web/src/index.css`.
- **Data/rules impact:** none.
- **Verified:** lint ✓ · tests 74/74 ✓ · throwaway 400px sandbox (header markup copied, real `DailyTaskSection`, fake data; deleted): header 149px (was 175) and Daily plan 314px (was 370), 462px together. **Not verified:** the signed-in page, a goal with tasks and subcategories, the milestone roadmap and subcategory blocks at 12px, other phone widths.
- **Docs updated:** none needed (the back button is now 36px on phones; `ui-context.md` still says 44px).

### 2026-10-18 — Goal page on phone: smaller header and Daily plan  (branch `feature/phone-compact`)
- **Type:** ui
- **What & why:** The goal page was too big on a phone. Below 640px only: the header card has less padding and smaller gaps, the title is `text-lg`, the description shows one line, "Manage Access" reads "Manage", and the back button is 40px instead of 44px. The Daily plan card has less padding and tighter spacing, the month chip reads "Oct 2026" (no "(current)"), so the title, month and "0/0 done" fit on one line instead of two, and the day keys are a little shorter. Desktop is unchanged.
- **Files:** `apps/web/src/App.tsx`, `apps/web/src/components/DailyTaskSection.tsx`, `apps/web/src/index.css`.
- **Data/rules impact:** none.
- **Verified:** lint ✓ · tests 74/74 ✓ · a throwaway 400px sandbox of the header markup and the real `DailyTaskSection` with fake data (deleted): header 175px, Daily plan 370px, both on one screen; the title row is one line. **Not verified:** the signed-in goal page itself (the header is copied markup in the sandbox, not the real one), and other phone widths such as 360px.
- **Docs updated:** none needed.

### 2026-10-18 — Missed tasks can be picked up; popups and pages from the admin show in the app; "today" is local  (branch `feature/phone-compact`)
- **Type:** feature + fix
- **What & why:** (1) **Missed from earlier.** On the Today screen, unfinished tasks from the last 14 days appear in a card, each with **Today** (moves it to today, into a subcategory of the same name, created if that day has none) and **Skip** (sets it aside: `skipped: true`, it stays in the plan as not done and is not offered again). **Move all to today** does every one, one write per goal. Only goals the person may edit are listed. The logic is pure (`src/missed.ts`) and the card is `components/MissedTasks.tsx`. (2) **Popups and pages in the app.** `GET /api/content/live` now also returns live **popups** (newest first) and **pages** for the viewer's audience, without internal fields. The app shows one popup at a time after sign-in (`once` never again once closed, `daily` the next day, `every-visit` once per visit; memory in `localStorage` key `gp-popup-closed`), never over the first-run or guided questions. A button or banner link `/pages/<address>` opens that page in a dialog (heading, text, image, button, divider blocks); web addresses open a new tab; anything else is ignored. Banners on the login screen leave `/pages/` buttons out (no pages there). (3) **Fixed the UTC "today"** (known issue #1): `getTodayDateString()` is now the local date, so the streak, Today and new tasks no longer point at yesterday for part of the day.
- **Files:** `src/missed.ts`, `src/missed.test.ts`, `src/components/MissedTasks.tsx`, `src/types.ts` (`TaskItem.skipped`), `src/utils.ts`, `src/App.tsx`, `src/cms/links.ts`, `src/cms/popupRules.ts`, `src/cms/CmsPopups.tsx`, `src/cms/CmsBanners.tsx`, `src/cms/useLiveBanners.ts` (adds `useLiveContent`), `src/cmsRules.test.ts`; `packages/shared/src/cms.ts` (`PublicPopup`, `PublicPage`, `LiveContent`), `apps/api/src/app.ts`, `apps/api/src/app.test.ts`.
- **Data/rules impact:** tasks may carry `skipped: true` (Firestore rules only pin the keys `tasks`, `subcategories`, `milestones`, so no rules change). The API reply gained `popups` and `pages`; an older API without them still works (the app shows none).
- **Verified:** lint ✓ (all four workspaces) · web tests 74/74 ✓ (8 new for popup/link rules, 8 for missed tasks) · API tests 37/37 ✓ (3 new: popups live/ordered/hidden, audience filtering for popups and pages, no internal fields). The dev server renders the login screen. **Not verified:** anything signed in (the Missed card, a popup and a page dialog in the real app, writes to Firestore from the new handlers) because it needs a real Google sign-in; the popup `localStorage` memory in a browser.
- **Docs updated:** `progress-tracker.md`, `ui-context.md`, `architecture.md`, `backend-rules.md`.

### 2026-10-18 — Fix: the New Goal window did not scroll (the page behind did); Help me plan starts by asking the area  (branch `feature/phone-compact`)
- **Type:** fix
- **What & why:** (1) After the dialog change that keeps the title and buttons in place, the **New Goal** window (hand-built, not using `Dialog`) could no longer scroll its own content, and the page behind it scrolled instead. `CreateGoalModal` now uses the shared `Dialog` (title and Create button stay put, the middle scrolls, the page behind is locked). The give-up window got the same inner scroll area. As a safety net, the page never scrolls while any dialog layer is open (`body:has(.scrim)`), and the dialog body keeps a small side padding so the scrollbar and focus rings no longer clip the fields. (2) **Help me plan** used to skip its first question when a category was already selected in the form (Career is selected by default), jumping straight into Career questions. It now **always opens on "What do you want to work on?"** with nothing pre-chosen, and the questions follow one after another. Removed the now-unused `nicheForCategory` and its test (kept a test that every form category has a helper niche).
- **Files:** `components/CreateGoalModal.tsx`, `components/GiveUpInterventionModal.tsx`, `components/GuidedGoal.tsx`, `App.tsx`, `guidedGoal.ts`, `guidedGoal.test.ts`, `index.css`.
- **Data/rules impact:** none.
- **Verified:** lint ✓ · build ✓ · tests 58/58 ✓ · throwaway 400×700 sandbox of the real `CreateGoalModal` over a long page (deleted): the dialog body scrolls (238px), the page behind is locked, fields are not clipped. **Not verified:** the signed-in app, the give-up window's scroll, and the guided flow on a phone (the niche-first change is logic only).
- **Docs updated:** none needed.

### 2026-10-18 — Goals top card: smaller on phones, and Progress now shows each goal  (branch `feature/phone-compact`)
- **Type:** ui + fix
- **What & why:** The "Your goals" card took a lot of phone space (mascot, then three boxed tiles). On phones it is now a slim card: "Your goals" with the streak on the same line and the three numbers (Active goals, Tasks today, Progress) as one strip with thin dividers; no mascot. Desktop keeps the mascot and tiles. Also, tapping **Progress** used to open whichever goal happened to be first, which made no sense. It now opens a **Progress dialog** (`ProgressDialog`): the overall number ("42% of your months are done"), then each goal with a bar and "1 of 4 months done"; tapping a goal opens it. Active goals still scrolls to the list, Tasks today and the streak still go to Today.
- **Files:** `apps/web/src/App.tsx`, `apps/web/src/components/ProgressDialog.tsx` (new).
- **Data/rules impact:** none.
- **Verified:** lint ✓ · build ✓ · tests ✓ · throwaway 400px sandbox with the same card markup and the real `ProgressDialog` (deleted): slim card and dialog render and fit. **Not verified:** the signed-in Goals screen itself, and the desktop Progress tile (changed the same way: it opens the dialog).
- **Docs updated:** none needed.

### 2026-10-18 — Goal page on phone: compact "Plan" flow  (branch `feature/phone-compact`)
- **Type:** ui
- **What & why:** On the goal page the week strip (tall pills), the "Add subcategory" button and the add form took far too much of a phone screen: quick picks wrapped into three rows, the four "When" choices into ragged rows, and the form buttons sat apart. On phones now: the week keys are shorter with a smaller date; the plan header button just says **Add**; **Quick pick** is one row you scroll sideways; **When** is a tidy 2×2 grid; the Cancel / Add buttons fill the row; the empty-day box is shorter. Desktop is unchanged.
- **Files:** `apps/web/src/components/DailyTaskSection.tsx`.
- **Data/rules impact:** none.
- **Verified:** lint ✓ · build ✓ · tests ✓ · throwaway 400px sandbox of the real `DailyTaskSection` with a fake goal (deleted): the form fits in about 300px of height. **Not verified:** the signed-in goal page, the "Every week" weekday picker and the "Pick dates" calendar on a phone, the task rows below.
- **Docs updated:** none needed.

### 2026-10-18 — Fix: Today and Goals on phone still showed desktop pieces  (branch `feature/phone-compact`)
- **Type:** fix + ui
- **What & why:** The user's phone screenshot of Today still showed the big mascot, a date title that wrapped over two lines, a large streak card and a long empty-day card, and the page footer peeked out behind the floating tab bar like a second card. Causes: `hidden` does not win against classes that set their own `display` (`.orb` is `inline-grid`, `.badge` is `inline-flex`), so the mascot and the category badge were never hidden. Now: the mascot sits in a `hidden sm:block` wrapper; on phones the Today title is just **Today** with the weekday and date as the small line above it and a compact streak chip; the empty-day card says "Nothing planned for today" with full-width goal rows; the footer is desktop-only; on the Goals top card the three stat tiles span the row and drop their third line on phones.
- **Files:** `apps/web/src/App.tsx`.
- **Data/rules impact:** none.
- **Verified:** lint ✓ · build ✓ · tests ✓ · throwaway 400px sandbox of the new Today header, empty card and a badge (deleted): mascot and badge gone, title on one line. **Not verified:** the signed-in app (needs Google sign-in).
- **Docs updated:** `context/ui-context.md` (phone rule about hiding).

### 2026-10-18 — Fix: the phone tab bar (and header) painted over dialogs  (branch `feature/phone-compact`)
- **Type:** fix
- **What & why:** On the Connect screen the goal-access dialog's buttons sat under the floating tab bar. Cause: the page content (`<main>`) has its own stacking layer (`z-10`), so a dialog written inside a screen could never rise above the tab bar (`z-50`) or the sticky header, whatever its own z-index. `Dialog` now draws itself on `<body>` through a React portal (carrying over the owner/professional tone from the app root), so every dialog covers everything.
- **Files:** `apps/web/src/components/Dialog.tsx`.
- **Data/rules impact:** none.
- **Verified:** lint ✓ · build ✓ · tests ✓ · throwaway 400×600 sandbox (deleted) with a `z-10` main, a `z-50` fixed bar and a dialog inside: the dialog covers the bar and fits the screen. **Not verified:** the signed-in app, and the professional (warm-tone) colours inside a portalled dialog.
- **Docs updated:** `context/ui-context.md` (layer order).

### 2026-10-18 — Connect screen on phone: labelled actions, confirm dialogs, dialogs that fit  (branch `feature/phone-compact`)
- **Type:** ui
- **What & why:** The Connect screen's lists were rows of unlabelled round icons (message, "verified", target, bin), so nobody could tell what Share/View/Remove did, and removing someone swapped a tiny Remove/Cancel pair in beside the icons. Now each person is a **flat row** (initial badge, name, role, email, a "Can see" line of goal chips) with **labelled buttons**: Message, Profile, Goal access (with a count), Remove (red). Clients I support gets Message, Open/Viewing, Remove. **Removing a professional, removing a client and leaving professional mode all open a proper confirm dialog** (new shared `ConfirmDialog`, built on `Dialog`) that says what will happen. Dialogs now fit a phone: small margins, the buttons share a row, the goal-access list no longer scrolls inside the scrolling dialog, and the No access / View / Edit picker fills the row. Fewer card-in-card effects: Connect cards use smaller padding on phones and the people lists lost their inner boxes.
- **Files:** `components/ConfirmDialog.tsx` (new), `components/CollaboratorsPanel.tsx`, `components/ProfessionalProfilePanel.tsx` (leave confirm), `index.css` (phone dialog rules).
- **Data/rules impact:** none.
- **Verified:** lint ✓ · build ✓ · tests ✓ · in a throwaway 400px sandbox of the real `CollaboratorsPanel` (deleted): the two lists, the remove confirm, the goal-access dialog and the profile dialog all fit the screen. **Not verified:** the signed-in Connect screen with real data, the professional-side "Clients I support" confirm with a real removal, and the leave-professional confirm.
- **Docs updated:** `context/ui-context.md` (UI standard table).

### 2026-10-18 — Fix: dialogs on phone were cut off at the top  (branch `feature/phone-compact`)
- **Type:** fix + ui
- **What & why:** On the Connect tab (phone), the professional-profile dialog appeared scrolled and cut off at the top. Cause: the tab panels keep a `transform` after their slide-in animation (`animation-fill-mode: both`), and a transformed parent makes `position: fixed` children (every dialog's dimmed layer) position against the long page content instead of the screen. Fixed by letting the animation fill backwards only, so the screen-fixed layer is really screen-fixed again. Also, a tall dialog now keeps its **title and close button on top and its buttons at the bottom** while only the middle scrolls (`.dialog` is a flex column, `.dialog-body` scrolls), and uses `dvh` so phone browser bars don't push it off screen.
- **Files:** `apps/web/src/index.css` (`.tab-panel`, `.dialog*`).
- **Data/rules impact:** none.
- **Verified:** build ✓ · tests ✓ · throwaway 400×691 sandbox (deleted): a dialog inside a tab panel on a long scrolled page stays fully inside the screen (top 34px, bottom 35px gap), and the header and footer stay visible while the body scrolls. **Not verified:** the real Connect screen after sign-in.
- **Docs updated:** `context/ui-context.md` (Overlays note).

### 2026-10-18 — Phone first: Goals opens first, and the phone screens are compact  (branch `feature/phone-compact`)
- **Type:** ui
- **What & why:** The phone is the main target (APK), but the phone layout felt oversized and card-heavy. **Goals stays the first tab and the home screen** (order Goals, Today, Connect, Profile; first built Today-first, then switched at the user's request); back from Today/Connect/Profile/a goal goes to Goals, and on Goals "press back again" leaves. An empty Today and an empty Goals list both invite "Create your first goal" (which still offers the optional Help me plan). **Phone-only compaction** (desktop keeps its layout): Goals keeps its top card ("Your goals", the streak and the three stat keys) exactly as before, above the goal list, because the user wants the streak seen first; search is an icon that opens the box; categories are one scrolling row; goal cards show a title, one line of routine names and seven dots instead of the full week and brief (about 3 cards per screen); Today drops the mascot, shows the streak chip, and goal blocks are tighter ("Open" instead of "View Roadmap", no category badge). A phone type/radius scale lives in `index.css` (`page-title` 22px, smaller radii), and the floating tab bar is shorter and more opaque (the + is a little smaller). Navigation rules are a pure module, `navigation.ts`, with tests.
- **Files:** `apps/web/src/navigation.ts` (+ `navigation.test.ts`), `App.tsx`, `components/GoalCard.tsx`, `index.css`.
- **Data/rules impact:** none.
- **Verified:** lint ✓ · build ✓ · web tests 59/59 ✓ (5 for navigation) · goal cards checked in a throwaway 375px sandbox page (deleted) · login page still loads. **Not verified:** the signed-in Today and Goals screens (they need a Google sign-in, so the user should check them on the phone/simulator), the iPhone simulator, and the real back gesture.
- **Docs updated:** `context/ui-context.md` (layout rules, Goals and Today screens, phone scale).

### 2026-10-18 — UI standard: one overlay, one dropdown, one back button, shared dialogs  (branch `feature/ui-polish`)
- **Type:** ui + refactor
- **What & why:** Several screens had small inconsistencies because the same thing was hand-built in many places. Measured causes: every dialog drew its own overlay (50% dark plus a 12px blur, and not even the same value everywhere) which turned the page behind into a muddy haze; the **Trainer** picker on Collaborate was the only native browser dropdown left; the "No access / View / Edit" control was built twice in different ways (one showing a heavy black square); the roster icon buttons were rounded squares with borders; card descriptions were pale `slate-400`; the goal page's back control was a tiny chip squeezed in with the badges. Each now has **one shared part**: `Dialog` + `.scrim` / `.dialog` (light dim, no blur), `AppSelect` + `.field-control`, `AccessPicker`, `BackButton`, `.icon-action`, `.card-lede` / `.meta`. Converted: the assign-goals and professional-profile dialogs on Collaborate, the goal assignment dialog, the new-goal, give-up and leave-professional dialogs, the chat backdrop and the login sheet backdrop, the Trainer dropdown, the goal page back button ("All goals" on its own 44px row), the Profile and Collaborate card descriptions.
- **Keeping it standard:** the standard is written in `context/ui-context.md` ("The UI standard": the shared-parts table, an 8-point spacing scale, five text levels, one control height) and enforced by `apps/web/src/uiStandards.test.ts`, which fails with file and line if a hand-made overlay, native `<select>`, "← Back" chip, hand-built access buttons or the old pale description text is reintroduced.
- **Files:** new `components/Dialog.tsx`, `AccessPicker.tsx`, `BackButton.tsx`, `src/uiStandards.test.ts`; edited `index.css` (shared parts), `AppSelect.tsx` (`wrapperClassName`, `size`), `CollaboratorsPanel.tsx`, `GoalAssignmentModal.tsx`, `CreateGoalModal.tsx`, `GiveUpInterventionModal.tsx`, `ProfessionalProfilePanel.tsx`, `ChatPanel.tsx`, `LoginScreen.tsx`, `AccountProfilePanel.tsx`, `App.tsx`; docs `ui-context.md`, `coding-guidelines.md`.
- **Data/rules impact:** none.
- **Verified:** 8 new standards checks (and a deliberate violation was caught with its file and line); all web tests, type-checks and builds pass. In a throwaway page with the real Collaborate screen and sample data (deleted afterwards), before and after: the overlay measured `rgba(26,25,39,0.32)` with no blur (was 0.5 with `blur(12px)`); the Trainer dropdown matches its neighbours (the three controls in the row are all 40px high, its list opens at the same left edge and width, inside the screen); the dialog at desktop and phone width (the access control stacks under each goal on a phone, nothing overflows); the back button is 44px tall; no sideways scroll on a phone. **Not verified:** every other screen in the signed-in app. I did not hunt for further inconsistencies beyond the ones reported and the shared patterns found by searching (`ChatPanel` content, `ProfessionalProfilePanel` forms, `GiveUp` modal body were only given the shared overlay and panel).
- **Docs updated:** `ui-context.md`, `coding-guidelines.md`, this file.

### 2026-10-17 — Optional "Help me plan" for new goals (guided niche questions)  (branch `feature/guided-goal`)
- **Type:** feature
- **What & why:** The **plain create-goal form stays the default**: the phone +, the desktop New Goal button and the empty-state button open it exactly as before, with the categories **Career, Business, Health, Fitness, Finance & Wealth, Learning & Skills and Custom** (**Creative Writing was removed** from the form; existing goals in that category keep working). Inside the form, a small optional box, **"Not sure where to start? Help me plan"**, opens a few quick taps for anyone who does not know how to set a goal up. Nothing forces it, and it opens over the form, so closing it returns to the form with whatever was typed. **No typing is needed anywhere**: every question is a tap; "Something else" exists and naming it is optional. If a category was already picked in the form, the questions start at that niche; for Custom they start at a niche list (six niches plus "Something else").
- **The flow:** 2 to 4 questions per niche (Health asks about eating *or* about rest, never both), then one **Plan your week** screen (days, minutes, months), then a **sample plan** (goal name, routines on weekdays, tasks) that can be renamed and trimmed before **Create my goal**. It is a base the person can edit freely afterwards, never a finished program. Pre-built actions per niche: Career (job search, promotion plan, skills, networking, profile, interviews), Business (test the idea, outreach, marketing, product, money and admin), Health (eating routines with style and meals, wind-down, stress break, energy boost, morning reset), Fitness (strength split by place and level, cardio, mobility), Finance & Wealth (check-in, saving, debt, investing basics, spending review, earning more), Learning & Skills (study, practice, mini project, teach it back, review), Something else (focus time, next step, daily check-in, weekly review).
- **How it is built:** `apps/web/src/guidedGoal.ts` is data plus a small engine (no React, no database): each niche has `questions` (with optional `showIf`) and a `plan` function; `buildGuidedPlan` spreads routines over the chosen days and sizes tasks to the minutes (reusing `spreadOverDays` and `tasksForMinutes`). `components/GuidedGoal.tsx` is the screen; `components/CreateGoalModal.tsx` gets the optional button (`onHelpMeChoose`). `App.tsx` gained `createGoalFromPlan`, now shared by the first-run questions and this flow, with a check that the goal fits in one Firestore document. **AI seam:** the screen calls a `PlanMaker` (`makePlan` prop, default `makePlanWithRules`); an AI version only has to return the same `StarterPlan` shape and no screen changes.
- **Also on this branch (so one pull request ships everything):** flexible repeats (every other week, every day, picked dates), the dialogs-reset fix, and the admin "server is waking up" message.
- **Files:** new `apps/web/src/guidedGoal.ts`, `guidedGoal.test.ts`, `components/GuidedGoal.tsx`; edited `App.tsx`, `utils.ts` (`GOAL_CATEGORIES` no longer lists Creative Writing), `starterPlan.ts` (exports `spreadOverDays`; `StarterPlan.focus` may be `custom`), `components/CreateGoalModal.tsx`, `components/Onboarding.tsx` (exports `OptionRow`, `AskBubble`).
- **Data/rules impact:** none. A guided goal is saved exactly as the first-run questions already save one; a Custom or "Something else" goal uses the category `General`.
- **Verified:** 30 guided-goal tests (niches match the form's categories; no Creative Writing; every question is a tap with 2+ choices; at most 4 questions on any path; every niche gives a valid plan with no answers, with first choices and for every first-question choice; routines only on chosen days; minutes change task counts; Health asks eating or rest questions only; answers change plans; "Something else" works with or without typing; typed text is cleaned; category to niche mapping; plans write onto the calendar; the AI seam). In a throwaway page at phone size, wired like the app (deleted afterwards): the form shows six categories plus Custom and the optional box; Help me plan from Health starts at Health's questions; eating path asks style then meals; closing the helper keeps the typed title and category; Custom starts at the niche list; Something else path, the week screen, the sample plan, creating (40 days, 160 tasks) closes both layers and opens the goal; the original form still saves the same data. **Found and fixed:** two quick taps on a multi-choice question lost the first one. **Not verified:** saving to the live Firestore from a signed-in account.
- **Docs updated:** this file.

### 2026-10-17 — Flexible repeats: every other week, every day, and days picked on a calendar  (branch `feature/flexible-repeats`, uncommitted)
- **Type:** feature
- **What & why:** When adding a subcategory ("Chest day"), the **When** choices are now **Just this day · Every week · Every other week · Pick dates**. *Every other week* keeps the weekday picker but only counts every second week, starting with the week of the first day. *Every day* and *Weekdays* are quick presets next to the weekday picker. *Pick dates* shows a small month calendar (Monday-first, month arrows, limited to the goal's months) where any days can be tapped on or off. On an existing routine, the ⋯ menu's **Edit repeat…** gained an **Every week / Every other week** switch (it previews how many days it adds or removes). A routine built from picked days shows a "3 picked days" badge, cannot be given weekdays afterwards (its menu has no "Edit repeat…"), but can be stopped.
- **Data model:** `Subcategory` gained two optional fields, `repeatEvery` (2 = every other week; absent = every week) and `repeatDates` (true = picked days). Both are added or removed, never set to `undefined` (Firestore rejects it). **No migration, no rules change**; existing routines are unchanged.
- **Files:** new `apps/web/src/components/MiniCalendar.tsx`, `apps/web/src/recurrence.test.ts`; edited `apps/web/src/recurrence.ts` (`RepeatPattern`, `weeksBetween`, `describePattern`, `describeRepeat`; `createSeries` and `applySeriesDays` understand intervals and picked days), `components/DailyTaskSection.tsx`, `components/SubcategoryBlock.tsx`, `App.tsx`, `types.ts`, `apps/web/package.json` (`npm test`).
- **Verified:** 16 new tests in the repo (weeks, every week unchanged, alternate weeks counted from the first day's week, picked days deduplicated and ordered, bad dates and dates past the goal ignored, picked-day routines can only be stopped, switching between weekly and alternate weeks adds or removes the right days and tasks, no `undefined` fields, labels). In a temporary sandbox page with the real planner (deleted afterwards): the four choices, the presets, the summaries, creating an every-other-week routine (Mon + Thu: Oct 26/29, Nov 9/12 …), picking days across two months, badges and menus for both kinds, switching an alternate-week routine to every week (12 to 24 days), and the phone layout (no sideways scroll). **Not verified:** against the live Firestore with a real signed-in account (the new fields are plain values and the write path is unchanged).
### 2026-10-17 — Fix: closing a dialog and opening it again showed the old screen  (branch `fix/guided-plan-reset`)
- **Type:** fix
- **What & why:** The guided plan questions, New goal, Give up and Goal assignment dialogs stayed *mounted* while closed (they returned `null`), so React kept their state. After quitting the guided questions and opening them again, the old step and answers (even the finished "Your plan is ready" screen) came back instead of a fresh start; a half-typed goal title survived Cancel the same way. `App.tsx` now mounts each of the four only while it is open, so every opening starts clean.
- **Files:** `apps/web/src/App.tsx` (31 lines).
- **Verified:** in a throwaway page (deleted afterwards) showing both mountings of the real guided-plan screen: with the old mounting, quit and reopen returned to the same later question; with the new mounting it returned to the first screen. Type-check passes. **Not verified:** the four dialogs inside the signed-in app (needs a real session).
- **Lesson:** a dialog that returns `null` when closed keeps its state. Mount it conditionally, or reset it on open.
- **Docs updated:** this file.

### 2026-10-15 — Admin team: owners and managers  (branch `feature/admin-team`, uncommitted)
- **Type:** feature + security
- **What & why:** The admin now has two roles. **Owners** are the emails in the private `ADMIN_EMAILS` setting; they can change content and, on a new **Team** page, add or remove **managers**. **Managers** are stored in MongoDB (collection `admins`); they can change banners, popups, pages and starter plans but cannot see or change the team. The role is looked up on every request, so removing a manager works on their next request. Owners cannot be demoted or removed from the screen (they exist only in the server settings), and the manager list is not reachable through the generic content routes. Limit of 20 managers.
- **API:** `GET /api/admin/me` now returns `{ email, role }`; owner-only `GET /api/admin/team`, `PUT /api/admin/team/:email` (idempotent add, 409 when already an owner or the team is full), `DELETE /api/admin/team/:email`. Store interface gained `get`; `admins` is a private collection name that the content routes cannot reach. `AdminAuth.allowedEmails` renamed `ownerEmails`.
- **Admin:** Team page (owners only; the sidebar item and the page both check the role); the signed-in role shows in the sidebar. Team management only exists when real login is configured.
- **Files:** new `packages/shared/src/team.ts`, `apps/admin/src/features/team/TeamPage.tsx`; edited `apps/api/src/{app,auth,server,store,memoryStore,mongoStore}.ts`, `apps/api/src/app.test.ts`, `apps/admin/src/lib/{api,httpApi}.ts`, `apps/admin/src/components/{AuthGate,Layout}.tsx`, `apps/admin/src/App.tsx`.
- **Data/rules impact:** a new MongoDB collection `admins` appears on first use. No Firebase change. To make someone an owner, add their email to `ADMIN_EMAILS` (comma separated) on the server and restart.
- **Verified:** 34 API tests pass (10 new: unknown person refused, owner adds a manager who gets in at once, manager can edit content, manager cannot read or change the team, team list, idempotent add, owners cannot be added or removed, invalid email refused, removal takes effect on the next request, `admins` unreachable through content routes, team size limit); all workspaces type-check; the admin builds. **Not verified:** the Team page clicked through in a browser with a real second Google account (needs real sign-ins; the screen compiles and its API calls are covered by the tests).
- **Docs updated:** this file.

### 2026-10-15 — Admin login (Google sign-in, allow-list by email)  (branch `feature/admin-login`, uncommitted)
- **Type:** feature + security
- **What & why:** The API's admin routes were unusable online (they refused to run in production because nothing proved who was calling). Now: the admin shows a "Continue with Google" screen (Firebase Auth, the same project as the app); every admin request carries the person's login token; the API verifies the token's signature against Google's published keys (`jose`, no secret needed), checks it was issued for this Firebase project, requires a verified email, and only lets in emails listed in `ADMIN_EMAILS`. New route `GET /api/admin/me` lets the admin ask "am I allowed?" after sign-in. Fails closed: with no `ADMIN_EMAILS` set, the admin is locked in production and open only on a developer's own machine.
- **Files:** new `apps/api/src/auth.ts`, `apps/admin/src/lib/firebase.ts`, `apps/admin/src/components/AuthGate.tsx`, `apps/admin/src/firebaseConfig.json` (a copy of the app's public web settings); edited `apps/api/src/{app,env,server}.ts`, `apps/api/src/app.test.ts`, `apps/api/.env.example`, `apps/admin/src/lib/{httpApi,index}.ts`, `apps/admin/src/{App.tsx,components/Layout.tsx,index.css}`, `package.json` files (`jose`, `firebase`).
- **Data/rules impact:** none on data. New settings: `ADMIN_EMAILS` (private, comma-separated) and optional `FIREBASE_PROJECT_ID` (defaults to `goal-path-9f4cc`, public).
- **Verified:** 23 API tests pass (9 new: owner in, no token 401, forged token 401, stranger 403, unverified email 403, stranger cannot write, public feed stays open, preflight allows the Authorization header); the real verifier refuses random text and a correctly shaped token signed with a foreign key; all workspaces type-check; in the browser the admin shows the sign-in screen when the API requires login and the API answers anonymous requests with 401. **Not verified:** a real Google sign-in end to end (needs the owner's own account), the admin served from a public address (the domain must be added under Firebase Authentication → Settings → Authorized domains).
- **Found while testing:** `apps/api/.env` had a typed shell command stuck on the end of the `CORS_ORIGINS` line, which made the browser block the admin's requests; repaired. Symptom to remember: "blocked by CORS policy" while the API is running.
- **Docs updated:** this file.

### 2026-10-14 — Backend API with MongoDB, and the app shows banners from the admin  (branch `feature/dynamic-content`, uncommitted)
- **Type:** feature
- **What & why:** Made the CMS dynamic end to end. (1) **`apps/api`** (Express + TypeScript): a public route `GET /api/content/live` that returns only what is live now for this kind of person (published, inside its dates, right audience), and admin routes `GET/PUT/DELETE /api/admin/:collection` for banners, popups, pages and starter plans. Every write is validated (`zod`, unknown fields refused, only https images, links limited to https or in-app paths) and internal fields never reach the app. Storage sits behind a `ContentStore` interface with a MongoDB version (`mongodb` driver, unique index on page addresses) and an in-memory version (tests, demos). (2) **Admin** now talks to the API (`lib/httpApi.ts`); practice mode remains with `VITE_USE_MOCK=true`. (3) **Web app** shows banners in four places: announcement bar under the header, Goals screen, Today screen, login screen (`src/cms/useLiveBanners.ts`, `src/cms/CmsBanners.tsx`; 20 lines changed in `App.tsx`/`LoginScreen.tsx`). It refreshes every minute and when the app returns to the foreground, and never breaks if the API is down. (4) Helper scripts: `npm run db:setup` writes the Atlas string into the git-ignored `apps/api/.env` (URL-encodes the password); `npm run db:check` tests the connection without printing secrets.
- **Files:** new `apps/api/src/*`, `apps/api/scripts/set_mongo_uri.py`, `apps/api/.env.example`, `apps/admin/src/lib/httpApi.ts`, `apps/web/src/cms/*`; edited `packages/shared/src/cms.ts` (public types), `apps/web/src/App.tsx`, `apps/web/src/components/LoginScreen.tsx`, `apps/admin/src/lib/index.ts`.
- **Data/rules impact:** new MongoDB database `goalpath` (collections created on first write). Firebase is untouched; goals still live in Firestore. **The admin routes have no login yet**: they refuse to run when `NODE_ENV=production` (fail closed) and are open on a developer's machine. Do not deploy the API until Firebase-token checking and Cloudflare Access are in front of them.
- **Verified:** 14 API tests pass (visibility rules, drafts, future and ended items, audience, priority order, no internal fields leaked, validation, dangerous links refused, duplicate page address 409, admin refused in production); all workspaces type-check; real database: connected and wrote a test record; saved a banner, restarted the API, and the banner was still served. In the real app: login-screen notice and the announcement bar appeared from admin-made banners; edit, unpublish, schedule, expire and audience rules each took effect on the next request. **Not verified:** the Today card and the popups/pages in the app (popups and pages are stored but the app does not show them yet); the app against the database over a full day; deployment.
- **Open:** (1) The Atlas password was pasted into a chat screenshot; it must be reset in Atlas (Database Access → Edit user) and `npm run db:setup` run again. (2) A test banner ("Saved in MongoDB, not in memory") is live in the database; delete it in the admin. (3) Banner links that point inside the app (`/pages/...`) show no button yet because the app has no pages screen. (4) Atlas free tier has no automatic backups.
- **Docs updated:** this file; `README.md` (status of `apps/api`).

### 2026-10-14 — Monorepo layout and the first admin dashboard  (branch `chore/monorepo-layout`, uncommitted tail)
- **Type:** refactor + feature
- **What & why:** Direction set: one backend (later) and MongoDB for all data, Firebase kept for login only, and an admin dashboard so banners, popups, new pages and starter plans can change without redeploying the app. This change lays the foundation. (1) **Monorepo:** the app moved to `apps/web/` with `git mv` (history kept); root `package.json` declares npm workspaces and scripts (`dev`, `dev:admin`, `build`, `lint`); `firebase.json` and the deploy workflow now point at `apps/web/dist`; added `tsconfig.base.json`, `.editorconfig`, `.nvmrc`, a root `README.md`. (2) **`packages/shared`:** the content types (`Banner`, `Popup`, `Page` with blocks, `PlanTemplate`) and the rules `isLive`, `lifecycleOf`, `matchesAudience` that decide what is shown. (3) **`apps/admin`:** React + Vite on port 3001 with Overview, Banners, Popups, Pages (block editor) and Starter plans; each edit form has a live phone preview, validation and schedule dates. Data goes through a `ContentApi` interface; for now it is answered by browser storage with sample content ("practice mode"). (4) **`apps/api`:** placeholder only.
- **Where the app can show CMS content (identified, not wired yet):** announcement bar under the header (`App.tsx` near the success/error banners), banner above the goal list, card under the Today progress bar, login-screen notice, a popup on start, new pages, and the starter plans and question options now hard-coded in `starterPlan.ts`.
- **Files:** new `apps/admin/**`, `apps/api/**`, `packages/shared/**`, `README.md`, `tsconfig.base.json`, `.editorconfig`, `.nvmrc`; moved everything else under `apps/web/`; edited `firebase.json`, `.github/workflows/firebase-hosting-merge.yml`, `.gitignore`, root `package.json`, `package-lock.json`.
- **Data/rules impact:** none. Firebase data and rules are untouched; nothing in the app reads CMS content yet.
- **Verified:** `tsc --noEmit` passes in all three workspaces (admin is strict); admin builds; scheduling rules checked with 8 throwaway tests; in the browser: create/edit/save a banner (live preview, toast, stored), page form (validation, auto address, duplicate address blocked, block reorder, create), phone layout, no console errors; the moved web app still starts. **Not verified:** the deploy workflow on GitHub after the move; the firebase.json hosting path with a real deploy; admin in light mode.
- **Open:** two lockfiles exist (`package-lock.json` and `bun.lock`); `bun.lock` is not used by the workflow and should be removed or regenerated. The admin has no login yet (plan: Cloudflare Access in front, Firebase token check in the API).
- **Docs updated:** `README.md`, `project-overview.md`, a path note in `architecture.md`, `ui-context.md`, `coding-guidelines.md`, `backend-rules.md`, this file.

### 2026-10-12 — Add the JSM agent skills (/architect, /review, /recover, /remember, /imprint)  (uncommitted)
- **Type:** config
- **What & why:** Installed the five skills from the `jsmastery-pro/jsm-agent-skill` repo (MIT) as project skills so they can be run as slash commands: `/architect` (plan before building), `/review` (check a finished feature in three layers), `/recover` (diagnose a failure: targeted fix, hard reset or rethink), `/remember save|restore` (hand a session over through `memory.md`), `/imprint` (record UI patterns in `ui-registry.md`). The `SKILL.md` files are copied unchanged from the repo's `main` branch; the repo's licence is kept beside them.
- **Files:** new `.claude/skills/{architect,review,recover,remember,imprint}/SKILL.md`, `.claude/skills/LICENSE-jsm-agent-skill`.
- **Data/rules impact:** none. The skills only write files they name: `memory.md` (`/remember save`, asks before overwriting, never stores secrets) and `ui-registry.md` (`/imprint`) in the project root.
- **Note:** `/imprint` expects a `ui-registry.md`; this project already documents its UI in `context/ui-context.md`, so use that as the source of truth and treat `ui-registry.md` as optional. `/remember` is separate from Claude's own memory.
- **Verified:** not run yet; the files were read in full before installing and contain only instructions, no scripts or network calls.
- **Docs updated:** this file.

### 2026-10-11 — Lovi-style redesign: pastel look, new fonts, guided first-run questions  (uncommitted)
- **Type:** ui + feature
- **What & why:** The user disliked the clay/neumorphic look and asked for the interface to be rebuilt in the style of the Lovi iOS app (reference screenshots supplied as a zip), keeping every core function and the app's transitions. (1) **New design system** in `src/index.css`: pale lavender page with pastel washes; white 26px cards with a hairline and one soft shadow (the `.neu*` names were kept so every screen re-skinned at once); white pill inputs with a glowing focus ring; `.chip` / `.btn-tone` / `.btn-danger` / `.badge` / `.menu` restyled; new `.splash`, `.glass`, `.orb`, `.sheet`, `.option`, `.divider-label`. Palette remapped: periwinkle primary (owner tone), pink (professional tone and "chosen" marks), red danger. Fonts: Bricolage Grotesque (display) + Figtree (body) via `index.html`. (2) **Login** is now a splash with the floating orb and one Google button; email sign-in moved into a bottom sheet. (3) **First-run questions** (`Onboarding.tsx`, `starterPlan.ts`): welcome, who you are, focus, age, eating style (diet only), activity, days, minutes, length, starter-plan yes/no, slide-to-commit with confetti, "Tailoring your plan…", "Your plan is ready". For someone planning their own goals it creates up to 3 goals with starter weekly routines (diet items adapt to the eating style). Replaces `PersonaPrompt` (deleted). Also reachable from the account menu ("Start a guided plan"). (4) Goals and Today headers now use the orb mascot and big display type; the phone "+" and other filled buttons use `.btn-tone`; modals and chat now sit above the phone tab bar (`z-[60]`), which had been covering the Create button; "Create Goal Roadmap" shortened to "Create goal".
- **Files:** new `src/components/Onboarding.tsx`, `src/components/Orb.tsx`, `src/starterPlan.ts`; rewritten `src/index.css` (head), `LoginScreen.tsx`; edited `App.tsx`, `index.html`, `UIElements.tsx`, `CreateGoalModal.tsx`, `CollaboratorsPanel.tsx`, `GoalAssignmentModal.tsx`, `GiveUpInterventionModal.tsx`, `ProfessionalProfilePanel.tsx`, `types.ts`; deleted `PersonaPrompt.tsx`.
- **Data/rules impact:** `UserProfile` gains optional `onboardedAt` and `onboarding` (a plain map of the answers). **No rules change** if the existing `users/{uid}` rule lets the owner update their own document (it already did for `persona`); not tested against a real new account.
- **Verified:** `tsc --noEmit` ✓. Starter-plan logic: 9 checks in a throwaway script (plan counts, spreading across days, diet tweak for vegetarian, no `undefined`); routine logic: the earlier 18 checks still pass. The whole question flow was walked through screen by screen in a temporary sandbox page at 390×844 (since deleted) and the generated plan was inspected (2 goals × 2 routines, Mon/Wed/Fri). In the signed-in preview at 375px (read-only): Goals, Today, goal page, Collaborate, Profile and the New Goal modal render in the new style. **Not verified:** `handleFinishOnboarding` against the real database; the iPhone simulator with the new design (needs the user to sign in); desktop width of the new screens; chat panel and remaining modals.
- **Docs updated:** `ui-context.md` (sections 1–3, screens, components), `architecture.md`, `coding-guidelines.md`, `project-overview.md`.

### 2026-10-11 — Goal cards: a brief of the plan instead of numbers, plus sample weekly plans  (uncommitted)
- **Type:** ui + sample data
- **What & why:** The first card design (progress ring, "0/7 months", "5 months left", today count) was still a wall of numbers. The card now shows **what is planned**: the next 7 days as letter keys (today filled, dot on planned days) and the routines in that window with their weekdays and a peek at their tasks; an unplanned goal shows **"Plan your first routine"** so people can see where to add. The progress ring and its CSS were removed.
- **Sample data written to the real account (at the owner's request), through the app's own weekly-routine form:** **DIET** — Meal prep & groceries (Sun), High-protein day (Mon·Wed·Fri), Veggie-forward day (Tue·Thu), Flexible day (Sat); **GYM** — Active recovery (Sun), Chest & Triceps (Mon·Thu), Back & Biceps (Tue·Fri), Legs & Glutes (Wed·Sat). Each starts 2026-10-11 and runs to the goal's last month, 2–3 tasks each. To remove one: goal → ⋯ on a block → *Delete this & later days*. Nothing else was changed or deleted.
- **Verified:** lint ✓; the **live Firestore write path now works**: creating routines and adding tasks to all later days succeeded with no error banner (8 routines, 23 tasks entered). Card rendering with real data checked at ~670px. **Not verified:** editing/stopping a routine and deleting later days against the live database; the professional's view of a card.
- **Note:** the card keeps the earlier work: whole card and title open the goal, tapping a day opens it on that day.

### (superseded) 2026-10-11 — Goal cards on the Goals page rebuilt to match the new flow  (uncommitted)
- **Type:** ui
- **What & why:** The cards were one very wide column of small labels with a barely visible progress bar and no link to the new editing flow. They are now a `GoalCard` component: category badge, title and description, a **progress ring** for overall progress, **this week as the same Mon–Sun strip** as the goal page (shared `DayMark`), this month's milestone beside today's count, and a footer (access / assign, "Open →"). **Tapping a day on a card opens the goal on that day** (`openGoal(goalId, date)` → `DailyTaskSection`'s new `initialDate`). The grid is `auto-fill, minmax(20rem, 1fr)` so it fits any width (1 column on a phone, 2–3 on a laptop). The category tag on the Today header is now the same `.badge`. Pattern borrowed from habit/goal trackers (ring + weekly dots); no code or assets copied from anywhere.
- **Files:** new `src/components/GoalCard.tsx`, `src/components/DayMark.tsx`; `ProgressRing` in `UIElements.tsx`; `buildDayStats` in `src/recurrence.ts`; `App.tsx` (card markup removed, `openGoal`, `selectedGoalDate`), `DailyTaskSection.tsx` (`initialDate`, shared stats/mark), `index.css` (`.ring-arc`).
- **Data/rules impact:** none.
- **Verified:** lint ✓. In the real app (signed-in preview, read-only): both cards render at ~670px and at 1280px; tapping Wednesday on a card opened the goal on "Plan Wednesday, Oct 7"; tapping the card body opened it on "Plan today". **Not verified:** the professional's view of a card (can-edit / view-only footer) and the owner's "Assign Pro" footer (this account has no connected professionals); completed/partially-done day marks and a non-zero ring on real data; phone width.
- **Docs updated:** `ui-context.md`, `architecture.md`.

### 2026-10-11 — One design language everywhere, a guided goal-editing flow, and weekly routines  (uncommitted)
- **Type:** ui + feature
- **What & why:** The goal page looked unlike the rest of the app (white cards, violet borders, a wall of preset chips) and had no flow. Now (1) **a shared design system**: `.chip`, `.btn-tone`, `.btn-danger`, `.badge`, `.card-title`, `.menu*`, wells (`.neu-inset*`) and a **tone** (`data-role` on the root → `--tone-*`) replace hand-built white/grey boxes on every screen — Goals, Today, Collaborate, Profile, Login, Persona prompt, New Goal, Assign, Give-up, Chat, credentials and confirm dialogs, account menu; (2) **the goal editing flow**: 1 pick a day (Mon–Sun week strip) → 2 plan it (subcategories → tasks), 7/5 columns with the roadmap; the preset wall is now one **Add subcategory** button and **4 quick picks**; (3) **weekly routines**: *Every week* + the **M T W T F S S** keys adds a subcategory to every matching day until the goal ends; ⋯ menu to rename, edit the repeat (live preview), stop, set who can edit, delete this day / this & later days; tasks can be added to all later days at once; (4) **Today** now reuses `SubcategoryBlock` (execution-only: tick and add tasks; no rename/delete/edit, as decided in `8c07829`).
- **Files:** new `src/recurrence.ts`, `src/components/MenuButton.tsx`, `src/components/WeekdayPicker.tsx`; rewritten `DailyTaskSection.tsx`, `SubcategoryBlock.tsx`, `MonthlyMilestoneSection.tsx`; restyled `CreateGoalModal`, `GoalAssignmentModal`, `GiveUpInterventionModal`, `PersonaPrompt`, `ChatPanel`, `LoginScreen`, `CollaboratorsPanel`, `ProfessionalProfilePanel`, `AccountProfilePanel`; `App.tsx` (handlers, Today view, goal page, root `data-role`), `UIElements.tsx` (`GlassIconButton` `tone` variant + attribute pass-through), `types.ts`, `index.css`.
- **Data/rules impact:** `Subcategory` gains optional `repeatId` and `repeatDays`. **No rules change, no deploy needed, no migration** (routines are ordinary dated subcategories inside the existing `subcategories` array). A new size guard (900 KB) refuses writes that would exceed Firestore's document limit.
- **Verified:** lint ✓. Routine logic: 18 checks in a throwaway script (weeks/leap years, create, add/drop weekdays, stop, copy tasks onto new days, earlier days never touched, no duplicates, unique ids, no `undefined`, size budget) ✓. UI: real app at desktop width — Goals, Collaborate, Profile, New Goal modal, account menu, goal page (opened, **nothing saved**); every flow interaction (week navigation, add form, weekday keys, ⋯ menu, repeat editor with preview, confirm prompts, add-task-to-later-days, owner/professional tone, view-only professional) in a temporary mock-data sandbox page (deleted afterwards); phone width checked for overflow only. **Not verified:** the new Firestore writes against the real database (create routine, change repeat, delete later days, add task forward) — try them on a throwaway goal; Today with real tasks; the Give-up and Chat restyles by eye; professional-in-client-workspace screens with real data; a polished phone layout.
- **Docs updated:** all six `context/` files.

### 2026-10-11 — Fix Google sign-in fallback: only redirect when the popup can't open  (uncommitted)
- **Type:** fix
- **What & why:** Users saw a red "Popup was blocked. Redirecting to Google sign-in..." box. In the Claude preview pane `window.open()` returns `null`, so Firebase throws `auth/popup-blocked` (confirmed in the console) and the app correctly fell back to a redirect — but it showed that as an *error*, and the same fallback also fired for `auth/popup-closed-by-user` and `auth/cancelled-popup-request`, which are not blocked popups (a user closing the window, or a second click, forced a full-page redirect while a popup could still be open). Now: redirect only for `popup-blocked` / `operation-not-supported-in-this-environment`; a closed popup shows a notice and stays put; a second click while one attempt runs is ignored; the fallback message is a neutral violet notice, not an error; `getRedirectResult` is read on load so a failed redirect sign-in is shown instead of silently returning to the login page.
- **Files:** `src/App.tsx` (`handleGoogleSignIn`, new `authNotice` state, `googleSignInBusy` ref, redirect-result effect), `src/components/LoginScreen.tsx` (new optional `info` prop).
- **Data/rules impact:** none.
- **Verified:** lint ✓ · live in the preview on a signed-out origin (`127.0.0.1:3000`): two clicks in the same tick → exactly one `window.open`; `popup-blocked` → violet notice → redirect attempted → `unauthorized-domain` panel (expected for that host). **Not verified:** the `popup-closed-by-user` path live (origin validation fails first on `127.0.0.1`); a complete Google round trip after this change (the preview was already signed in from the earlier redirect); behaviour in a regular browser with working popups.
- **Docs updated:** `architecture.md` (sign-in flow), `backend-rules.md` (auth row), `ui-context.md` (login message boxes), `coding-guidelines.md` (preview-pane testing note).

### 2026-10-11 — Added `context/` documentation set  (uncommitted)
- **Type:** docs
- **What & why:** Created six reference files so any human or AI agent can understand the project without reading the whole codebase, and so changes get recorded from now on.
- **Files:** `context/project-overview.md`, `architecture.md`, `ui-context.md`, `backend-rules.md`, `coding-guidelines.md`, `progress-tracker.md`.
- **Data/rules impact:** none.
- **Verified:** content derived from reading the source at commit `1e75ab7`; `npm run lint` ✓ (baseline, no code changed). Nothing was run against live Firebase.
- **Docs updated:** all six (new).

### History reconstructed from git (before this tracker existed)

Grouped by day, newest first. Author of all commits: shahid (Shahid Muhamed). Hashes are on `main`.

#### 2026-09-29 — Streak, chat, violet accent, phone-bar and profile polish
- `1e75ab7` Slide the phone tab pill smoothly under the + button
- `57f6e01` Use the red briefcase icon for the leave-professional button
- `a4f6606` Swap profile header icons and use a red profile-leave icon
- `b5d9932` Move profile actions next to the name as icons
- `4c2838a` Make leaving professional a red button that disconnects clients
- `ec361c6` Let a professional switch back to a client account
- `84b1b19` Restore phone tab animation with a per-group sliding pill
- `32a135e` Center phone + button, declutter roster, add client profile tab
- `3a81071` Keep chat header and messages visible when the phone keyboard opens
- `6ed5531` Shift accent to deep royal violet for a minimal, premium palette
- `80ab3b7` Merge branch 'main' into Staging/testing
- `1403e1c` **Add daily streak tracker and client-professional chat**

#### 2026-09-28 — Loader fixes, visibility pass, custom dropdowns
- `6ae6087` Fix navigation bar z-index to stay above + button during transitions
- `92bcbf5` Style back button to match goal category badge
- `cca4e6f` Replace native select with custom dropdown for month selector
- `eaaaa40` Style month selector dropdown to match month buttons
- `fdb8b12` Improve visibility of back button and month selector
- `6330ce1` Fix hidden email text in footer - improve visibility
- `672da3d`, `afa928a` Enhance color palette for better visibility and UX
- `d8b9f6e`, `2bf850d` Merge PRs #6, #5 (`Staging/testing`)
- `84a3935` Loader UI improvements and demo page (`loader-demo.html`)
- `c86d549`, `a40d5b4` Fix loader flicker / remove leftover `firstLoadDone` references
- `de72a91`, `c3cf42f`, `7da51e4` Merge PRs #4, #3, #2 (`sample-02`, `Sample` — added the junk `bro` files)
- `b5e6ad7` Add launch configuration for development environment (`.claude/launch.json`)

#### 2026-09-27 — Loader iterations
- `4cae083` Load auth and data together before showing any UI
- `ebb811d` Polish loader and tab styling
- `ab2782a`, `a294acc`, `1f6ec56`, `9ea8141`, `0cfa10f`, `55519c8`, `7157478` — a series of loader experiments (spinning ring → winding path with travelling dot → animation inside the logo → plain logo). The current code renders the route mark with a travelling light (see `GoalPathLoader`).

#### 2026-09-23
- `8c07829` Remove Today edit/delete buttons and add Goal Path connecting loader

#### 2026-09-22 — Brand palette, neumorphism, back button
- `b0422e0` Make the back button walk inside the app with double-back to exit
- `4893188` Turn the client list into rows and make the quiet controls look clickable
- `14e486d` **Restyle the interface as neumorphism in the brandkit palette**
- `6f99051` Repaint the app in the brandkit palette and fix double-stepping tabs

#### 2026-09-21 — Per-goal permissions, profiles, phone navigation
- `729e067` Reframe the goal detail header around the goal itself
- `4f97deb` Make the goals dashboard header compact
- `4782263` Trim the client workspace view and drop the duplicate New Goal button
- `92c9b96` **Add a floating phone tab bar with swipe navigation**
- `d8dbd34` **Add per-goal permissions, professional profiles and mobile improvements** (introduced `viewerUids`/`editorUids`, `publicProfiles`, view/edit levels)

#### 2026-09-19
- `e470a8c` feat: add UI components and goal utilities

#### 2026-08-26 — Project start
- `74feea1` feat: initialize goal-path application (React + Firebase, AI Studio origin)
- `894c0d7` Initial commit
