# Goal Path

Break big goals into months, then into weekly routines you tick off each day, and share them with a trainer, dietitian or doctor.

This repository holds everything in one place (a *monorepo*):

| Folder | What it is | Status |
|---|---|---|
| `apps/web` | The app people use. React + Vite, login with Firebase Auth. | Live |
| `apps/admin` | The admin dashboard: banners, popups, pages and starter plans. | Working, with practice data |
| `apps/api` | The backend (Express + MongoDB). Serves live content and the admin routes. | Working; admin routes have no login yet |
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

The admin saves content through `apps/api` into MongoDB; the app asks the API what is live right now. Set up the database once with `npm run db:setup -w @goalpath/api`, then `npm run db:check -w @goalpath/api`. Run the API with `npm run start -w @goalpath/api`. The admin's practice mode (browser storage) is still available with `VITE_USE_MOCK=true`.

## Working here

- Keep `main` working. Make changes on a branch, then merge.
- Log every change in `context/progress-tracker.md`.
- Never commit secrets. `.env*` files and Firebase admin keys are ignored; check before you commit.

## Who can use the admin

- **Owners** are the Google emails in `ADMIN_EMAILS` (a private setting on the API: `apps/api/.env` locally, Environment on Render). They can change content and add or remove managers on the **Team** page.
- **Managers** are added by an owner. They can change content but cannot add or remove anyone.
- To make someone an owner, add their email to `ADMIN_EMAILS` (comma separated) and restart the API.
