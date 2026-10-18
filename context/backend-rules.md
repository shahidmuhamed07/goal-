# Backend Rules

> Read this for: where people's data lives, who may see or change what, the API routes, authentication, how access control is stored and kept in sync, rules you must not break.
> "Backend" here means: **Firebase Auth** (sign-in only) + our own **API** (`apps/api`, Express on Render) + **MongoDB Atlas**.
> Flows and UI-side permission helpers → [architecture.md](architecture.md). Last verified against the code: 2026-10-18 (branch `feature/mongo-data`).
> **Source of truth for access: `apps/api/src/userRoutes.ts`, pinned by `apps/api/src/userRoutes.test.ts`.** This file explains it; if they disagree, the code and tests win — then fix this file.
> A path written here as `src/…` means `apps/web/src/…`. The old Firestore rules (`firestore.rules`) no longer exist: goals, profiles, requests and chat moved to MongoDB on 2026-10-18 with a fresh start (no data was migrated).

## 1. Services & configuration

| Item | Value |
|---|---|
| Sign-in | Firebase Auth, project `goal-path-9f4cc`. Google (`signInWithPopup`, falling back to `signInWithRedirect` only when the popup cannot open) and Email/Password. Works only on domains in Firebase → Authentication → Authorized domains (`localhost` works; `127.0.0.1` does not). |
| Client config | `apps/web/firebase-applet-config.json` (public web config) |
| API | `apps/api`, Express + zod, on Render (`https://goal-tcrb.onrender.com`). Locally `http://localhost:3002`. The web app finds it through `VITE_API_URL` (set in the GitHub workflow; defaults to the local API in development). |
| Database | MongoDB Atlas, database `goalpath`. `STORE=memory` runs the API with an in-memory store for demos and tests. |
| Settings | `apps/api/.env` locally, Render environment in production: `MONGODB_URI`, `MONGODB_DB`, `CORS_ORIGINS`, `FIREBASE_PROJECT_ID`, `ADMIN_EMAILS`, `STORE`. Never commit them. |

**Identity.** Every request to the people-data routes carries `Authorization: Bearer <Firebase ID token>`. The API verifies it with Google's published keys (`createFirebaseVerifier`: signature, issuer, audience, expiry) and takes the account's `uid` (and name, email, photo) **from the token**. A request can never claim to be someone else, and no route accepts a `uid` for "who is asking". Without a verifier configured the routes answer 503, never open.

## 2. Collections (MongoDB)

All documents carry our own string `id`, stored as `_id`. Dates are strings: days `YYYY-MM-DD`, months `YYYY-MM`, instants ISO-8601.

| Collection | Id | Holds | Indexes |
|---|---|---|---|
| `users` | the account's `uid` | profile: `displayName`, `email`, `photoURL`, `code` (6 chars), `collaborators[]`, `collaboratorUids[]`, `createdAt`, `persona`, `personaChosenAt`, `onboardedAt`, `onboarding` | `code` unique (partial), `collaboratorUids` |
| `goals` | `goal-<uuid>` | `userId` (owner), `title`, `category`, `description`, `createdAt`, `targetDate`, `milestones[]`, `subcategories[]`, `tasks[]`, `viewerUids[]`, `editorUids[]` | `userId`, `viewerUids` |
| `accessRequests` | `<fromUid>_<toUid>` | a professional's request: `fromUid/fromName/fromEmail/fromPhoto`, `toUid`, `toCode`, `role`, `status` (`pending` → `approved` \| `denied` \| `removed`; can return to `pending`), `createdAt` | `toUid`, `fromUid` |
| `publicProfiles` | the professional's `uid` | `ProfessionalProfile` (see `packages/shared/src/app.ts`) | — |
| `chats` | `[uidA, uidB].sort().join('__')` | `participantUids`, `updatedAt`, `lastMessage`, `lastRead{uid: ISO}` | `participantUids` |
| `messages` | `msg-<uuid>` | `chatId`, `senderUid`, `senderName`, `text`, `createdAt` (immutable) | `chatId + createdAt` |

Shapes are shared with the app through `packages/shared/src/app.ts`; the web `src/types.ts` only re-exports them. Admin content (`banners`, `popups`, `pages`, `plans`, `admins`) lives in the same database but is a separate concern (`/api/admin`, see the API README).

## 3. Routes and who may call them

All under `/api`, all need a login unless noted. Anything not allowed answers **404** (so a stranger cannot learn that a goal or account exists) unless the caller can already see the thing, in which case it answers **403** with a reason.

| Route | Who / rule |
|---|---|
| `POST /me/sync` | Anyone signed in. Creates the account on first use with a unique code (retry on collision, up to 10); otherwise refreshes name/email/photo from the token. |
| `GET /overview` | The caller's account, clients, requests (incoming/outgoing), chat threads, own goals, and goals shared with them, in one answer. The app asks for it every ~10 s. |
| `GET/PATCH /me` | Own account. PATCH accepts only `persona`, `personaChosenAt`, `onboardedAt`, `onboarding`. Roster, code and ids cannot be written through it. |
| `GET /clients`, `GET /users/:uid` | Accounts whose `collaboratorUids` include the caller (or the caller's own). Other people's `code` and `onboarding` are stripped. Anyone else → 404. |
| `GET /public-profiles/:uid` | The owner, or a client who has an **approved** request from that professional. Others → 404. |
| `PUT /me/public-profile` | Writes the caller's own profile only (`uid` forced). Links must be empty or `http(s)://`. |
| `GET /access-requests` | Only the caller's own (incoming and outgoing). |
| `POST /access-requests` | A professional asks using a client's 6-character code. Errors: `not_found`, `own_account`, `already_pending`, `already_approved`; a denied/removed request is re-opened (`sent_again`). **Rate limited: 10 per minute** per person (code guessing). |
| `POST /access-requests/:id/approve`, `/deny` | Only the client the request is addressed to, and only while `pending`. Approve takes `{ goalAccess }` (goal ids not owned by the client are dropped). |
| `PUT /collaborators/:uid/access` | The client changes one professional's per-goal access. |
| `PUT /goals/:id/assignments` | The goal's owner sets, for that goal, what each connected professional may do (`view`, `edit`, or `null` to remove). |
| `DELETE /collaborators/:uid` | The client removes a professional. Immediate: roster, goal access lists and the request (`removed`) all update together. |
| `DELETE /clients/:clientId` | A professional removes a client. **Immediate** on both sides (no more "client's browser finishes the job"). |
| `POST /me/leave-professional` | Disconnects every client, closes pending requests, sets `persona: 'client'`. |
| `GET /goals?workspace=`, `GET /goals/shared` | Own goals, or the goals of one client that are shared with the caller. |
| `POST /goals` | Creates a goal owned by the caller (`userId` and the access lists come from the server, never the request). `assignedProfessionalUids` that are not connected are ignored. Hard cap about 1 MB per goal (413). |
| `PATCH /goals/:id` | **Owner:** title, category, description, target date, milestones, subcategories, tasks. **Editor** (`editorUids`): only `tasks`, `subcategories`, `milestones`, otherwise 403 `owner_only`. **Viewer:** 403 `read_only`. Others: 404. |
| `DELETE /goals/:id` | Owner only (403 for viewers/editors, 404 for others). |
| `GET /chats`, `GET /chats/:id/messages` | The two people in the conversation only. The id must be a well-formed pair that includes the caller. |
| `POST /chats/:id/messages` | A member, **and only while one has connected the other** (otherwise 403 `not_connected`). Sender and time come from the server. 60 per minute. Reading after a connection ends still works. |
| `POST /chats/:id/read` | Marks the thread read for the caller. |

Request bodies are checked with zod (`userSchemas.ts`); unknown fields are dropped, so a request cannot write `userId`, `viewerUids`, `editorUids`, `collaborators`, `collaboratorUids` or `code`.

## 4. The access model

```
CLIENT's users/{client}.collaborators[i].goalAccess = { goalA: 'edit', goalB: 'view' }     ← intent (what the owner chose)
                    │  syncGoalAccess() on the server after EVERY roster change
                    ▼
goals/goalA.viewerUids = [pro]   goals/goalA.editorUids = [pro]                           ← what the goal routes read
goals/goalB.viewerUids = [pro]   goals/goalB.editorUids = []
users/{client}.collaboratorUids = [pro]                                                   ← lets the pro read the client's profile
accessRequests/{pro}_{client}.status = 'approved'                                         ← lets the client read the pro's publicProfile
```

**Invariants (the tests pin them — never break them):**

1. `collaborators[].uid` set == `collaboratorUids`.
2. For every goal and collaborator: `goalAccess[goalId]` ⇒ uid in `viewerUids`; `'edit'` ⇒ also in `editorUids`; no access ⇒ in neither.
3. Only the server writes `collaborators`, `collaboratorUids`, `viewerUids`, `editorUids`, and only on behalf of the account's owner.
4. Every route that changes the roster ends with `syncGoalAccess` (`userRoutes.ts`), which recomputes the lists for the owner's goals. The app never writes them.
5. A new goal gets its lists from the owner's current roster (`buildGoalAccessArrays` in `@goalpath/shared`).

## 5. Rules for changing the backend

1. **Change the route and its test first**, then the app. A new permission is a new test case in `userRoutes.test.ts` (owner, editor, viewer, unconnected person, signed-out).
2. **Never loosen** who can read `users`, `goals`, `chats` or `publicProfiles`. Prefer narrowing. Keep "not yours" as 404.
3. **Never take `uid` (or any access field) from a request body.** Identity is the token.
4. A new goal field that editors may change has to be added to the editor allow-list in `PATCH /goals/:id`; a new owner-only field needs nothing. Add it to `userSchemas.ts` too, or it is silently dropped.
5. Update the shapes in `packages/shared/src/app.ts`, `normalizeGoal`/`mapGoalDoc` in `App.tsx` if it is a goal field, and this file.
6. Never commit credentials (`.env*`, connection strings, service-account JSON).
7. Run `npm test -w @goalpath/api` and `npm run lint` before anything else.

## 6. Data-modelling caveats

- **Weekly routines are ordinary dated subcategories** ("Chest day every Tue/Thu" is the same subcategory written onto every matching day, linked by `repeatId`). Logic: `src/recurrence.ts`. No server change was needed for them.
- **Size budget.** A goal is stored as one document. The app refuses any change that takes subcategories + tasks past `MAX_GOAL_CONTENT_BYTES` (900,000 characters) with a plain message; the server's hard cap is 1,000,000 bytes (413 `goal_too_large`).
- **Arrays are rewritten whole.** An edit sends the full `tasks`/`milestones`/`subcategories` array built from local state, so two people editing one goal at the same moment can overwrite each other (last write wins). The app shows its own change at once and the server's answer replaces it within about 10 s.
- **Updates arrive by polling**, not push: the app asks for `/overview` every ~10 s while visible, again when the person returns to the app, and for an open chat every ~3 s. After the app's own change, answers that were already on their way are discarded (`usePolling.touch()`), so an old answer cannot undo it.
- **IDs inside arrays** are client-generated, e.g. `t-<Date.now()>`, `sc-<Date.now()>`, `m-<Date.now()>-<n>`.
- **Chat history is unpaginated** — all messages of a thread are fetched each time.
- **Render's free plan sleeps** after about 15 minutes idle; the first request then takes up to ~50 s. The app shows "Waking up the server…" and retries; a scheduled ping (`.github/workflows/keep-api-awake.yml`) keeps it awake once merged to `main`. A paid plan removes the problem.

## 7. Known gaps

1. **Subcategory `editorRole` is UI-only.** The server does not look inside the arrays, so an *edit*-level professional could write a task in a routine tagged for another role through a crafted request.
2. **Concurrent edits overwrite** (see §6).
3. **Polling cost.** `/overview` returns whole goals every 10 s; large accounts will want a smaller "what changed" answer (an ETag/`If-None-Match` or a `since` parameter).
4. **No automated test against a real MongoDB.** The tests use the in-memory store; the only query shape the Mongo store adds is `find` with equality or array-contains on indexed fields.
5. **Per-user limits are in memory** (one API instance). Fine for now; a second instance would need a shared counter.
