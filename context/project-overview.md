# Project Overview

> **Read this file first.** It tells you what Goal Path is, the vocabulary the rest of the docs use, and which file to open for which kind of task.
> Last verified against the code: 2026-10-11 (commit `1e75ab7`).

## One-paragraph summary

**Goal Path** is a mobile-first web app for planning and tracking long-term goals. A person ("client") defines a goal with a target month; the app turns it into **monthly milestones** and lets them plan **daily tasks** grouped into **subcategories** (routines). On top of that sits a collaboration layer: a client can approve a **professional** (Trainer, Dietitian or Doctor) who then sees — and, if allowed, edits — specific goals. The two sides can chat inside the app. A daily **streak** and a motivational "don't give up" flow keep the user engaged.

It is a single-page React app talking directly to Firebase (Auth + Firestore). There is no custom backend.

## How to use this context folder

Every file here is meant to be read by both humans and AI agents. Open only what the task needs:

| If the task is about… | Read |
|---|---|
| What the product is, who uses it, vocabulary | this file |
| Where code lives, how data flows, how screens/permissions/navigation work, build & deploy | [architecture.md](architecture.md) |
| Look, feel, colours, components, animations, responsive behaviour, copy | [ui-context.md](ui-context.md) |
| Firestore collections, fields, security rules, auth, access control, sync rules | [backend-rules.md](backend-rules.md) |
| How to write code here, naming, patterns, do/don't, definition of done | [coding-guidelines.md](coding-guidelines.md) |
| What has shipped, what is in flight, known issues, change history | [progress-tracker.md](progress-tracker.md) |

**Rules for anyone (human or AI) changing this repo:**

1. Before changing code, read the file(s) from the table that match the task.
2. If a change alters behaviour that one of these files describes, update that file **in the same change**.
3. After every feature, fix or notable change, add an entry to [progress-tracker.md](progress-tracker.md) (format is at the top of that file).
4. Never document something you have not verified in the code. If unsure, write "unverified" and say why.

## Who uses it

| Role | How it is represented | What they can do |
|---|---|---|
| **Client** (a.k.a. *owner*) | Every account is a client by default. `users/{uid}.persona = 'client'` (or unset). | Create/edit/delete their own goals, plan tasks, approve or remove professionals, give each professional **view** or **edit** access per goal, chat with professionals. |
| **Professional** | `users/{uid}.persona = 'professional'`, or any account that has at least one client. Self-declared role: `Trainer`, `Dietitian` or `Doctor`. | Keep their own goals *and* open each client's **workspace**. Inside it they see only the goals the client shared, and can edit only where granted. Maintain a public professional profile (qualifications, work, contact). |

One account can be both: a professional keeps their own personal goals and switches between "My Workspace" and a client's workspace. Choosing a persona is **descriptive only** — it never grants access to anyone's data. Access always requires the client's approval.

## Core concepts (glossary)

| Term | Meaning |
|---|---|
| **Goal** | The top-level thing a client wants to achieve. Has a title, category, optional description, a target month, and embeds its milestones, subcategories and tasks. Stored as one document in `goals`. |
| **Category** | Free-text label on a goal. Seven presets (Career, Business, Health, Fitness, Finance & Wealth, Learning & Skills, Creative Writing) or custom. Drives the quick-pick routines in the add form and the card accent colour. |
| **Milestone** | One per calendar month from the goal's start month through its target month. Has a title (editable) and a done flag. Generated automatically on goal creation. |
| **Subcategory** | A named routine/session (e.g. "Chest & Triceps") **scoped to one date**. Groups that day's tasks. Can carry an `editorRole` tag restricting which professional role may edit its tasks. |
| **Routine** (weekly repeat) | A subcategory repeated on chosen weekdays ("Chest day every Tuesday and Thursday") until the goal ends. Stored as ordinary dated subcategories that share a `repeatId`, so it can be edited or stopped together. |
| **Task** | A single action item: text, priority (`high`/`medium`/`low`), done flag, a `YYYY-MM-DD` date, and an optional subcategory. |
| **Month key** | `YYYY-MM` string identifying a month. Used for `targetDate` and milestones. |
| **Workspace** | Whose goals the UI is showing. `workspaceUid === my uid` → *My Workspace*. Otherwise a professional is inside a client's workspace. |
| **Connection code / invite code** | 6-character code (alphabet excludes `I`, `O`, `0`, `1`) created for every account. A professional types it to request access. |
| **Access request** | A professional's ask to join a client. Status: `pending` → `approved` / `denied` / `removed`. |
| **Collaborator** | Entry in the client's `users/{uid}.collaborators` array: a connected professional plus their per-goal access. |
| **Goal access level** | `view` (read-only) or `edit` (change tasks, milestones, subcategories). Set per goal, per professional. |
| **Persona** | The self-declared account type shown on first sign-in: `client` or `professional`. |
| **Streak** | Consecutive days with at least one completed task. Shown on the dashboard and in client workspaces. |
| **Thread / chat** | A one-to-one conversation between a client and a connected professional. |

## Features (shipped)

**Goals & planning**
- Create a goal: title, category (preset or custom), description, length of 1–24 months, optional professionals to assign.
- Goals dashboard: overview stats (active goals, tasks today, progress %), search, category filter, goal cards with category accent, current-month milestone and progress bar.
- Goal detail: edit title/category/description (owner only), monthly milestone timeline, daily task planner with a month selector and a scrolling day strip.
- **A guided editing flow** on the goal page: **1 pick a day** (a Monday–Sunday week strip) → **2 plan it** (subcategories, then tasks). One **Add subcategory** button opens a small form with a name, four quick picks (recent names, then the category's routines) and *Just this day* / *Every week*.
- **Weekly routines**: choose weekdays with the **M T W T F S S** keys and the subcategory is added to every matching day until the goal ends. Edit or stop a routine from the block's ⋯ menu; tasks can be added to this day and all later days at once.
- Tasks: add (Enter), edit text/priority, complete, delete; grouped by subcategory; priority is one key that steps High → Medium → Low.
- **Today's Focus**: all of today's tasks across every goal, with inline add/edit.
- **Streak tracker** (current, longest, "at risk" today).
- **Give-up intervention**: giving up on a goal opens a 3-step mindset check (Reflect → Solutions → Confirm). One option extends the timeline by N months instead; confirming deletes the goal.

**Collaboration**
- Request access with a client's code and a role; client approves/denies; client chooses **view/edit per goal** at approval time and can change it later or remove the professional.
- Professional **client roster** and **workspace switcher**; client workspace shown in a distinct blue "professional" tone.
- Per-subcategory **role tags** so, e.g., only the Dietitian edits nutrition routines.
- **Professional profile**: display name, headline, roles, experience, languages, bio, "accepting clients" toggle, qualifications with verification links, work/results showcase, contact email and reference link. Clients see it for professionals they have approved.
- **Leave professional mode**: disconnects all clients and returns the account to a plain client.
- **In-app chat** between client and professional with unread badges.

**App shell**
- Google sign-in (popup, redirect fallback) and email/password sign-in with password reset.
- First-run persona prompt.
- Phone floating tab bar with a centre "+" button, swipe navigation between tabs, back-button handling with double-back-to-exit, animated branded loader.
- One shared design language (flat pastel cards, wells, pill chips, one glowing button, a tone that follows owner vs professional; styled after the Lovi iOS app) used on every screen — see [ui-context.md](ui-context.md).

## Deliberate non-goals / things that do not exist

These are verified absences — do not assume them:

- **No AI features.** `@google/genai` is in `package.json` and `.env.example` mentions `GEMINI_API_KEY`, but no code uses either (see [architecture.md](architecture.md) → *Template leftovers*).
- **No custom server / API.** The `express`, `dotenv` and `tsx` dependencies are unused. All data access is client → Firestore under security rules.
- **No router.** Views are switched with an `activeTab` state variable.
- **No file uploads / Firebase Storage.** Credentials are links to verifiable sources, by design.
- **No off-app contact channel.** A professional's profile exposes only an email and a reference link; chat stays inside the app.
- **No automated tests** exist in the repo.
- **No push notifications / email notifications.**

## Tech stack at a glance

| Layer | Choice |
|---|---|
| UI | React 19, TypeScript ~5.8, function components + hooks |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite`), plus hand-written CSS in `src/index.css` (pastel surfaces, shared parts, motion) |
| Icons | `lucide-react` |
| Build | Vite 6 |
| Auth | Firebase Authentication (Google, Email/Password) |
| Database | Cloud Firestore, realtime `onSnapshot` listeners |
| Hosting / CI | Firebase Hosting, deployed by GitHub Actions on push to `main` |
| Package manager | npm (`package-lock.json` is what CI uses); a stale `bun.lock` also exists |

## Project facts

| | |
|---|---|
| Product name | Goal Path |
| Repository | https://github.com/shahidmuhamed07/goal- |
| Firebase project id | `goal-path-9f4cc` (see `.firebaserc`) |
| Firestore database | `(default)` |
| Branches | `main` (auto-deploys to production), `Staging/testing`, plus short-lived feature branches |
| Origin | Started from a Google AI Studio applet ("Remix goal-path" in `metadata.json`) |

## Repository map

```
goal-/
├── context/                 ← these docs
├── src/
│   ├── App.tsx              ← the app: state, Firestore listeners, all write handlers, all top-level views
│   ├── main.tsx             ← React entry
│   ├── firebase.ts          ← Firebase init (auth, db, Google provider)
│   ├── types.ts             ← shared TypeScript types (data model)
│   ├── utils.ts             ← dates, streak, access-list helpers, invite codes
│   ├── chat.ts              ← chat id + unread helpers
│   ├── categoryPresets.ts   ← suggested routines per category (the quick picks)
│   ├── recurrence.ts        ← weekly-routine logic, pure functions
│   ├── index.css            ← theme tokens, pastel surface classes, animations
│   ├── loader-demo.tsx      ← dev-only loader preview entry
│   └── components/          ← screens' building blocks (see ui-context.md)
├── firestore.rules          ← Firestore security rules (source of truth for access)
├── firebase.json            ← Hosting + rules config
├── firebase-applet-config.json  ← Firebase web config (public by design)
├── firebase-blueprint.json  ← AI Studio data blueprint (partly stale — see backend-rules.md)
├── .github/workflows/       ← deploy-on-merge workflow
├── index.html, loader-demo.html, vite.config.ts, tsconfig.json
└── package.json, package-lock.json, bun.lock
```
