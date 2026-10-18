# Goal Path

Break big goals into months, then into weekly routines you tick off each day, and share them with a trainer, dietitian or doctor.

This repository holds everything in one place (a *monorepo*):

| Folder | What it is | Status |
|---|---|---|
| `apps/web` | The app people use. React + Vite, login with Firebase Auth. | Live |
| `apps/admin` | The admin dashboard: banners, popups, pages and starter plans. | Working; deploys to its own Firebase Hosting site (see "Going live") |
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

## Going live

Pushing to `main` deploys two websites from GitHub Actions. The API runs separately on Render.

| What | Where | How |
|---|---|---|
| App | Firebase Hosting, the project's default site | `.github/workflows/firebase-hosting-merge.yml` |
| Admin | Firebase Hosting, a second site named `goal-path-admin` | `.github/workflows/firebase-admin-hosting.yml`, config in `deploy/admin/firebase.json` |
| API + database | Render (Express) and MongoDB Atlas | Render deploys it; settings are in Render's Environment tab |

One-time setup for the admin site:

1. **Firebase console → Hosting → Add another site**, with the address `goal-path-admin` (if it is taken, pick another and change `site` in `deploy/admin/firebase.json`). Its address is `https://goal-path-admin.web.app`.
2. **Firebase console → Authentication → Settings → Authorized domains**: make sure `goal-path-admin.web.app` is listed, or Google sign-in in the admin shows "unauthorized domain".
3. **Render → the API service → Environment**: set `CORS_ORIGINS` to include the admin address (and keep the app's), for example `https://goal-path-9f4cc.web.app,https://goal-path-9f4cc.firebaseapp.com,https://goal-path-admin.web.app`, and check `ADMIN_EMAILS`. Then redeploy.
4. Run the "Deploy admin to Firebase Hosting on merge" workflow once from the **Actions** tab (or push a change to `apps/admin`).

## Working here

- Keep `main` working. Make changes on a branch, then merge.
- Log every change in `context/progress-tracker.md`.
- Never commit secrets. `.env*` files and Firebase admin keys are ignored; check before you commit.

## Who can use the admin

- **Owners** are the Google emails in `ADMIN_EMAILS` (a private setting on the API: `apps/api/.env` locally, Environment on Render). They can change content and add or remove managers on the **Team** page.
- **Managers** are added by an owner. They can change content but cannot add or remove anyone.
- To make someone an owner, add their email to `ADMIN_EMAILS` (comma separated) and restart the API.
