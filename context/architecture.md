# Architecture

> Read this for: where code lives, how data flows, how permissions/workspaces/navigation work, how to build and deploy.
> For field-level data model and security rules → [backend-rules.md](backend-rules.md). For look & feel → [ui-context.md](ui-context.md).
> Last verified against the code: 2026-10-11 (commit `1e75ab7` plus the uncommitted "uniform design + goal editing flow" change).
> **Repo layout changed on 2026-10-14:** the app now lives in `apps/web/`. A path written here as `src/…` means `apps/web/src/…`. See the root `README.md` for the full layout.

## 1. System shape

```
┌──────────────────────────────── Browser (SPA, no router) ────────────────────────────────┐
│  main.tsx → App.tsx                                                                      │
│     ├─ owns ALL state (useState) and ALL Firestore reads/writes for goals, requests,     │
│     │  profile, clients                                                                  │
│     ├─ renders views by `activeTab`: dashboard | today | detail | connect | professional │
│     └─ components/*  (mostly presentational; props in, callbacks out)                    │
│          └─ exceptions that talk to Firestore themselves:                                │
│             ChatPanel, ProfessionalProfilePanel, CollaboratorsPanel (read-only fetch)    │
└───────────────┬───────────────────────────────────────────────┬──────────────────────────┘
                │ firebase/auth                                 │ firebase/firestore (onSnapshot, updateDoc…)
                ▼                                               ▼
        Firebase Authentication                       Cloud Firestore  ◄── firestore.rules enforce access
        (Google, Email/Password)                      (default DB, project goal-path-9f4cc)

Static files are served by Firebase Hosting (dist/), deployed by GitHub Actions on push to `main`.
```

There is **no application server**. Security is enforced only by Firestore rules plus the UI hiding controls. Anything that must be secret or authoritative has to be expressed in `firestore.rules`.

## 2. Source map

| File | Responsibility |
|---|---|
| `src/main.tsx` | Mounts `<App />` in `StrictMode`, imports `index.css`. |
| `src/App.tsx` (~3,600 lines) | Auth listener, profile bootstrap, every realtime listener, every write handler, permission helpers, swipe + back-button navigation, header/tab bars, and the JSX of the Dashboard, Today and Goal-detail views. Also renders the modals. |
| `src/firebase.ts` | `initializeApp`, `auth`, `db` (Firestore with `experimentalAutoDetectLongPolling`), `googleProvider`. Config comes from `firebase-applet-config.json`. |
| `src/types.ts` | All shared types: `Goal`, `Milestone`, `Subcategory`, `TaskItem`, `UserProfile`, `Collaborator`, `AccessRequest`, `ProfessionalProfile`, `ChatThread`, `ChatMessage`, `GoalAccessLevel`, `AccountPersona`, `ProfessionalRole`. |
| `src/utils.ts` | Date/month helpers, `computeStreak`, access helpers (`getGoalAccessLevel`, `buildGoalAccessArrays`), `generateInviteCode`, `requestDocId`, `GOAL_CATEGORIES`, `PROFESSIONAL_ROLES`. |
| `src/chat.ts` | `chatIdFor(uidA, uidB)` and `threadHasUnread(thread, uid)`. |
| `src/recurrence.ts` | **Weekly routines**, as pure functions (no React, no Firestore): week/date helpers (`getWeekDates`, `weekdayOf`, `goalEndDate`…), `createSeries`, `applySeriesDays` (also the dry run for previews), `addTaskForward`, `updateFrom`, `removeSubcategories`, `countLater`, and the size guard (`MAX_GOAL_CONTENT_BYTES`, `estimateBytes`). All dates are UTC calendar strings, so a weekday never shifts with the timezone. |
| `src/missed.ts` | **Missed tasks**, pure: `findMissedTasks` (unfinished, not skipped, before today, within 14 days), `moveTasksToDay` (into a same-named subcategory on that day, created if missing, never an `undefined` field) and `skipTasks` (`skipped: true`). `App.tsx` handlers write the result. |
| `src/cms/` | Content from the admin. `useLiveBanners.ts` (`useLiveContent`: banners, popups, pages, refreshed each minute), `CmsBanners.tsx`, `CmsPopups.tsx` (the popup and the page dialog), `links.ts` (`/pages/x` opens a page, https opens a tab, the rest is ignored) and `popupRules.ts` (which popup to show: once / daily / every visit). |
| `src/categoryPresets.ts` | `CATEGORY_PRESETS` and `getCategoryPresets(category, title)` (direct match → keyword heuristics → "Personal Development" fallback). |
| `src/index.css` | Theme tokens (`@theme`: remapped palette, Figtree + Bricolage Grotesque), the pastel surface/chip/button classes, splash/orb/sheet/option parts, segmented control, motion. |
| `src/components/*` | See the component table in [ui-context.md](ui-context.md#7-component-inventory). New shared pieces: `MenuButton` (the ⋯ menu) and `WeekdayPicker` (M T W T F S S). |
| `src/loader-demo.tsx` + `loader-demo.html` | Dev-only page to preview the loader at `/loader-demo.html`. Not part of the production build (Vite builds `index.html` only). |

## 3. Anatomy of `App.tsx`

Top to bottom:

1. **Helpers**: `useSegmentedTrack` (measures the active tab to slide the pill), `mapGoalDoc` (Firestore doc → `Goal`), `CATEGORY_ACCENTS` / `categoryAccent`, `ensureUserProfile`.
2. **State groups**: auth (`user`, `authLoading`, `authError`), data (`goals`, `dataLoading`, banners), UI view state (`activeTab`, `selectedGoalId`, modals, filters, `dailyMasterDate`, `selectedGoalMonth`), workspace/collab (`profile`, `incomingRequests`, `outgoingRequests`, `clientList`, `withdrawnClientIds`, `workspaceUid`, `sharedGoals`, `activeClientProfile`), chat (`chatThreads`, `chatTarget`).
3. **Effects** (the listeners table below).
4. **Derived values**: `isOwner`, `workspaceProfile`, `professionalRole`, `allTodayTasks`, `streakStats`, `navTabs`, `filteredGoals`, progress counters.
5. **Permission helpers**: `goalAccessLevel`, `canViewGoal`, `canEditGoal`, `canEditSubcategoryTasks`, `canEditTaskRecord`.
6. **Navigation**: swipe handling, `selectTab`, history back-trap.
7. **Write handlers** (`handleCreateGoal`, `handleToggleTask`, `handleApproveRequest`, …) — see §7.
8. **Render**: loader gate → login gate → shell (professional bar, banners, header, desktop tabs, `<main>` with the active view, footer, modals, exit toast, phone tab bar, persona prompt).

### Realtime listeners

| Listener (effect) | Query | Feeds | Why this shape |
|---|---|---|---|
| Auth | `onAuthStateChanged` | `user` | — |
| My profile | `doc(users/{me})` | `profile`, `withdrawnClientIds` | — |
| Access requests | `accessRequests where toUid == me` and `… where fromUid == me` | `incomingRequests`, `outgoingRequests` | Rules allow reading a request only to its two participants. |
| Chat threads | `chats where participantUids array-contains me` | `chatThreads` → unread badges | Account-wide, not workspace-scoped, so a new message shows anywhere. |
| Client list | `users where collaboratorUids array-contains me` | `clientList` | Rules let a professional read a client's user doc only while listed in `collaboratorUids`. |
| Active client profile | `doc(users/{workspaceUid})` (only when not owner) | `activeClientProfile` | — |
| **Goals for the open workspace** | Own workspace: `goals where userId == workspaceUid`. Client workspace: `goals where viewerUids array-contains me`, then client-side filter to `userId === workspaceUid`. | `goals` | The rules can only *prove* these two query shapes. A professional cannot query "all goals of client X". |
| Shared goals (professionals only) | `goals where viewerUids array-contains me` | `sharedGoals` (per-client "assigned sessions" counts on the dashboard) | The workspace listener only loads one workspace at a time. |

> **Constraint:** if you add a Firestore query, make sure `firestore.rules` can prove it from the query constraints alone, otherwise it fails with `permission-denied` even for legitimate users.

## 4. Workspace model

- `workspaceUid` starts as the signed-in user's uid. `handleSwitchWorkspace(uid)` changes it; the goals listener re-subscribes.
- `isOwner = workspaceUid === user.uid`. **Almost every UI difference between "my goals" and "a client's goals" derives from `isOwner`.**
- A safety effect returns the user to their own workspace if the open client disappears from `visibleClients`.
- `visibleClients` = `clientList` minus `withdrawnClientIds` (clients this professional removed; stored on their own profile as `withdrawnClients` so it follows them across devices).
- `isProfessional = clientList.length > 0 || profile.persona === 'professional'`.

## 5. Permission resolution (UI side)

The UI mirrors the rules so controls only appear when the write will succeed. **The rules are the real enforcement.**

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

| Rule | Enforced by Firestore rules | UI only |
|---|---|---|
| Only the owner changes title/category/description/target date/access lists, or deletes a goal | ✅ | also hidden |
| Editors may only touch `tasks`, `subcategories`, `milestones` | ✅ (`contentOnlyChange`) | — |
| View-only professionals cannot write | ✅ | also hidden |
| **Subcategory `editorRole` restriction** (only the matching role edits that routine) | ❌ | ✅ — an *edit*-level professional could still write any task via a crafted request |

## 6. Navigation

- **Tabs** (`activeTab`): `dashboard` (labelled *Goals*), `today`, `connect` (*Collaborate*), `professional` (labelled *Profile*, or *Professional* for professionals; **owner workspace only**), plus the pseudo-tab `detail` (a goal opened from the dashboard; highlights *Goals*).
- `selectTab()` is the helper that keeps slide direction and scroll position consistent; the tab bars and the header logo use it. Many other spots call `setActiveTab()` directly (dashboard stat cards, "View Roadmap" buttons, goal open/close, workspace switch, persona handlers, the back handler, swipe commit) and skip the direction bookkeeping — that is existing behaviour, not a design rule.
- **Swipe**: a horizontal touch drag on `<main>` moves to the neighbouring tab in `swipeTabs` order (`dashboard → today → connect → professional`). It ignores inputs, `[data-no-swipe]`, and rows that scroll sideways; the content follows the finger and slides out/in.
- **Back button** (`popstate` + a history "trap" entry): closes the top-most layer first (account menu → create modal → assignment modal → give-up modal → persona picker → goal header editing), then detail → Goals, then any tab → Goals, then on Goals shows "Press back again to leave" and lets a second back within 2 s exit.
- The view switcher pill (`useSegmentedTrack`) measures the live DOM, so new tabs/labels/badges need no width constants.

## 7. Key flows

**Sign-in & bootstrap**
0. *Google sign-in* (`handleGoogleSignIn`): a ref (`googleSignInBusy`) ignores a second click while one attempt is running. `signInWithPopup` first. Only if the popup cannot open (`auth/popup-blocked`, `auth/operation-not-supported-in-this-environment`) does it show a neutral notice and fall back to `signInWithRedirect`. Closing the popup (`auth/popup-closed-by-user`) shows a notice and stays put; `auth/cancelled-popup-request` is ignored. On every page load `getRedirectResult(auth)` runs so a failed redirect sign-in surfaces as an error instead of a silent return to the login page. Email/password sign-in lives in `LoginScreen`.
1. `onAuthStateChanged` sets `user`. A loader (`GoalPathLoader`) shows until auth *and* the first goals snapshot are ready.
2. `ensureUserProfile(user)`: if `users/{uid}` exists with a `code`, refresh name/email/photo. Otherwise, up to 10 attempts: generate a 6-char code and in one **transaction** create `codes/{code}` = `{uid}` and `users/{uid}` (code, empty `collaborators`/`collaboratorUids`, `createdAt`). `CODE_TAKEN` → retry.
3. A brand-new owner account (no `persona`, no `onboardedAt`, no goals) opens the full-screen `Onboarding` questions (skippable; also reachable from the account menu → "Start a guided plan"). `handleFinishOnboarding` creates one goal per chosen focus (max 3, from `buildStarterPlans` in `src/starterPlan.ts`) with starter weekly routines written through `materializePlan`/`createSeries`, then stores `persona`, `personaChosenAt`, `onboardedAt` and the answers (`onboarding`, only answered keys, never `undefined`) on `users/{uid}`. Professionals get just the persona saved.

**Create a goal** (`handleCreateGoal`, owner only)
1. `CreateGoalModal` returns `{ title, category, description, targetDate, assignedProfessionalUids }`; target = current month + N (1–24).
2. One milestone is generated for every month from the current month through the target month inclusive (`Checkpoint for <Mon YYYY>`, last is `Final: Complete <title>`).
3. `addDoc(goals, …)`. If professionals were selected, they get `edit` on the new goal: `users/{me}.collaborators[].goalAccess[goalId] = 'edit'`, then `viewerUids`/`editorUids` are written on the goal.
4. The new goal is pushed into local state immediately (so the detail view is not blank) and opened.
5. Goals created before per-goal permissions existed lack `viewerUids`/`editorUids`; an owner-side effect backfills them once.

**Connect a professional**
1. Professional enters the client's code + role → `handleRequestAccess`: validates length/role/not-own-code, looks up `codes/{code}` → `toUid`, then **queries** `accessRequests` (from me, to them) instead of `getDoc` (reading a non-existent doc is denied by the rules).
   - none → `setDoc accessRequests/{from_to}` with `status: 'pending'`
   - `pending`/`approved` → friendly error
   - `denied`/`removed` → `updateDoc` back to `pending` with new `role`/`createdAt` (rules only allow those keys to change)
2. Client sees it under *Pending requests*, chooses view/edit per goal (nothing preselected) and approves → `handleApproveRequest`: replace the collaborator entry on `users/{me}` (+ `collaboratorUids`), set request `approved`, then `syncGoalAccess` writes `viewerUids`/`editorUids` on affected goals.
3. Client can later change levels (`handleUpdateAssignedGoals`, `handleSaveGoalCollaboratorAssignments`) or remove the professional (`handleRemoveCollaborator`: update roster, resync goal lists, mark request `removed`).

**Professional removes a client / leaves professional mode**
A professional cannot edit the client's `users` doc, so removal is cooperative: the professional records the client in their own `withdrawnClients`, marks the request `removed`, and hides the client locally. **The client's app finishes the job** — an effect watches incoming requests with status `removed` whose sender is still a collaborator and runs `handleRemoveCollaborator`. Until the client next opens the app, the professional's Firestore-level access still exists. `handleLeaveProfessional` does this for every client, then sets `persona: 'client'` (the public profile is kept).

**Chat**
`chatId = sort([uidA, uidB]).join('__')`. Sending first `setDoc(chats/{id}, { participantUids, updatedAt, lastMessage, lastRead[me] }, merge)` (the message rule reads the parent's member list, so the thread must exist), then `addDoc(chats/{id}/messages, …)`. Opening a thread marks it read via `lastRead[me]`. Unread = last message is from the other user and newer than my `lastRead`. The panel sizes itself to `visualViewport` so the phone keyboard does not push the header off-screen.

**Task / milestone / subcategory edits**
Every edit is read-modify-write of a whole embedded array: copy `goal.tasks` (from local state), change it, `updateDoc(goals/{id}, { tasks })`. The realtime listener then echoes the result back into state.

**Opening a goal** — `openGoal(goalId, date?)` in `App.tsx`. From a goal card's body or title it opens on today; from a day on the card's week strip it sets `selectedGoalMonth` to that day's month and `selectedGoalDate` to the day, and `DailyTaskSection` (which owns the selected date) starts on it through its `initialDate` prop. `selectedGoalDate` is cleared whenever the tab is not `detail`, so it only affects the opening.

**Weekly routines** ("Chest day every Tuesday and Thursday")
A routine is **not a new record**. Planning is date-based (a subcategory and its tasks belong to one `YYYY-MM-DD`), so a routine is the same subcategory *written onto every matching day* from a start date to the end of the goal (the end of its last month), with a shared `repeatId` and the weekday list in `repeatDays`. Today's view, progress, the streak and the Firestore rules keep working without knowing routines exist.
- **Create** — add form → `handleAddRepeatingSubcategory` → `createSeries` → one `updateDoc` of `subcategories`.
- **Change days / stop** — block ⋯ → `handleChangeSubcategoryRepeat` → `applySeriesDays`: later days on a dropped weekday are removed with their tasks, missing ones are added (each starting with a copy of the anchor day's tasks, uncompleted), **earlier days are never touched**; `[]` stops the routine after this day. One `updateDoc` of both arrays.
- **Add a task** — `handleAddTask(..., forward)` → `addTaskForward` puts it on this day and every later day of the routine. Completing, editing and deleting a task stay per day.
- **Rename / re-tag** — `updateFrom` applies to this day and later days of the routine. **Delete** — `handleDeleteSubcategory(..., 'one' | 'future')`.
- **Size guard** — a goal is one Firestore document (1 MiB). `fitsInGoalDocument` refuses any write that would push subcategories + tasks past `MAX_GOAL_CONTENT_BYTES` (900 KB) with a plain message. Measured: Tue/Thu × 6 tasks × 6 months ≈ 52 KB; Mon/Wed/Fri × 8 tasks × 2 years ≈ 439 KB; every day × 12 tasks × 2 years ≈ 1.5 MB (refused).
- **Limits** — a routine ends with the goal's last month; extending the goal later (give-up → extend) does **not** extend existing routines. Subcategories saved without a date cannot be repeated.

**Streak** (`computeStreak`)
A day counts when ≥ 1 task **scheduled on that date** is completed (it uses `task.date`, not a completion timestamp). `current` runs back from today, or from yesterday if today is still empty (then `atRisk`). Computed over whichever workspace's goals are open.

**Give up / extend**
`GiveUpInterventionModal` (Reflect → Solutions → Confirm). *Extend* → `handleExtendGoalDeadline` appends N `Extended Focus (<Month Year>)` milestones and moves `targetDate`. *Confirm* → `handleGiveUpGoal` → `deleteDoc` (permanent).

## 8. Build, run, deploy

| Task | Command / fact |
|---|---|
| Install | `npm install` (CI uses `npm ci`, so keep `package-lock.json` in sync) |
| Dev server | `npm run dev` → Vite on port **3000**, host `0.0.0.0` (also configured in `.claude/launch.json`). Note `.vscode/launch.json` points Chrome at port 8080 — that does not match. |
| Type-check | `npm run lint` (= `tsc --noEmit`). Baseline on 2026-10-11: passes with no errors. |
| Production build | `npm run build` → `dist/` |
| Deploy | Push/merge to `main` → `.github/workflows/firebase-hosting-merge.yml`: Node 20, `npm ci`, `npm run build`, `FirebaseExtended/action-hosting-deploy` to the `live` channel. Secrets: `FIREBASE_SERVICE_ACCOUNT`, `FIREBASE_PROJECT_ID`. |
| Deploy (admin) | Push/merge to `main` touching `apps/admin`, `packages/shared` or `deploy/admin` → `.github/workflows/firebase-admin-hosting.yml` builds the admin (`VITE_API_URL` = the Render API) and deploys `deploy/admin/firebase.json` to the Hosting site `goal-path-admin`, which must exist first. Also runnable by hand from the Actions tab. |
| Firestore rules | **Not deployed by the workflow** (hosting only). Deploy manually: `firebase deploy --only firestore:rules`. |
| Hosting config | SPA rewrite (`** → /index.html`); everything `no-cache` except `/assets/**` (immutable, 1 year). |

**Treat `main` as production.** Merging deploys immediately. Work on a branch (e.g. `Staging/testing`) and merge via PR.

## 9. Configuration & secrets

- `firebase-applet-config.json` holds the Firebase **web** config (API key, project id, app id…). Firebase web keys are public identifiers, not secrets; real protection is the security rules and the Authorized Domains list in the Firebase console (the login screen detects `unauthorized-domain` errors and shows the hostname to add).
- `.env*` is git-ignored except `.env.example`. The app reads **no** environment variables at runtime today.
- A service-account key filename is git-ignored (`*-firebase-adminsdk-*.json`). Never commit credentials.
- `vite.config.ts` defines the `@` alias (project root) and an AI-Studio-specific `DISABLE_HMR` switch. Leave the HMR comment/logic alone unless you know why it is there.

## 10. Template leftovers (safe to know about, not yet cleaned)

- `package.json` name is `react-example`; `express`, `dotenv`, `tsx`, `esbuild`, `@types/express`, `@google/genai` are unused; the `clean` script mentions `server.js`, which does not exist.
- `.env.example` / `metadata.json` describe the AI Studio origin (Gemini key, "server-side Gemini API" capability) — nothing in the app uses it.
- `bun.lock` coexists with `package-lock.json`; CI uses npm.
- `.claude/shahid.js/bro` and `bro2` are junk files from early PR experiments.
- `assets/.aistudio/.gitignore` is a tracked AI Studio artifact.

## 11. Architectural constraints (do not violate without discussing)

1. **No backend code.** Keep logic client-side and enforce access in `firestore.rules`.
2. **Rules and UI must agree.** Any new permission is added to `firestore.rules` first, then mirrored in the UI helpers.
3. **Goal content stays embedded** (`tasks`, `subcategories`, `milestones` inside the goal doc) — the editor rule (`contentOnlyChange`) depends on those three keys. Moving them to subcollections requires a rules redesign. This is also why routines are materialised onto days rather than stored as a separate "series" record: a new top-level key would be blocked for editors.
4. **Queries must be rule-provable** (see the listeners table).
5. **Writes to goals, access requests and the `users` document live in `App.tsx` handlers**, guarded by a permission check. Components call callbacks; they do not write that data themselves. Routine logic itself lives in `src/recurrence.ts` as pure functions; handlers call it and write the result. (The only component-level writes are chat messages/threads in `ChatPanel` and the `publicProfiles` document in `ProfessionalProfilePanel`.)
6. **Prefer `selectTab()` for switching between top-level tabs** from the nav bars so the slide animation direction is right.
