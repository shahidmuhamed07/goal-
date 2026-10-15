# Coding Guidelines

> Read this before writing or reviewing code. It records the conventions the codebase **actually follows** (observed 2026-10-11, commit `1e75ab7` plus the uncommitted "uniform design + goal editing flow" change) plus the rules for working here safely.
> No ESLint/Prettier config exists in the repo, so the only enforcement is `tsc` and review. **Match the surrounding code** — its comment density, naming and idioms — over any outside preference.
> **Repo layout changed on 2026-10-14:** the app now lives in `apps/web/`. A path written here as `src/…` means `apps/web/src/…`. See the root `README.md` for the full layout.

## 1. Rules for AI agents and new contributors (hard constraints)

**MUST**
1. Read [project-overview.md](project-overview.md) and the file(s) relevant to the task before editing.
2. Keep changes minimal and scoped to what was asked; match existing patterns instead of introducing new ones.
3. Guard every goal/task write with a permission check (`canEditGoal`, `canEditTaskRecord`, `isOwner`) **and** make sure `firestore.rules` allows it.
4. After a change that is observable (feature, fix, data-model, UI, config), append an entry to [progress-tracker.md](progress-tracker.md) and update any context file whose statements are now untrue.
5. Run `npm run lint` (must pass) and, for anything touching build/config, `npm run build`.
6. Say plainly what you did **not** verify (e.g. "not tested against live Firestore").

**MUST NOT**
1. Don't commit, push, merge or deploy unless explicitly asked. `main` auto-deploys to production.
2. Don't add dependencies, a server, Cloud Functions, a router, or a state/CSS library without explicit agreement.
3. Don't weaken `firestore.rules`, and don't change them without flagging it (they must be deployed manually).
4. Don't commit secrets or `.env*` files; don't paste real user data into code, tests or docs.
5. Don't write Firestore data from presentational components (see §4).
6. Don't use raw hex colours or assume stock Tailwind colours (see [ui-context.md](ui-context.md#tailwind-colour-names-are-remapped-important)). Don't build cards-in-cards, buttons, badges or headings out of `bg-white` / `bg-slate-50` / `border-slate-200` utilities — use the shared parts (`.chip`, `.btn-tone`, `.btn-danger`, `.badge`, `.card-title`, `.neu-inset-sm`, `.menu`).
7. Don't leave `console.log` debugging behind (there is one stray log in `SubcategoryBlock.tsx` — treat it as a bug, not a pattern).
8. Don't "clean up" unrelated code in the same change.

## 2. Language, tooling, structure

- **TypeScript ~5.8, React 19, function components + hooks.** `tsconfig.json` has `jsx: react-jsx`, `moduleResolution: bundler`, `noEmit`, **but not `strict`** — so the compiler is lenient. Write code as if `strict` were on: explicit prop and return types where they aid reading, no implicit `any`, narrow `unknown` in `catch`.
- Avoid `any`. (One exists: `Partial<any>` in `DailyTaskSection`'s `onUpdateTask` prop; prefer `Partial<TaskItem>` as `SubcategoryBlock` does.)
- **Formatting (observed):** 2 spaces, single quotes, semicolons, trailing commas in multi-line literals, arrow functions, `const` by default.
- **Imports:** relative paths (`'./utils'`, `'../types'`). The `@` alias (project root) is configured but unused — stay relative. Group: React → third-party → local.
- **Where things go**

| Adding… | Put it in |
|---|---|
| A data type | `src/types.ts` |
| A pure helper (dates, access lists, ids) | `src/utils.ts` (chat-only helpers go in `src/chat.ts`) |
| A reusable component | `src/components/PascalCase.tsx`, one exported component per file (small helper components may share a file) |
| Category-specific suggestions | `src/categoryPresets.ts` |
| Theme token, surface or animation | `src/index.css` |
| A Firestore write for goals/requests/user doc | a handler in `src/App.tsx` |

## 3. Naming

| Kind | Convention | Examples |
|---|---|---|
| Components, types, interfaces | PascalCase; props interface is `<Component>Props` | `DailyTaskSection`, `DailyTaskSectionProps` |
| Component files | PascalCase | `CollaboratorsPanel.tsx` |
| Variables, functions | camelCase | `getMonthDays` |
| Event handlers in `App.tsx` | `handle<Action>` | `handleToggleTask` |
| Props that are callbacks | `on<Action>` | `onToggleTask` |
| Booleans | `is…`, `can…`, `has…` | `isOwner`, `canEditGoal` |
| Module-level constants | UPPER_SNAKE | `GOAL_CATEGORIES`, `MAX_MONTHS` |
| State pair | `[thing, setThing]` | `[activeTab, setActiveTab]` |
| CSS classes defined in `index.css` | short lowercase, `gp-` prefix for keyframes/loader | `.neu`, `.rise`, `gp-rise` |
| Client-generated ids | `<prefix>-${Date.now()}` | `t-…` task, `sc-…` subcategory, `m-…-n` milestone, `cred-…`, `show-…` |

## 4. Patterns to follow

### 4.1 A write handler (copy this shape)

```ts
const handleToggleTask = async (goalId: string, taskId: string) => {
  const targetGoal = goals.find((g) => g.id === goalId);          // 1. find from state
  if (!targetGoal) return;
  const task = (targetGoal.tasks || []).find((t) => t.id === taskId);
  if (!task || !canEditTaskRecord(goalId, task)) {                // 2. permission guard first
    setErrorMessage('You do not have permission to edit this task.');
    return;
  }

  const updatedTasks = targetGoal.tasks.map((t) =>                // 3. build the new array immutably
    t.id === taskId ? { ...t, completed: !t.completed } : t
  );

  try {
    await updateDoc(doc(db, 'goals', goalId), { tasks: updatedTasks });   // 4. write the whole array
  } catch (err) {
    console.error('Toggle task error:', err);                     // 5. log with a label…
    setErrorMessage('Failed to update task.');                    //    …and tell the user in plain words
  }
};
```

- State is updated by the realtime listener echoing the write; don't also `setGoals` unless the UI would otherwise show a blank screen (the one existing exception is goal creation).
- Owner-only operations start with `if (!isOwner) return;`.
- Anything that changes `collaborators` must end with `syncGoalAccess(...)` ([backend-rules.md §3](backend-rules.md)).

### 4.2 Components

- Typed props, named export: `export const Foo: React.FC<FooProps> = ({ … }) => { … }`. Default values in the destructuring.
- Presentational: data in via props, changes out via `on…` callbacks. Only `ChatPanel`, `ProfessionalProfilePanel` and the credentials fetch in `CollaboratorsPanel` touch Firestore directly — don't add more without reason.
- **Colour for owner vs professional comes from the tone**, not from `isOwner` ternaries: the app root carries `data-role="owner|pro"`, and the shared parts and `--tone-*` variables follow it. Use `.chip`, `.btn-tone`, `.badge`, `GlassIconButton variant="tone"`. Use `isOwner` only for *behaviour* (what is allowed or shown). Older components still contain colour ternaries; don't copy them.
- Reuse components instead of copying their markup: a subcategory with tasks is always `SubcategoryBlock` (the goal page and Today both use it); a ⋯ menu is `MenuButton`; a weekday choice is `WeekdayPicker`.
- Early-return `null` for closed modals (`if (!isOpen) return null;`) after all hooks.

### 4.3 Effects and listeners

- Every `onSnapshot` effect returns its unsubscribe. Guard with `if (!user) { …reset state; return undefined; }`.
- Handlers attached to `window`/`document` read the latest state through a ref (see `navStateRef` in `App.tsx`) instead of re-subscribing on every change.
- Measure layout from the DOM (`useSegmentedTrack`, `visualViewport`) rather than hard-coding widths.

### 4.4 Dates

- Days are `YYYY-MM-DD`, months are `YYYY-MM`, instants are ISO strings. Use the helpers in `utils.ts` (`getTodayDateString`, `getCurrentMonthKey`, `shiftDateString`, `addMonthsToKey`, `getMonthDays`, `formatDisplayDate`…). Don't hand-roll date strings.
- Heads-up: `getTodayDateString()` derives the date in **UTC** while month helpers use **local** time (logged in [progress-tracker.md](progress-tracker.md) as a known issue). Don't add a third convention; if you fix it, fix it in `utils.ts` for everyone.

### 4.5 Errors and messages

- `console.error('<Action> error:', err)` plus a short, human message via `setErrorMessage(...)` (rose banner) or `setSuccessMessage(...)`. Messages say what happened and, where useful, what to do. Never show raw Firebase error text unless it is the only useful clue (the login screen maps codes with `friendlyAuthError`).
- Don't swallow errors silently, except best-effort cleanup that already uses `.catch(() => {})` for non-critical writes.

### 4.6 Styling

- Tailwind utility classes inline; hand-written CSS only in `index.css`. No CSS modules / styled-components.
- Use the surface classes (`.neu` = white card, `.neu-inset` = tinted well) for cards, and the **shared parts** for everything repeated (see [ui-context.md](ui-context.md#3-surface-system-css-classes-in-indexcss)). A box inside a card is a well (`.neu-inset-sm`). The look is flat pastel (Lovi style): one `.btn-tone` per screen, pill-shaped choices, pink only for "chosen" marks. Add `data-plain` to a `<button>` that must opt out of global button styling.
- Remember the global CSS overrides: inputs are white pills with an inset hairline (no border utilities work), and the shared parts are **unlayered, so a utility cannot override their material** (`.badge` ignores `hidden`, `.chip` ignores `rounded-full`). Use the important suffix when you must: `rounded-full!`, `max-sm:hidden!`.
- Fields: write only size and spacing (`w-full text-sm rounded-xl px-3.5 py-2.5`); the groove, colour and focus ring are global.
- Icons: named imports from `lucide-react`. Prefer `AppSelect` over a native `<select>` for new dropdowns (a couple of older spots still use native).

### 4.7 Comments

The codebase uses **prose comments that explain why**, typically a `/** … */` block above a non-obvious function, effect or state variable (e.g. why a query is shaped a certain way, why a write is ordered a certain way). Match that: comment intent, constraints and gotchas; don't narrate what the code obviously does. Section markers in JSX (`{/* VIEW 2: … */}`) are used in `App.tsx`.

## 5. Recipes

**Add a goal category** — update all four: `GOAL_CATEGORIES` (`utils.ts`), `CATEGORY_ICONS` (`CreateGoalModal.tsx`), `CATEGORY_ACCENTS` (`App.tsx`), `CATEGORY_PRESETS` and optionally the keyword heuristics in `getCategoryPresets` (`categoryPresets.ts`). Update [ui-context.md](ui-context.md).

**Add a field to a goal** — `Goal` in `types.ts` → `mapGoalDoc` in `App.tsx` → write it where it is created/edited → decide who may edit it: owner-only (no rule change) or editor-writable (add to `contentOnlyChange` in `firestore.rules` and redeploy) → update [backend-rules.md](backend-rules.md) and `firebase-blueprint.json`.

**Change how routines work** — the rules live in `src/recurrence.ts` as pure functions; change them there, then call them from the handler. Keep them pure (arrays in, arrays out), UTC-date based, and free of `undefined` values (Firestore rejects them). Re-run the logic checks (see §6) and mind the size budget.

**Add a top-level tab** — extend the `activeTab` union and `navTabs`/`swipeTabs`/`NavTab['key']` in `App.tsx`, render the view in `<main>`, add it to the back-button logic if it needs special handling, mention it in [ui-context.md](ui-context.md) and [architecture.md](architecture.md).

**Add a new Firestore collection/query** — rules first (and deploy), then the listener/handler, then the docs. Confirm the query is rule-provable.

**Change what a professional can do** — change `firestore.rules`, then `goalAccessLevel`/`canEdit…` helpers, then the UI affordances, then the docs. Test as owner, edit-pro, view-pro and an unrelated user.

## 6. Verification (there are no automated tests)

Minimum before calling work done:

1. `npm run lint` passes (`tsc --noEmit`; baseline on 2026-10-11 is clean).
2. `npm run build` succeeds if you touched build/config/deps.
3. Run `npm run dev` (port 3000) and exercise the change in the browser at **phone width (~375px) and desktop**. For collaboration features use two test accounts (a client and a professional).
4. Check the console for errors; for permission changes confirm there is no `permission-denied`.
   - *Claude preview pane quirk:* `window.open()` returns `null` there, so Google popup sign-in always takes the redirect fallback (expected, not a bug). A sign-in made in the pane persists; **don't sign out of it**. To see the login screen without touching that session, open a second tab on `http://127.0.0.1:3000` (separate origin, no session; Google sign-in there fails with `unauthorized-domain` because that host isn't authorized in Firebase).
5. Update the docs and the progress tracker.

**Testing writes without touching real data.** In the Claude preview pane you may be signed in as the real owner — never create, edit or delete their goals to "see if it works". Instead mount the real components in a temporary page with mock data in local state (like `loader-demo.html`; delete it afterwards), and test the pure logic with a script outside the repo: `npx tsx <script>` can import `src/recurrence.ts` directly (the 18 checks used for routines covered weeks/leap Februaries, create/extend/shrink/stop, copying tasks onto new days, never touching earlier days, de-duplication, unique ids, no `undefined`, and the size budget).

If you add tests to the repo, tell the owner — none exist today, so there is no runner or convention to follow.

## 7. Git & delivery

- **Commit messages:** one short imperative sentence in sentence case, no scope prefix, describing the visible change (e.g. "Slide the phone tab pill smoothly under the + button"). Only the first two commits used a `feat:` prefix; everything since is plain sentences.
- One logical change per commit.
- **Branches:** `main` = production (auto-deploys on push). Use `Staging/testing` or a feature branch and open a PR. Remote branches currently include `Sample`, `sample-02`, `Staging/testing`, `fix/collaborator-edit-permissions`.
- Keep `package-lock.json` in sync with `package.json` (CI runs `npm ci`).
- Rules changes need a manual deploy; mention it in the PR/commit.

## 8. Quick do / don't

| Do | Don't |
|---|---|
| Put permission checks before writes | Trust that a hidden button protects data |
| Keep `collaborators`, `collaboratorUids`, `viewerUids`, `editorUids` in sync | Update one without the others |
| Use `selectTab()` for nav-bar tab switches | Add another tab-switching mechanism |
| Use existing helpers in `utils.ts` | Re-implement date/streak/access logic inline |
| Keep owner **and** professional visual tones | Style only for the owner view |
| Explain *why* in comments | Leave debug logs or commented-out code |
| Record changes in the progress tracker | Finish a change without updating the docs |
