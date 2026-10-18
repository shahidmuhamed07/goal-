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
- `npm run lint` (`tsc --noEmit`) passes with no errors. There are no automated tests in the repo (the routine logic has 18 checks that live outside it — see the changelog).
- Production = `main` on Firebase Hosting (auto-deploy). Firestore rules are deployed manually; **whether the deployed rules match `firestore.rules` has not been checked.**
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
| Engagement | Daily streak (current / longest / at-risk) | 🟡 | Counts the *scheduled* date of completed tasks; "today" uses UTC (see Known issues) |
| Collaboration | Connection code, access requests, approve/deny with per-goal view/edit | ✅ | |
| Collaboration | Professional roster, workspace switcher, client workspace | ✅ | |
| Collaboration | Per-subcategory role tags | 🟡 | UI-only restriction, not enforced by rules |
| Collaboration | Remove professional (client) / remove client (professional) / leave professional mode | 🟡 | Professional-initiated removal completes only when the client next opens the app |
| Collaboration | Professional public profile (qualifications, work, contact) | ✅ | Links, no file uploads |
| Collaboration | In-app chat with unread badges | 🟡 | Not restricted to connected pairs by rules; history unpaginated |
| Shell | Phone floating tab bar + centred "+" | ✅ | |
| Shell | Swipe navigation between tabs | ✅ | |
| Shell | Back-button handling, double-back to exit | ✅ | |
| Shell | Branded loader, Lovi-style pastel theme, reduced-motion support | ✅ | |
| Platform | CI deploy to Firebase Hosting on push to `main` | ✅ | Hosting only |
| Platform | Automated tests | ⬜ | None exist |
| Platform | AI/Gemini features | ⬜ | SDK listed in `package.json`, never used |
| Platform | Notifications (push/email) | ⬜ | |

## Known issues & tech debt

Found by reading the code on 2026-10-11; none of these have been reproduced unless stated. Delete an item when it is fixed.

**Correctness**
1. **UTC vs local "today".** `getTodayDateString()` (`utils.ts`) returns the **UTC** date (`toISOString`), while `getCurrentMonthKey()` and `getMonthDays()` use **local** time. Near local midnight (or for users far from UTC, e.g. UTC+5:30 between 00:00 and 05:30), "today", the streak and today's tasks can point at the previous day, and month/day can disagree at month boundaries.
2. **Streak semantics.** `computeStreak` counts `task.date` of completed tasks; tasks have no completion timestamp. Checking off yesterday's task today credits yesterday.
3. **Concurrent edits overwrite.** Tasks/milestones/subcategories are written as whole arrays from local state; a client and a professional editing the same goal at once can lose changes.
4. **Possible lossy legacy-access migration** in `handleSaveGoalCollaboratorAssignments` (details: [backend-rules.md §7](backend-rules.md)).

**Security (details in [backend-rules.md §7](backend-rules.md))**
5. `accessRequests` create is loosely validated (status / doc id not pinned).
6. Chat threads can be created with any uid; the connected-pair limit is UI-only.
7. Subcategory `editorRole` is not enforced by rules.
8. Professional removal depends on the client's browser.

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
17. `firebase-blueprint.json` is stale (missing `publicProfiles`, `chats`, several fields).
18. `.vscode/launch.json` (untracked) points Chrome at port 8080; the dev server runs on 3000.

**UI polish**
19. Top bar in a client workspace always says "Trainer Mode", even for Dietitian/Doctor.
20. A native `<select>` is still used for the role picker in `CollaboratorsPanel` while `AppSelect` exists.
20a. Older screens (Goals cards, header, a few panels) still colour owner vs professional with `isOwner` ternaries instead of the new tone variables; they look right but the pattern should not spread.
21. Tailwind class names (`emerald`, `violet`, `blue`) no longer match the colours they render; documented in [ui-context.md](ui-context.md) but easy to trip over.

## Open questions for the owner

(Not decisions — things the docs could not determine from the code.)

- Are the deployed Firestore rules identical to `firestore.rules`? When were they last deployed?
- Is anything planned for the Gemini/AI dependency, or should it be removed?
- Should `Staging/testing` be a formal staging channel (separate Hosting channel/project) or just a working branch?
- Should the leftover template files/dependencies (items 13–16) be cleaned up?
- What is in `origin/fix/collaborator-edit-permissions` and is it still needed?

---

## Changelog

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
