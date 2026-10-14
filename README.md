# Goal Path

Break big goals into months, then into weekly routines you tick off each day, and share them with a trainer, dietitian or doctor.

This repository holds everything in one place (a *monorepo*):

| Folder | What it is | Status |
|---|---|---|
| `apps/web` | The app people use. React + Vite, login with Firebase Auth. | Live |
| `apps/admin` | The admin dashboard: banners, popups, pages and starter plans. | Working, with practice data |
| `apps/api` | The backend (Express + MongoDB). | Not built yet |
| `packages/shared` | Types and rules the three programs above agree on. | Working |
| `context/` | Project notes: overview, architecture, UI, rules, progress. | Keep updated |

## Run it

You need Node 20 or newer (`.nvmrc`).

```bash
npm install          # once, at the repo root: installs every app
npm run dev          # the app      → http://localhost:3000
npm run dev:admin    # the admin    → http://localhost:3001
```

Other commands, all from the repo root:

```bash
npm run lint         # type-check every app
npm run build        # build the app  (output: apps/web/dist)
npm run build:admin  # build the admin
```

## How the pieces fit

```
admin  ──writes──►  content (banners, popups, pages, plans)  ──read by──►  web app
         ▲                         ▲
         └── both use the types in packages/shared ──┘
```

Today the admin keeps its content in the browser (practice mode). When `apps/api` exists it will store the content in MongoDB, and the admin and the app will both talk to it. The admin already uses a `ContentApi` interface, so that swap changes one file.

## Working here

- Keep `main` working. Make changes on a branch, then merge.
- Log every change in `context/progress-tracker.md`.
- Never commit secrets. `.env*` files and Firebase admin keys are ignored; check before you commit.
