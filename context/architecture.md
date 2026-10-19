# Architecture

> Read this for: where code lives, how data flows, how permissions/workspaces/navigation work, how to build and deploy.
> For field-level data model and security rules → [backend-rules.md](backend-rules.md). For look & feel → [ui-context.md](ui-context.md).
> Last verified against the code: 2026-10-18 (branch `feature/mongo-data`: goals, profiles, connections and chat moved from Firestore to our own API + MongoDB).
> **Repo layout changed on 2026-10-14:** the app now lives in `apps/web/`. A path written here as `src/…` means `apps/web/src/…`. See the root `README.md` for the full layout.

## 1. System shape

```
┌──────────────────────────── Browser / phone (SPA, no router) ────────────────────────────┐
│  main.tsx → App.tsx                                                                      │
│     ├─ owns ALL state (useState); data comes from one polled answer (`/api/overview`)    │
│     │  and every change goes through `appApi` (src/api/)                                 │
│     ├─ renders views by `activeTab`: dashboard | today | detail | connect | professional │
│     └─ components/*  (mostly presentational; props in, callbacks out; ChatPanel and      │
│        ProfessionalProfilePanel call `appApi` themselves)                                │
└───────────────┬───────────────────────────────────────────────┬──────────────────────────┘
                │ firebase/auth (sign-in only)                  │ fetch + Bearer <Firebase ID token>
                ▼                                               ▼
        Firebase Authentication                       API (apps/api, Express on Render)
        (Google, Email/Password)                         ├─ verifies the token → who is asking
                                                         ├─ decides who may see/change what
                                                         └─ MongoDB Atlas (users, goals, requests, chats…)

The admin dashboard (apps/admin, static site) talks to the same API under /api/admin.
The app's static files are served by Firebase Hosting (apps/web/dist), deployed by GitHub Actions on push to `main`.
```

Firebase is used for **login only**. Everything else is our own API, and **the API is the security**: access is decided in `apps/api/src/userRoutes.ts` and pinned by its tests (see [backend-rules.md](backend-rules.md)). The UI hiding controls is a courtesy, not protection.

## 2. Source map

| File | Responsibility |
|---|---|
| `src/main.tsx` | Mounts `<App />` in `StrictMode`, imports `index.css`. |
| `src/App.tsx` (~3,600 lines) | Auth listener, account setup, the overview poll, every write handler, permission helpers, swipe + back-button navigation, header/tab bars, and the JSX of the Dashboard, Today and Goal-detail views. Also renders the modals. |
| `src/firebase.ts` | `initializeApp`, `auth`, `googleProvider` (sign-in only). Config comes from `firebase-applet-config.json`. |
| `src/api/` | The app's side of the API. `config.ts` (`API_URL`), `client.ts` (`api()`: adds the login token, renews it once on 401, turns failures into `ApiError`), `appApi.ts` (every call, typed), `usePolling.ts` (keeps data fresh every few seconds, pauses when hidden, refreshes on focus; `touch()` discards answers that predate a local change). |
| `src/navigation.ts` | The tab order, which tab is home (Goals) and where back goes. Pure, tested. |
| `src/types.ts` | Re-exports the shared types (they live in `packages/shared/src/app.ts`, which the API uses too): `Goal`, `Milestone`, `Subcategory`, `TaskItem`, `UserProfile`, `Collaborator`, `AccessRequest`, `ProfessionalProfile`, `ChatThread`, `ChatMessage`, `GoalAccessLevel`, `AccountPersona`, `ProfessionalRole`. |
| `src/utils.ts` | Date/month helpers, `computeStreak`, access helpers re-exported from the shared package (`getGoalAccessLevel`, `buildGoalAccessArrays`), `GOAL_CATEGORIES`, `PROFESSIONAL_ROLES`. |
| `src/chat.ts` | `chatIdFor(uidA, uidB)` (from the shared package) and `threadHasUnread(thread, uid)`. |
| `src/recurrence.ts` | **Weekly routines**, as pure functions (no React, no network): week/date helpers (`getWeekDates`, `weekdayOf`, `goalEndDate`…), `createSeries`, `applySeriesDays` (also the dry run for previews), `addTaskForward`, `updateFrom`, `removeSubcategories`, `countLater`, and the size guard (`MAX_GOAL_CONTENT_BYTES`, `estimateBytes`). All dates are UTC calendar strings, so a weekday never shifts with the timezone. |
| `src/fitnessPlan.ts` | **The fitness framework for "Help me plan"**, pure and tested (`fitnessPlan.test.ts`, ~17,000 combinations checked). From the aim, the place, the level, the limits and the training days and session time it picks the week's structure (full body, upper/lower, push/pull/legs, strength plus intervals and cardio, mobility…), the exercises for each session from a small library per place, as many exercises as the time allows (always a warm up and a stretch), the doses for the level, and gentler swaps for sore knees, back, shoulders or breathlessness. The description names the training days and the rest days. Called through the niche's `plan(answers, common)`. |
| `src/missed.ts` | **Missed tasks**, pure: `findMissedTasks` (unfinished, not skipped, before today, within 14 days), `moveTasksToDay` (into a same-named subcategory on that day, created if missing, never an `undefined` field) and `skipTasks` (`skipped: true`), and **pushing a weekly routine forward**: `findPushableRoutines` (routines with missed days that follow weekdays) and `pushRoutineForward` (the missed days and every later, not-yet-started day slide in order onto the routine's own weekdays from today, optionally on changed days or every other week; days that no longer fit before the goal ends come off the plan; days that were started stay put). `App.tsx` handlers write the result; the dialog is `PushPlanDialog`. |
| `src/cms/` | Content from the admin. `useLiveBanners.ts` (`useLiveContent`: banners, popups, pages, refreshed each minute), `CmsBanners.tsx`, `CmsPopups.tsx` (the popup and the page dialog), `links.ts` (`/pages/x` opens a page, https opens a tab, the rest is ignored) and `popupRules.ts` (which popup to show: once / daily / every visit). |
| `src/categoryPresets.ts` | `CATEGORY_PRESETS` and `getCategoryPresets(category, title)` (direct match → keyword heuristics → "Personal Development" fallback). |
| `src/index.css` | Theme tokens (`@theme`: remapped palette, Figtree + Bricolage Grotesque), the pastel surface/chip/button classes, splash/orb/sheet/option parts, segmented control, motion. |
| `src/components/*` | See the component table in [ui-context.md](ui-context.md#7-component-inventory). New shared pieces: `MenuButton` (the ⋯ menu) and `WeekdayPicker` (M T W T F S S). |
| `src/loader-demo.tsx` + `loader-demo.html` | Dev-only page to preview the loader at `/loader-demo.html`. Not part of the production build (Vite builds `index.html` only). |

## 3. Anatomy of `App.tsx`

Top to bottom:

1. **Helpers**: `useSegmentedTrack` (measures the active tab to slide the pill), `mapGoalDoc` / `normalizeGoal` (fills in anything an older goal lacks), `apiProblem` (a short sentence for a failed call), `CATEGORY_ACCENTS` / `categoryAccent`.
2. **State groups**: auth (`user`, `authLoading`, `authError`), data (`goals`, `dataLoading`, banners), UI view state (`activeTab`, `selectedGoalId`, modals, filters, `dailyMasterDate`, `selectedGoalMonth`), workspace/collab (`profile`, `incomingRequests`, `outgoingRequests`, `clientList`, `workspaceUid`, `sharedGoals`; `activeClientProfile` is derived from `clientList`), chat (`chatThreads`, `chatTarget`).
3. **Effects** (the listeners table below).
4. **Derived values**: `isOwner`, `workspaceProfile`, `professionalRole`, `allTodayTasks`, `streakStats`, `navTabs`, `filteredGoals`, progress counters.
5. **Permission helpers**: `goalAccessLevel`, `canViewGoal`, `canEditGoal`, `canEditSubcategoryTasks`, `canEditTaskRecord`.
6. **Navigation**: swipe handling, `selectTab`, history back-trap.
7. **Write handlers** (`handleCreateGoal`, `handleToggleTask`, `handleApproveRequest`, …) — see §7.
8. **Render**: loader gate → login gate → shell (professional bar, banners, header, desktop tabs, `<main>` with the active view, footer, modals, exit toast, phone tab bar, persona prompt).

### Where the data comes from

| Piece | How | Feeds |
|---|---|---|
| Auth | `onAuthStateChanged` | `user` |
| Account setup | After sign-in, `appApi.sync()` creates the account (and its invite code) if new. A failed try is retried every 4 s. Nothing waits for it except a brand-new account: the overview is asked for at the same time, and only if it answers "no account yet" does it wait for setup and ask again. `serverSlow` shows "Waking up the server…" after 4 s without an answer. | `profile` |
| **Saved picture** | The last overview is kept on the device (`src/api/overviewCache.ts`, one key per account, at most every 30 s and when the page is left, removed on sign-out and ignored if it belongs to another account, is old or too large). On the next open the app shows it at once, with a small "Showing your last saved view. Connecting…" note, until the server answers. | `overview` until fresh data arrives |
| **Overview poll** | `usePolling(appApi.overview, 10 s)` once the account is ready. One answer holds the account, clients, incoming/outgoing requests, chat threads, own goals and goals shared with me. Pauses while the app is hidden, refreshes when it returns. | `profile`, `incomingRequests`, `outgoingRequests`, `chatThreads` (→ unread badges), `clientList`, `sharedGoals`, and `goals` |
| Goals for the open workspace | Derived from the overview: my own workspace → `overview.goals`; a client's → `overview.sharedGoals` filtered to that `userId`. Newest first. | `goals` |
| Chat messages | `ChatPanel` polls `appApi.messages` every 3 s while open; sending adds the message at once and refetches. | the open conversation |

**Changing data** — `saveGoal(goalId, changes)` shows the change at once, sends `PATCH /api/goals/:id`, and on failure fetches the real state back and rethrows so the handler can say what went wrong. Other handlers call `appApi` then `afterAccessChange()`/`overviewPoll.refresh()`. Any local change calls `overviewPoll.touch()` so an answer that was already on its way cannot undo it.

> **Constraint:** the server decides access. A new read needs a route, a permission check and a test in `userRoutes.test.ts`; the app only ever asks for what the caller may see.

## 4. Workspace model

- `workspaceUid` starts as the signed-in user's uid. `handleSwitchWorkspace(uid)` changes it; the goals shown are re-derived from the overview.
- `isOwner = workspaceUid === user.uid`. **Almost every UI difference between "my goals" and "a client's goals" derives from `isOwner`.**
- A safety effect returns the user to their own workspace if the open client disappears from `clientList` (for example after being removed).
- `isProfessional = clientList.length > 0 || profile.persona === 'professional'`.

## 5. Permission resolution (UI side)

The UI mirrors the server's rules so controls only appear when a change will succeed. **The server is the real enforcement** (a refused change answers 403/404 and the app fetches the real state back).

```
goalAccessLevel(goalId):
  isOwner                         → 'edit'
  user.uid ∈ goal.editorUids      → 'edit'
  user.uid ∈ goal.viewerUids      → 'view'
  otherwise                       → null (not shared)

canEditGoal            = goalAccessLevel === 'edit'
canEditSubcategoryTasks(goalId, sub):
  owner → true
  !canEditGoal → false
  sub has no editorRole ("Client & Pros") → true
  otherwise → professionalRole equals sub.editorRole (case-insensitive)
canEditTaskRecord      = canEditSubcategoryTasks for the task's subcategory (tasks with none → true if canEditGoal)
```

What is enforced where:

| Rule | Enforced by the API | UI only |
|---|---|---|
| Only the owner changes title/category/description/target date/access lists, or deletes a goal | ✅ | also hidden |
| Editors may only touch `tasks`, `subcategories`, `milestones` | ✅ (editor allow-list in `PATCH /goals/:id`) | — |
| View-only professionals cannot write | ✅ | also hidden |
| **Subcategory `editorRole` restriction** (only the matching role edits that routine) | ❌ | ✅ — an *edit*-level professional could still write any task via a crafted request (known gap, [backend-rules.md §7](backend-rules.md)) |

## 6. Navigation

- **Tabs** (`activeTab`): `dashboard` (labelled *Goals*), `today`, `connect` (*Collaborate*), `professional` (labelled *Profile*, or *Professional* for professionals; **owner workspace only**), plus the pseudo-tab `detail` (a goal opened from the dashboard; highlights *Goals*).
- `selectTab()` is the helper that keeps slide direction and scroll position consistent; the tab bars and the header logo use it. Many other spots call `setActiveTab()` directly (dashboard stat cards, "View Roadmap" buttons, goal open/close, workspace switch, persona handlers, the back handler, swipe commit) and skip the direction bookkeeping — that is existing behaviour, not a design rule.
- **Swipe**: a horizontal touch drag on `<main>` moves to the neighbouring tab in `swipeTabs` order (`dashboard → today → connect → professional`, from `src/navigation.ts`). It ignores inputs, `[data-no-swipe]`, and rows that scroll sideways; the content follows the finger and slides out/in.
- **Back button** (`popstate` + a history "trap" entry): closes the top-most layer first (account menu → create modal → assignment modal → give-up modal → persona picker → goal header editing), then detail → Goals, then any tab → Goals, then on Goals shows "Press back again to leave" and lets a second back within 2 s exit.
- The view switcher pill (`useSegmentedTrack`) measures the live DOM, so new tabs/labels/badges need no width constants.

## 7. Key flows

**Sign-in & bootstrap**
0. *Google sign-in* (`handleGoogleSignIn`): a ref (`googleSignInBusy`) ignores a second click while one attempt is running. `signInWithPopup` first. Only if the popup cannot open (`auth/popup-blocked`, `auth/operation-not-supported-in-this-environment`) does it show a neutral notice and fall back to `signInWithRedirect`. Closing the popup (`auth/popup-closed-by-user`) shows a notice and stays put; `auth/cancelled-popup-request` is ignored. On every page load `getRedirectResult(auth)` runs so a failed redirect sign-in surfaces as an error instead of a silent return to the login page. Email/password sign-in lives in `LoginScreen`.
1. `onAuthStateChanged` sets `user`. A loader (`GoalPathLoader`) shows until auth *and* the first overview are ready (with a "Waking up the server…" line when the API is slow).
2. `appApi.sync()` (`POST /api/me/sync`): the API creates the account with a unique 6-character code on first use (the database's unique index on `code` guarantees uniqueness; the server retries on collision) or refreshes name/email/photo from the login token. Then the overview poll starts.
3. A brand-new owner account (no `persona`, no `onboardedAt`, no goals) opens the full-screen `Onboarding` questions (skippable; also reachable from the account menu → "Start a guided plan"). `handleFinishOnboarding` creates one goal per chosen focus (max 3, from `buildStarterPlans` in `src/starterPlan.ts`) with starter weekly routines written through `materializePlan`/`createSeries`, then stores `persona`, `personaChosenAt`, `onboardedAt` and the answers (`onboarding`, only answered keys) through `PATCH /api/me`. Professionals get just the persona saved.

**Create a goal** (`handleCreateGoal`, owner only)
1. `CreateGoalModal` returns `{ title, category, description, targetDate, assignedProfessionalUids }`; target = current month + N (1–24).
2. One milestone is generated for every month from the current month through the target month inclusive (`Checkpoint for <Mon YYYY>`, last is `Final: Complete <title>`).
3. `appApi.createGoal(...)` (`POST /api/goals`). The server sets the owner and the access lists; professionals picked here get `edit` on the new goal (recorded on the goal and on the owner's roster together).
4. The new goal is pushed into local state immediately (so the detail view is not blank) and opened.

**Connect a professional**
1. Professional enters the client's code + role → `handleRequestAccess` checks length/role/not-own-code, then `POST /api/access-requests`. The server looks the code up and answers `sent`, `sent_again` (a denied or removed request is re-opened) or an error (`not_found`, `own_account`, `already_pending`, `already_approved`).
2. Client sees it under *Pending requests* (the overview poll brings it within ~10 s), chooses view/edit per goal (nothing preselected) and approves → `POST /api/access-requests/:id/approve`: the server updates the roster, marks the request `approved` and recomputes the goals' access lists.
3. Client can later change levels (`PUT /api/collaborators/:uid/access`, `PUT /api/goals/:id/assignments`) or remove the professional (`DELETE /api/collaborators/:uid`). Every one of these ends with the server resyncing the access lists.

**Professional removes a client / leaves professional mode**
`DELETE /api/clients/:id` removes the professional from the client's roster and goal access lists straight away and marks the request `removed`. `POST /api/me/leave-professional` does this for every client and sets `persona: 'client'` (the public profile is kept). Nothing waits for the client's app any more.

**Chat**
`chatId = sort([uidA, uidB]).join('__')`. Sending is `POST /api/chats/:id/messages` (sender and time come from the server; allowed only while the two are connected); the thread's `lastMessage`/`lastRead` update in the same call. Opening a thread calls `POST /api/chats/:id/read`. Unread = last message is from the other user and newer than my `lastRead`. While a conversation is open it is refreshed every 3 s. The panel sizes itself to `visualViewport` so the phone keyboard does not push the header off-screen.

**Task / milestone / subcategory edits**
Every edit is read-modify-write of a whole embedded array: copy `goal.tasks` (from local state), change it, `saveGoal(id, { tasks })` (shown at once, then `PATCH /api/goals/:id`). The next overview confirms it.

**Opening a goal** — `openGoal(goalId, date?)` in `App.tsx`. From a goal card's body or title it opens on today; from a day on the card's week strip it sets `selectedGoalMonth` to that day's month and `selectedGoalDate` to the day, and `DailyTaskSection` (which owns the selected date) starts on it through its `initialDate` prop. `selectedGoalDate` is cleared whenever the tab is not `detail`, so it only affects the opening.

**Weekly routines** ("Chest day every Tuesday and Thursday")
A routine is **not a new record**. Planning is date-based (a subcategory and its tasks belong to one `YYYY-MM-DD`), so a routine is the same subcategory *written onto every matching day* from a start date to the end of the goal (the end of its last month), with a shared `repeatId` and the weekday list in `repeatDays`. Today's view, progress, the streak and the server rules keep working without knowing routines exist.
- **Create** — add form → `handleAddRepeatingSubcategory` → `createSeries` → one `saveGoal` of `subcategories`.
- **Change days / stop** — block ⋯ → `handleChangeSubcategoryRepeat` → `applySeriesDays`: later days on a dropped weekday are removed with their tasks, missing ones are added (each starting with a copy of the anchor day's tasks, uncompleted), **earlier days are never touched**; `[]` stops the routine after this day. One `saveGoal` of both arrays.
- **Add a task** — `handleAddTask(..., forward)` → `addTaskForward` puts it on this day and every later day of the routine. Completing, editing and deleting a task stay per day.
- **Rename / re-tag** — `updateFrom` applies to this day and later days of the routine. **Delete** — `handleDeleteSubcategory(..., 'one' | 'future')`.
- **Size guard** — a goal is one stored document (the server caps it at about 1 MB). `fitsInGoalDocument` refuses any write that would push subcategories + tasks past `MAX_GOAL_CONTENT_BYTES` (900 KB) with a plain message. Measured: Tue/Thu × 6 tasks × 6 months ≈ 52 KB; Mon/Wed/Fri × 8 tasks × 2 years ≈ 439 KB; every day × 12 tasks × 2 years ≈ 1.5 MB (refused).
- **Limits** — a routine ends with the goal's last month; extending the goal later (give-up → extend) does **not** extend existing routines. Subcategories saved without a date cannot be repeated.

**Streak** (`computeStreak`)
A day counts when ≥ 1 task **scheduled on that date** is completed (it uses `task.date`, not a completion timestamp). `current` runs back from today, or from yesterday if today is still empty (then `atRisk`). Computed over whichever workspace's goals are open.

**Give up / extend**
`GiveUpInterventionModal` (Reflect → Solutions → Confirm). *Extend* → `handleExtendGoalDeadline` appends N `Extended Focus (<Month Year>)` milestones and moves `targetDate`. *Confirm* → `handleGiveUpGoal` → `DELETE /api/goals/:id` (permanent).

## 8. Build, run, deploy

| Task | Command / fact |
|---|---|
| Install | `npm install` (CI uses `npm ci`, so keep `package-lock.json` in sync) |
| Dev server | `npm run dev` → Vite on port **3000**, host `0.0.0.0` (also configured in `.claude/launch.json`). Note `.vscode/launch.json` points Chrome at port 8080 — that does not match. |
| Type-check | `npm run lint` (= `tsc --noEmit`). Baseline on 2026-10-11: passes with no errors. |
| Production build | `npm run build` → `dist/` |
| Deploy | Push/merge to `main` → `.github/workflows/firebase-hosting-merge.yml`: Node 20, `npm ci`, `npm run build`, `FirebaseExtended/action-hosting-deploy` to the `live` channel. Secrets: `FIREBASE_SERVICE_ACCOUNT`, `FIREBASE_PROJECT_ID`. |
| Deploy (admin) | Push/merge to `main` touching `apps/admin`, `packages/shared` or `deploy/admin` → `.github/workflows/firebase-admin-hosting.yml` builds the admin (`VITE_API_URL` = the Render API) and deploys `deploy/admin/firebase.json` to the Hosting site `goal-path-admin`, which must exist first. Also runnable by hand from the Actions tab. |
| API | Render deploys `apps/api` from `main` by itself. Settings are in the Render environment (see [backend-rules.md §1](backend-rules.md)). **Merging a change that needs new API routes deploys the web app within minutes and the API a few minutes later; for a short while the app may show errors.** |
| Keep the API awake | An outside uptime service (UptimeRobot or cron-job.org, free) calls `GET /health` every 5 minutes; see README. A GitHub scheduled job was tried and removed (GitHub ran it only every 2 to 4 hours). The app also wakes the API itself the moment a page opens (`src/api/wake.ts`). |
| Hosting config | SPA rewrite (`** → /index.html`); everything `no-cache` except `/assets/**` (immutable, 1 year). |

**Treat `main` as production.** Merging deploys immediately. Work on a branch (e.g. `Staging/testing`) and merge via PR.

## 9. Configuration & secrets

- `firebase-applet-config.json` holds the Firebase **web** config (API key, project id, app id…). Firebase web keys are public identifiers, not secrets; real protection is the API's checks and the Authorized Domains list in the Firebase console (the login screen detects `unauthorized-domain` errors and shows the hostname to add).
- `.env*` is git-ignored except `.env.example`. The web app reads one build-time variable, `VITE_API_URL` (set in the GitHub workflow; defaults to the local API in development).
- A service-account key filename is git-ignored (`*-firebase-adminsdk-*.json`). Never commit credentials.
- `vite.config.ts` defines the `@` alias (project root) and an AI-Studio-specific `DISABLE_HMR` switch. Leave the HMR comment/logic alone unless you know why it is there.

## 10. Template leftovers (safe to know about, not yet cleaned)

- `package.json` name is `react-example`; `express`, `dotenv`, `tsx`, `esbuild`, `@types/express`, `@google/genai` are unused; the `clean` script mentions `server.js`, which does not exist.
- `.env.example` / `metadata.json` describe the AI Studio origin (Gemini key, "server-side Gemini API" capability) — nothing in the app uses it.
- `bun.lock` coexists with `package-lock.json`; CI uses npm.
- `.claude/shahid.js/bro` and `bro2` are junk files from early PR experiments.
- `assets/.aistudio/.gitignore` is a tracked AI Studio artifact.

## 11. Architectural constraints (do not violate without discussing)

1. **The API is the security.** Every permission lives in `apps/api/src/userRoutes.ts` with a test in `userRoutes.test.ts`. The UI mirrors it for convenience only. Never take "who is asking" from a request body.
2. **Server and UI must agree.** A new permission is added to the API (and tested) first, then mirrored in the UI helpers.
3. **Goal content stays embedded** (`tasks`, `subcategories`, `milestones` inside the goal document) — the editor allow-list in `PATCH /goals/:id` depends on those three keys. This is also why routines are materialised onto days rather than stored as a separate "series" record.
4. **Reads come through the overview** (or a dedicated route) and are decided by the server; the app never asks for something it may not see.
5. **Writes to goals, requests and accounts live in `App.tsx` handlers** that call `appApi`, guarded by a permission check. Components call callbacks; they do not write that data themselves. Routine logic itself lives in `src/recurrence.ts` as pure functions; handlers call it and write the result. (The only component-level API calls are chat messages in `ChatPanel` and the public profile in `ProfessionalProfilePanel`/`CollaboratorsPanel`.)
6. **Prefer `selectTab()` for switching between top-level tabs** from the nav bars so the slide animation direction is right.
