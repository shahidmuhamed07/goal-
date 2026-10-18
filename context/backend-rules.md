# Backend Rules

> Read this for: Firestore collections and fields, security rules, authentication, how access control is stored and kept in sync, rules you must not break.
> There is **no custom backend** — "backend" here means Firebase Auth + Cloud Firestore + `firestore.rules`.
> Flows and UI-side permission helpers → [architecture.md](architecture.md). Last verified against the code: 2026-10-11 (commit `1e75ab7`).
> **Source of truth for access: `firestore.rules`.** This file explains it; if they disagree, the rules file wins — then fix this file.
> **Repo layout changed on 2026-10-14:** the app now lives in `apps/web/`. A path written here as `src/…` means `apps/web/src/…`. See the root `README.md` for the full layout.

## 1. Services & configuration

| Item | Value |
|---|---|
| Firebase project | `goal-path-9f4cc` |
| Firestore database | `(default)` — client opts into `experimentalAutoDetectLongPolling` (in `src/firebase.ts`) |
| Auth providers used | Google (`signInWithPopup`; falls back to `signInWithRedirect` **only** when the popup cannot open — `auth/popup-blocked` or `auth/operation-not-supported-in-this-environment`; the redirect outcome is read with `getRedirectResult` so failures are shown) and Email/Password (create, sign in, password reset). Email/Password must be enabled in the Firebase console. Sign-in only works on domains in Firebase → Authentication → Authorized domains (`localhost` works; `127.0.0.1` does not). |
| Client config | `firebase-applet-config.json` (public web config) |
| Rules file | `firestore.rules` (wired in `firebase.json`) |
| Deploy rules | Manual: `firebase deploy --only firestore:rules` (the GitHub workflow deploys Hosting only) |

The identity of a user is their Firebase Auth `uid`. Everything below is keyed by it.

## 2. Collections and documents

Default for anything not listed: **deny all** (`match /{document=**} { allow read, write: if false; }`).

### 2.1 `users/{uid}` — account profile (also the client's roster)

| Field | Type | Notes |
|---|---|---|
| `displayName`, `email`, `photoURL` | string | Refreshed from Auth on every sign-in. |
| `code` | string (6 chars) | This account's connection/invite code. |
| `collaborators` | `Collaborator[]` | Professionals the owner has approved: `{ uid, role, addedAt, name?, email?, goalAccess?: { [goalId]: 'view'\|'edit' }, assignedGoalIds? (legacy) }`. **Source of intent for per-goal access.** |
| `collaboratorUids` | string[] | Same professionals' uids, for `array-contains` queries and for the read rule. Must always mirror `collaborators`. |
| `createdAt` | ISO string | |
| `persona`, `personaChosenAt` | `'client'\|'professional'`, ISO string | Self-declared, descriptive only. |
| `withdrawnClients` | string[] | **Written by a professional on their own doc**: clients they have removed/left. Hides them in the UI on every device. |

- **Read:** the owner, or any signed-in user whose uid is in this doc's `collaboratorUids` (this is how a professional lists clients: `where collaboratorUids array-contains me`).
- **Create/update:** only the owner. **Delete:** never.
- Note: a connected professional can read the *whole* client doc, including the client's `code` and the other professionals in `collaborators`.

### 2.2 `codes/{code}` — invite-code lookup

`{ uid }`. Created together with the user doc in a transaction.
- **Get** (exact code): any signed-in user. **List:** nobody (codes cannot be enumerated).
- **Create:** signed-in user, only with `uid == their own uid`. **Update/delete:** never — a code can never be re-pointed.
- Alphabet: `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no `I`, `O`, `0`, `1`); 6 characters; collision → retry up to 10 times (`ensureUserProfile`).

### 2.3 `accessRequests/{fromUid}_{toUid}` — professional → client requests

| Field | Notes |
|---|---|
| `fromUid`, `fromName`, `fromEmail`, `fromPhoto` | The professional. |
| `toUid`, `toCode` | The client and the code that was used. |
| `role` | `Trainer` \| `Dietitian` \| `Doctor` (self-declared by the professional). |
| `status` | `pending` → `approved` \| `denied` \| `removed`; can return to `pending`. |
| `createdAt` | ISO string; reset when a request is re-opened. |

- **Read:** only the two participants (`fromUid` or `toUid`).
- **Create:** signed-in user with `fromUid == their uid`.
- **Update (client / `toUid`):** only the `status` key may change, to `approved`, `denied` or `removed`.
- **Update (professional / `fromUid`):** may set `status: 'pending'` and change only `status`, `role`, `createdAt` (re-asking after denied/removed).
- **Delete:** never.
- ID convention: `requestDocId(from, to) = "<from>_<to>"`. The app looks existing requests up with a **query** (`where fromUid == … and toUid == …`), never `getDoc`, because the read rule uses `resource.data` and a read of a non-existent document is denied.

### 2.4 `goals/{goalId}` — a goal and all its planning content

| Field | Type | Notes |
|---|---|---|
| `userId` | string | Owner uid. Immutable (updates must keep it). |
| `title` (≤200), `category` (≤50), `description` (≤1000) | string | **Owner-only** to change. Limits come from `firebase-blueprint.json` and the UI; the rules do not enforce lengths. |
| `createdAt` | `YYYY-MM-DD` string | |
| `targetDate` | `YYYY-MM` string | Owner-only. |
| `milestones` | `Milestone[]` `{ id, monthKey, title, completed }` | Editable by editors. |
| `subcategories` | `Subcategory[]` `{ id, name, order, date?, editorRole?, repeatId?, repeatDays? }` | Editable by editors. `repeatId` links the days of a weekly routine and `repeatDays` (0 = Sunday … 6 = Saturday) lists its weekdays; both are absent on one-off subcategories. See "Weekly routines" below. |
| `tasks` | `TaskItem[]` `{ id, text, priority, completed, skipped?, date, subcategoryId? }` | Editable by editors. `skipped` is set by "Skip" in *Missed from earlier*: the task stays, not done, and is no longer offered again. |
| `viewerUids` | string[] | Professionals who may **read** this goal (includes editors). Written only by the owner. |
| `editorUids` | string[] | Professionals who may **edit** content. Subset of `viewerUids`. Written only by the owner. |
| `id` | string | A `goal-<timestamp>` value is also stored inside the doc at creation; the app ignores it and uses the Firestore document id. |

- **Read:** owner (`userId`), or uid in `viewerUids` or `editorUids`. Rules use *direct* field access so the query engine can prove `where userId == uid` and `where viewerUids array-contains uid`.
- **Create:** signed-in, with `userId == their uid`.
- **Update:** the owner (and `userId` must stay unchanged), **or** an uid in `editorUids` whose change touches **only** `tasks`, `subcategories`, `milestones` (`contentOnlyChange`). So an editor can never change ownership, title, category, target date, or widen the access lists.
- **Delete:** owner only.

### 2.5 `publicProfiles/{ownerUid}` — a professional's public profile

Fields (see `ProfessionalProfile` in `src/types.ts`): `uid`, `displayName`, `headline`, `roles[]`, `yearsExperience`, `languages`, `bio`, `contactEmail`, `referenceUrl`, `credentials[]` (`{id,title,issuer,year?,referenceUrl?}`), `showcase[]` (`{id,title,description?,link?}`), `acceptingClients`, `updatedAt`. Written with `setDoc(..., { merge: true })`.

Kept **outside** `users/{uid}` on purpose so a connected client can read it without also seeing the professional's own code and client roster.

- **Read:** the owner, or a user for whom `accessRequests/<ownerUid>_<me>` exists with `status == 'approved'` (i.e. a client who approved this professional).
- **Create/update/delete:** only the owner.
- Credentials are **links**, not uploads; there is no Storage bucket in use.

### 2.6 `chats/{chatId}` and `chats/{chatId}/messages/{messageId}`

- `chatId = [uidA, uidB].sort().join('__')` (`chatIdFor`).
- Thread doc: `{ participantUids: [a, b] (sorted), updatedAt, lastMessage: { text, senderUid, createdAt }, lastRead: { [uid]: ISO } }`.
- Message doc: `{ senderUid, senderName, text, createdAt }`.
- **Thread read:** members. **Thread create:** signed-in user who is one of exactly two `participantUids`. **Thread update:** members, and `participantUids` must not change (metadata only: last message, read markers). **Delete:** never.
- **Message read:** thread members (rule `get()`s the parent thread). **Message create:** `senderUid == auth.uid` and the sender is in the parent's `participantUids`. **Update/delete:** never — messages are immutable.
- **Write order matters:** create/merge the thread doc **before** the first message, since the message rule reads the thread.

## 3. The access model (how pieces fit)

```
CLIENT's users/{client}.collaborators[i].goalAccess = { goalA: 'edit', goalB: 'view' }     ← intent (what the owner chose)
                    │  syncGoalAccess() / buildGoalAccessArrays()
                    ▼
goals/goalA.viewerUids = [pro]   goals/goalA.editorUids = [pro]                           ← enforcement (what rules read)
goals/goalB.viewerUids = [pro]   goals/goalB.editorUids = []
users/{client}.collaboratorUids = [pro]                                                   ← lets the pro read the client doc
accessRequests/{pro}_{client}.status = 'approved'                                         ← lets the client read pro's publicProfile
```

**Invariants — never break these:**

1. `collaborators[].uid` set == `collaboratorUids`.
2. For every goal and collaborator: `goalAccess[goalId]` ⇒ uid in `goal.viewerUids`; `'edit'` ⇒ also in `goal.editorUids`; no access ⇒ in neither. Editors are always viewers.
3. Only the owner writes `collaborators`, `collaboratorUids`, `viewerUids`, `editorUids`.
4. Any code path that changes `collaborators` must finish by calling `syncGoalAccess(...)` (App.tsx), which recomputes and writes only the goals whose lists actually differ.
5. Legacy `assignedGoalIds` (no `goalAccess`) means **edit** on those goals (`getGoalAccessLevel`). When the owner saves permissions through `handleUpdateAssignedGoals` or `handleSaveGoalCollaboratorAssignments`, the legacy field is deleted from the entry (see known gap 7).
6. Goals missing the two arrays (created before per-goal permissions) are backfilled once by the owner's browser (an effect in `App.tsx`). Owner-read of such goals works because the read rule short-circuits on `userId` first.

**Approval lifecycle** (writes in order): professional `setDoc accessRequests` (pending) → client `updateDoc users/{me}` (collaborators + collaboratorUids) → client `updateDoc accessRequests` (approved) → client `updateDoc goals/*` (viewer/editor lists).
**Removal by the client:** roster + `collaboratorUids` updated, goals resynced, matching requests → `removed`.
**Removal by the professional:** cooperative — see architecture §7. The professional cannot revoke access themselves (rules forbid writing the client's docs); the client's browser revokes on its next load. **Until then the professional retains read/edit access at the database level.**

## 4. Query patterns the rules can prove

| Purpose | Query |
|---|---|
| My (or open workspace owner's) goals | `goals where userId == uid` |
| Goals shared with me | `goals where viewerUids array-contains myUid` (then filter by `userId` client-side to isolate one client) |
| My clients | `users where collaboratorUids array-contains myUid` |
| My incoming / outgoing requests | `accessRequests where toUid == me` / `where fromUid == me` |
| Lookup a request between two users | `accessRequests where fromUid == a and toUid == b` |
| My chat threads | `chats where participantUids array-contains me` |
| A thread's messages | `chats/{id}/messages orderBy createdAt` |
| Resolve an invite code | `getDoc(codes/{code})` (exact only) |

Any new query must be expressible so that the rule is provable from the query's constraints alone.

## 5. Rules for changing the backend

1. **Edit `firestore.rules` first**, then the UI. Keep the explanatory comments in the rules file current.
2. **Never loosen** read access to `users`, `goals`, `chats` or `publicProfiles`. Prefer narrowing.
3. **Never let a non-owner write** the access lists, `userId`, `collaborators`, or `collaboratorUids`.
4. A new field on `goals` that editors must be able to change has to be added to `contentOnlyChange`; otherwise editors are blocked. A new owner-only field needs no rule change.
5. If you change the data model: update `src/types.ts`, `mapGoalDoc` (App.tsx) if it is a goal field, this file, and `firebase-blueprint.json`.
6. After changing rules, **deploy them** (`firebase deploy --only firestore:rules`) — merging to `main` will not.
7. Do not add a server or Cloud Functions without an explicit decision; it changes the whole architecture.
8. Never commit credentials (service-account JSON, `.env*`). The Firebase web config is fine.
9. Test both sides of every permission change: owner, edit-professional, view-professional, unrelated signed-in user, signed-out.

## 6. Data-modelling caveats (know before you touch tasks)

- **Weekly routines are ordinary dated subcategories.** "Chest day every Tue/Thu" is the same subcategory written onto every matching day up to the end of the goal (the last month), linked by a shared `repeatId`. There is no separate series document and **no rules change**: it only edits `subcategories` and `tasks`, which `contentOnlyChange` already allows for editors. Logic: `src/recurrence.ts`.
- **Never write `undefined` into Firestore.** It rejects the whole write. `recurrence.ts` adds or drops `repeatId`/`repeatDays` rather than setting them to `undefined`; keep that (clear with `delete`/rest-destructuring, or use `null`).
- **Size budget.** A goal document is capped at 1 MiB and routines multiply entries, so `App.tsx` refuses any write that would take subcategories + tasks past `MAX_GOAL_CONTENT_BYTES` (900,000 characters of JSON). A routine does **not** follow the goal if it is extended later.
- **Embedded arrays are rewritten whole.** Every task/milestone/subcategory edit sends the full array built from local React state. Two people editing the same goal at nearly the same moment (e.g. client and professional) can overwrite each other's change (last write wins). Firestore document limit is 1 MiB, so very large goals are bounded.
- **Dates are strings, not Timestamps:** days `YYYY-MM-DD`, months `YYYY-MM`, instants ISO-8601. String comparison is used for ordering (works because the formats sort lexically).
- **IDs inside arrays** are client-generated, e.g. `t-<Date.now()>`, `sc-<Date.now()>`, `m-<Date.now()>-<n>`.
- **Chat history is unpaginated** — all messages of a thread are streamed.

## 7. Known gaps (observed in the repo; not fixed)

These are findings from reading `firestore.rules` and the handlers on 2026-10-11. They have **not** been exercised against the live project, and the deployed rules may differ from the repo file because deployment is manual. Verify before relying on them; fix deliberately.

1. **Subcategory `editorRole` is UI-only.** Rules do not look inside the arrays, so an *edit*-level professional can change tasks in a routine tagged for another role.
2. **`accessRequests` create is loosely validated.** It checks only `fromUid == auth.uid`; it does not force `status == 'pending'` or `docId == fromUid_toUid`. A user could write a request with `status: 'approved'` and an id of the form `<professionalUid>_<theirUid>`, which satisfies the `publicProfiles` read check and lets them read that professional's public profile. It does **not** grant access to goals or `users` docs (those use owner-written lists). A user can also send requests with arbitrary display text to any known uid.
3. **Chat creation is not tied to a relationship.** Any signed-in user can create a two-person thread with any other uid and post into it; the "client ↔ connected professional" restriction exists only in the UI (threads are opened from the roster).
4. **Professional-initiated removal relies on the client's browser** (see §3) — access persists until the client next opens the app.
5. **`firebase-blueprint.json` is stale.** It lacks `publicProfiles`, `chats`, `chats/messages`; `UserProfile` lacks `persona`, `personaChosenAt`, `withdrawnClients`; `Goal` lacks `viewerUids`, `editorUids`.
6. **Field-length limits** (title 200, category 50, description 1000) appear only in the blueprint, not in the rules.
7. **Legacy access migration looks lossy (unverified).** `handleSaveGoalCollaboratorAssignments` rebuilds each collaborator's `goalAccess` from the existing `goalAccess` only and then deletes `assignedGoalIds`, without first converting those legacy ids to `goalAccess: 'edit'`. For an account that still has legacy entries, goals listed only in `assignedGoalIds` appear to lose professional access at the next full `syncGoalAccess`. Only matters for accounts created before per-goal permissions (commit `d8dbd34`).
