# UI Context

> Read this for: look and feel, colours, reusable classes/components, animations, responsive behaviour, screens, UX rules, copy tone.
> For data flow and permissions → [architecture.md](architecture.md). For code style → [coding-guidelines.md](coding-guidelines.md).
> Last verified against the code: 2026-10-11 (commit `1e75ab7` plus the uncommitted Lovi redesign). Source of truth for styling: `src/index.css`.
> **Repo layout changed on 2026-10-14:** the app now lives in `apps/web/`. A path written here as `src/…` means `apps/web/src/…`. See the root `README.md` for the full layout.

## 1. Design language in one paragraph

A **soft pastel, flat and glowing** interface in the style of the Lovi iOS app (reference screenshots: `Lovi ios Jan 2026.zip`; we copy the *look and question flow*, never their logo, assets or exact text). White cards sit on a pale lavender page with two faint pastel washes. Choices are **pill-shaped**, there is **one glowing periwinkle button** per screen, **pink** marks small "chosen" states, and the type is big and friendly: **Bricolage Grotesque** for display/headings, **Figtree** for body. There are no raised or recessed shadows any more: depth is white on a tinted background, a hairline, and one very soft shadow. A smiling **orb** mascot (`Orb.tsx`) appears on the splash, onboarding and the Goals and Today headers. The product is **mobile-first**: on phones it behaves like a native app (floating bottom tab bar, swipe between tabs, system-back handling).

The earlier clay/neumorphic system was replaced on 2026-10-11 (backup of the old CSS lived in the session scratchpad, not in the repo). The class names (`.neu`, `.neu-inset`…) were **kept** so every screen re-skinned at once, but they now mean "white card" and "tinted well", not "raised" and "pressed in".

## 2. Palette

| Role | Colour | Where |
|---|---|---|
| Page | `#f7f6fb` (`--color-page`) + two pastel radial washes | Body background |
| Primary (owner tone) | periwinkle, `#4f5bf5` at 600 | Glowing button, active tab, focus ring, progress |
| Chosen mark | pink, `#d63a7c` family | Selected option outline and tick (`.option`, `.option-mark`) |
| Professional tone | pink | A professional working inside a client's workspace |
| Danger | red (`rose-*` remapped) | Remove, give up, high priority |
| Neutrals | lavender-tinted slate | Text and hairlines |

### Tailwind colour names are remapped (important)

`@theme` in `index.css` **overrides** Tailwind's stock colour scales. The class names did **not** change, the colours behind them did:

| Class family | Actually renders | Role in the UI |
|---|---|---|
| `emerald-*`, `violet-*`, `indigo-*` | **periwinkle** | Primary actions, active states, owner tone |
| `purple-*` | violet-purple | Rare accent |
| `blue-*`, `pink-*` | **pink** | Professional tone, "chosen" marks |
| `rose-*` | **red** | Errors, danger, high priority |
| `teal-*`, `sky-*` | aqua / light blue | Category accent strips |
| `amber-*`, `orange-*` | warm tones | Streak flame, medium priority |
| `slate-*` | lavender-tinted neutrals | Text and borders |

**Rule:** never use raw hex values or stock Tailwind colours you assume (e.g. `emerald` is *not* green, `blue` is *pink*). Use the existing classes, `--tone-*`, or add a token to `@theme`. Fonts: `--font-sans` (Figtree), `--font-display` (Bricolage Grotesque); easing `--ease-glide` and `--ease-spring`.

### Colour by meaning

| Meaning | Colour |
|---|---|
| Primary action / done / current | periwinkle |
| Selected option, small "chosen" marks | pink |
| Professional in a client's workspace | pink tone |
| Danger, remove, give up | red |
| Streak | amber → orange → red gradient flame |
| Category cards | one accent strip per category (`CATEGORY_ACCENTS` in `GoalCard.tsx`) |

## 3. Surface system (CSS classes in `index.css`)

| Class | Look | Use |
|---|---|---|
| `.neu` | White card, 26px radius, hairline + soft shadow | Default card/panel |
| `.neu-sm` | Smaller white tile | Stat keys, small tiles |
| `.neu-lg` | Large white panel | Dashboard hero |
| `.neu-inset` / `.neu-inset-sm` | Tinted well (no shadow) | Anything that sits inside a card |
| `.neu-deep`, `.neu-hoki`, `.neu-warm`, `.neu-teal` | Tinted variants | Client list, professional banners |
| `.splash` | Full-screen gradient with the orb | Login and onboarding welcome |
| `.glass` | Translucent white with blur | Floating bars |
| `.sheet`, `.sheet-up` | Bottom sheet that slides up | Email sign-in |
| `.orb`, `.orb-float` | The mascot glow and its gentle float | Mascot placement |
| `.option`, `.option-mark` | Full-width choice row; `data-selected` = pink outline + pink tick | Every onboarding question |
| `.divider-label` | Hairline with a centred label | "or" separators |
| `.segmented`, `.segmented-track`, `.segmented-tab` | Translucent white pill with a sliding tinted track | Desktop view switcher and phone tab bar |
| `.lift` | Rises 2px on hover, deeper shadow | Clickable cards |
| `.press` | Scales down on `:active` | Tappable tiles |
| `.slim-scroll`, `.hide-scroll` | Thin scrollbar / no scrollbar | Scroll areas |
| `.safe-bottom`, `.safe-top` | Device safe-area inset | Phone tab bar, full-height panels |

### Shared parts (use these, don't re-invent them)

Everything a screen needs more than once has one class, so a new screen looks like the old ones automatically. **Never hand-build these with `bg-white`, `bg-slate-50`, `border-slate-200` and shadow utilities.**

| Class | What it is | Use it for |
|---|---|---|
| `.chip` | White pill. `data-active="true"` = periwinkle gradient + glow; `data-current="true"` tints its label; `data-danger="true"` makes it red. | Day, month and weekday keys; category pickers; filters; secondary buttons. Use on `<button>`. |
| `.btn-tone` | The glowing gradient pill: the one filled action on a screen. Disabled = grey. | Add, Save, Create goal, Request access, the + in the tab bar. |
| `.btn-danger` | The same filled action when it removes something. | Yes, delete / Remove / Leave. |
| `.badge` | A small tinted label (`color-mix` of the tone). | Role, repeat pattern ("Tue · Thu"), category. |
| `.card-title` | Display-font 17px heading, sentence case. | My code, Daily plan, Roadmap. |
| `.section-label` | 12px grey label. | A field name, a step, a group of keys. |
| `.page-title`, `.page-lede` | Big display heading and a one-line intro. | Top of Today, Collaborate, Profile. |
| `.menu`, `.menu-left`, `.menu-heading`, `.menu-item`, `.menu-sep` | A floating list of actions. `data-active` ticks the current choice, `data-danger` draws it red. | The ⋯ menu (`MenuButton`), the month menu, the account menu. |

**Inside a `.neu` card, a nested box is a well (`.neu-inset-sm`), never a white box.**

### Tone (the accent)

The accent is set **once**, on the app root: `data-role="owner"` (periwinkle) or `data-role="pro"` (pink, a professional inside a client's workspace). CSS variables `--tone-50 … --tone-900` follow it, and `.chip`, `.btn-tone`, `.badge`, `GlassIconButton variant="tone"`, the step numbers and the progress fill all read them. **A component should not branch on `isOwner` for colour**; use the shared parts, or `text-[color:var(--tone-800)]` for a one-off.

**Global behaviours you must know (they are unlayered CSS, so they beat Tailwind utilities):**

- Plain `<button>`s get no special material; the shared classes paint their own. `data-plain` opts a button out of any global button styling.
- The shared parts and `.neu*` classes set **material** (background, shadow, radius, colour, font-weight) and some also set `display`. A utility on the same element cannot override those properties: `.chip` ignores `rounded-full`, `.badge` ignores `hidden`. To override, add the important suffix: `rounded-full!`, `cursor-default!`, `max-sm:hidden!`.
- Every text `<input>`, `<textarea>`, `<select>` is a **white pill with an inset hairline** and a glowing periwinkle focus ring. Border/shadow utilities on them have no effect.
- `.neu*` classes force `background` and `border: none`; a stray `bg-*` utility will not win.
- `html` has `scroll-padding-top: 120px` and smooth scrolling.

## The UI standard (read this before you build or change a screen)

Spacing, text sizes, dialogs and controls are decided **once**, in shared parts. Build from them and a new screen looks like the old ones with no extra effort. The test `apps/web/src/uiStandards.test.ts` fails (naming the file and line) if an old pattern comes back, so a reviewer does not have to catch it by eye.

### Use these, never hand-build them

| Need | Use | Never |
|---|---|---|
| A dialog | `<Dialog>` (`components/Dialog.tsx`): kicker, title, description, close button, body, footer, Esc to close | your own `fixed inset-0` overlay, a blur, a dark tint |
| Behind an overlay | `.scrim` (full layer) or `.scrim-dim` (just the dim). Light dim, **no blur** | `bg-slate-900/..`, `backdrop-blur-*` |
| "Are you sure?" (remove, leave, disconnect) | `<ConfirmDialog>` (`components/ConfirmDialog.tsx`): title, plain sentence, Cancel + red confirm button | an inline Remove / Cancel pair that swaps in beside the icon |
| A person in a list (a professional, a client) | a flat row (`divide-y`) with an avatar, name, `.meta` email and **labelled** `RowAction` chips (Message, Profile, Goal access, Remove) | a card inside a card, a row of unlabelled icons |
| A dropdown | `<AppSelect>` with `className="field-control ..."` and `wrapperClassName` for width | a native `<select>` |
| No access / View / Edit | `<AccessPicker>` | hand-made buttons |
| Going back out of a screen | `<BackButton label="All goals">`: 44px pill, on its **own row** above the badges and title | a small "← Back" chip beside badges |
| A round icon button | `.icon-action` (36px), `data-tone="tone"` or `"danger"` | squares with borders, other sizes |
| Text under a card title | `.card-lede` | `text-xs text-slate-400 mt-1 mb-4` |
| Small supporting text (email, date, count) | `.meta` | pale slate-400 text people need to read |
| A text-field look on a custom control | `.field-control` | copying the input styles |

### Spacing (an 8-point rhythm)

- Between cards on a screen: `space-y-6` (24px).
- Card padding: `p-4 sm:p-6`. Inside a card: title, then `.card-lede` (it spaces itself), then content with `space-y-4` (16px).
- Related small controls in a row: `gap-2` (8px). Related rows: `gap-3` (12px). Groups: `gap-4` (16px).
- A dialog is always: header, then 16px, body (`gap` 16px), then 20px and a hairline above the footer. `<Dialog>` does this; do not re-space it.
- Controls that sit side by side share one height: **40px** for fields, dropdown buttons and filled buttons. Round icon buttons are 36px; the back button is 44px (it must be easy to find and tap).

### Text hierarchy (five levels, always in this order)

1. Page title: `.page-title` (display font, 28 to 34px).
2. Card or dialog title: `.card-title` (display font, 17px; dialogs 20px).
3. Body: 14px, `text-slate-700` or `text-slate-900`.
4. Supporting text: `.meta` or `.card-lede` (12 to 13px, `slate-500`).
5. Field labels: `.section-label` (12px, semibold, `slate-500`).

`slate-400` is only for decoration (placeholders, disabled, icons), never for words someone needs to read.

### Overlays

> A dialog's header and footer stay fixed; only its body scrolls. Never leave a finished animation holding a `transform` on an ancestor of a dialog (it breaks `position: fixed`): panel animations use `backwards` fill.

One look: a light dim (`rgb(26 25 39 / 0.32)`), **no blur**, a white panel with a stronger shadow so it stands out without muddying the page behind. If you think a dialog needs a different overlay, change the shared `.scrim` rule so every dialog changes together.

### Before you finish a UI change

1. Built from the shared parts above? (`npm test -w @goalpath/web` checks the common slips.)
2. Looked at it at phone width (375px) **and** desktop, with a dialog open if it has one?
3. Controls in a row the same height and aligned? A dropdown list that opens inside the screen?
4. A way back out that is easy to see?
5. Added anything new that other screens will want? Make it a shared part and add it to the table and the test.

## 4. Motion

| Class / keyframe | Effect |
|---|---|
| `.rise`, `.rise-1` … `.rise-5` | Entrance: fade-and-lift, with staggered delays |
| `.pop` | Modal entrance |
| `.fade` | Overlay fade |
| `.bar-grow` | Progress bar fill |
| `.tab-panel` + `data-dir="1"/"-1"` | View slides in from the right/left when tabs change |
| `.segmented-track` | Pill glides (0.44s) between tabs; position measured from the DOM |
| `.gp-flame-live` | Gentle flicker on an "at-risk" streak flame |
| `gp-loader-*` | Brand loader: the route mark with a light travelling along it |

`@media (prefers-reduced-motion: reduce)` disables entrance, tab-panel, loader and transition animations. **Any new animation must be added to that block.**

Swipe navigation is JS-driven (`paintContent`/`settleContent` in `App.tsx`): content follows the finger, slides out 58px with opacity 0.22 on commit, and glides back in.

## 5. Layout & responsive rules

- **Breakpoint that matters: `sm` (640px).** Below it = phone layout; at/above = desktop layout.
- Content width: `max-w-6xl mx-auto`, gutters `px-3 sm:px-6`.
- **Phone** (`< sm`): compact header (h-12); a **floating tab bar** (`nav.sm:hidden`, fixed bottom) holds the tabs; owners get a raised centre **"+" (New Goal)** button with the tabs split into two equal halves around it, so it stays centred with 3 or 4 tabs. `<main>` has `pb-28` so content clears the bar. Professionals inside a client workspace get the plain tab list (no "+").
- **Phone is the priority.** Goals is the first tab and the home screen (order: Goals, Today, Connect, Profile; `navigation.ts` owns this). Phones use a tighter scale (in the `max-width: 639px` block of `index.css`): `page-title` 22px, `.neu` radius 20px, a shorter and more opaque tab bar. Phone screens prefer **one line over a card**: icons instead of always-open search boxes, one-row scrolling chips. Hide desktop-only detail with `hidden sm:block`, show phone-only with `sm:hidden`. Careful: `hidden` loses against shared classes that set their own `display` (`.badge`, `.orb`, anything `inline-*`); use `max-sm:hidden!` on those, or wrap the part in a `hidden sm:block` element.
- **Desktop** (`≥ sm`): taller header with a "New Goal" button; a segmented view switcher row under it; no bottom bar.
- Header and "Trainer Mode" bar are `sticky` (`z-30` / `z-40`); phone bar is `z-50`; **modals and the chat panel `z-[60]`** (so they cover the phone bar); onboarding `z-[90]`. Keep this order when adding layers. `<Dialog>` renders through a portal on `<body>` (the content area is its own stacking layer, so an in-screen overlay can never beat the tab bar); any new overlay should do the same.
- Goal grid: 1 column → `md:2` → `lg:3`. Goal detail: two columns at `lg` (tasks left, milestones right).
- Horizontally scrolling rows (day strip, category chips) must keep their own horizontal gesture — the swipe handler detects `overflow-x: auto|scroll` ancestors, and `data-no-swipe` opts an element out.

## 6. Screens

| Screen | Where | Notes |
|---|---|---|
| **Loading** | `GoalPathLoader` | Shown until auth and the first goals snapshot are ready. |
| **Login** | `LoginScreen` | A `.splash` with the floating orb, "Goal Path" and one Google button; email sign-in/sign-up/reset lives in a bottom `.sheet`. Detects Firebase `unauthorized-domain` and shows the hostname with a copy button. One message at a time: domain panel › ok notice › red error › info notice. |
| **First-run questions** | `Onboarding` (`starterPlan.ts` holds the data) | Full-screen, one question per step, `tab-panel` slide between steps. Welcome → Who are you (own goals / professional) → Focus (**one choice**) → Eating (only for diet) → Activity → Days → Minutes → Length → "Build me a starter plan?" → slide-to-commit with confetti → "Tailoring your plan…" (3 bars) → "Your plan is ready" (cards) → Show my plan. Professionals skip straight from the persona to the build. Also opened from the account menu ("Start a guided plan"). Result is written by `handleFinishOnboarding` in `App.tsx` as real goals with weekly routines. |
| **Goals** (`dashboard`) | `App.tsx` + `GoalCard` | **Phone:** a slim top card ("Your goals" + streak on one line, then Active goals / Tasks today / Progress as one strip; Progress opens a dialog listing each goal), then a search icon, one scrolling row of category chips and compact goal cards (title, one line of routines, seven dots). **Desktop:** hero with the orb, "Your goals", streak badge and 3 stat keys (Active Goals → scrolls to grid, Tasks Today → Today tab, Progress → first goal). Professionals also get a "Clients you work with" row list. Search + category chips. **Goal cards** in an auto-fill grid (`minmax(20rem, 1fr)`, so 1 column on a phone, 2–3 on a laptop). Inside a client workspace the hero collapses to one compact line. |
| **Today** (`today`) | `App.tsx` + `SubcategoryBlock` | A brand-new account sees "Start with your first goal" with a Create button. Orb (desktop only; phones show the streak chip) + big date + one friendly progress line and bar; per goal, today's subcategories as the **same `SubcategoryBlock` the goal page uses**, in execution mode: tick tasks and add tasks, but no rename/repeat/delete or task edit/delete (those live on the goal page, as decided in `8c07829`). A quick "Add subcategory for today" line. Empty state links to goals. Under the progress bar: the admin's Today card, then **Missed from earlier** (`MissedTasks`): unfinished tasks from the last 14 days, each with **Today** (move it here) and **Skip** (set it aside); "Move all to today" when there are two or more. Only tasks the person may edit are listed. **Missed from earlier** offers, besides moving a task to today or skipping it, **Push my plan** (`PushPlanDialog`): for each weekly routine with missed days, change the days if needed, then *Push the plan* (the missed days and the rest slide onto the routine's own days) or *Skip those days*. |
| **Goal detail** (`detail`) | `App.tsx` + `DailyTaskSection` + `SubcategoryBlock` + `MonthlyMilestoneSection` | Header card (back, category and month badges, title, description; owner: edit + flag/give-up icons; "Assigned:" pros + Manage Access). Below it, two columns on `lg` (7/5): **left = the editing flow**, right = the roadmap. See *The goal editing flow*. |
| **Collaborate** (`connect`) | `CollaboratorsPanel` | Client view: My Code, Connect as Professional (code + role), Pending requests, Connected professionals (view credentials / message / manage access / remove). Professional view: Clients I support. Inside a client workspace: read-only "people connected with this client". |
| **Profile** (`professional`) | `AccountProfilePanel` or `ProfessionalProfilePanel` | Client: identity, code, "Become a professional". Professional: profile card with edit / leave icons, who-you-are form, qualifications, work & results, contact. |
| **Chat** | `ChatPanel` | Full-screen on phone, centred panel on desktop; day separators; Enter sends, Shift+Enter newline. |
| **Modals** | `CreateGoalModal`, `GoalAssignmentModal`, `GiveUpInterventionModal`, leave-professional confirm, credentials, remove confirms | Backdrop `bg-slate-900/45 backdrop-blur-md`, panel `.neu … .pop`. Inside: category/duration choices are `.chip`s, option lists are wells, fields are grooves, secondary buttons are `.chip`, danger is `.btn-danger`. |

Account menu (avatar, top right): "My profile"/"My professional profile" and "Sign Out", drawn with the shared `.menu`. The avatar is a **letter badge**, deliberately not the Google photo (it can fail to load).

### The goal editing flow (desktop first; phone is usable but not yet polished)

The page is a short sequence, with numbered headings so people feel where they are:

1. **Pick a day.** A Monday-to-Sunday week strip (‹ › move a week; the month menu and the roadmap's month keys jump further). Each day shows one mark: filled ring = all tasks done, open ring = tasks waiting, dot = planned but empty, ★ = today. Days outside the goal's months are disabled. *Today* jumps back.
2. **Plan the day.** One **Add subcategory** button opens a small form: a name, **four** quick picks (the last couple of names this goal used, then the category's own routines), and *When*: **Just this day** or **Every week**. *Every week* shows the weekday keys **M T W T F S S** (the selected day's weekday is pre-chosen) and a plain sentence of what will happen ("Every Tue · Thu from Tuesday, Oct 13 until Mar 2027 · 49 days.").
3. **Fill it with tasks** inside each block: tick, add a task on one line (Enter adds; one key steps priority High → Medium → Low), edit/delete icons appear on hover.

Each block's ⋯ menu holds everything that changes the subcategory itself: Rename, Repeat weekly… / Edit repeat…, Stop repeating, *Who can edit* (owner only), Delete this day, Delete this & later days. Repeat editing opens **inline** with a live preview ("adds 24 days"), and anything destructive asks first with exact counts. A block that belongs to a routine shows a "Tue · Thu" badge (hidden on phones) and a tick-box *Also add to the next N days of this routine* under its task field.

The earlier "Quick sample tasks", the long description paragraph and the six preset chips were removed on purpose: **less is shown until asked for.**

## 7. Component inventory

| Component | File | Purpose / key props |
|---|---|---|
| `GoalPathMark`, `GoalPathLogo` | `UIElements.tsx` | Brand mark (Lucide "route" icon) and logo lock-up. `size: sm|md|lg|xl`, `showText`. |
| `GoalPathLoader` | `UIElements.tsx` | Full-screen loader. `message?`. Preview at `/loader-demo.html`. |
| `PriorityBadge` | `UIElements.tsx` | `high` rose / `medium` amber / `low` slate chip. |
| `ProgressBar` | `UIElements.tsx` | Tinted track + periwinkle fill. `value 0–100`, `height`, `color`. |
| `GlassIconButton` | `UIElements.tsx` | Small icon button; passes any button attribute through. `variant: tone|purple|emerald|rose|slate|amber|blue`, `size: xs|sm|md|lg`, `active`. **Default to `tone`** (follows owner/professional automatically); `rose` for delete. |
| `GlassBadge` | `UIElements.tsx` | Uppercase pill. `variant: purple|emerald|amber|slate|blue`. |
| `StreakBadge` | `UIElements.tsx` | `stats: StreakStats`, `onClick?`, `compact?`. States: none ("Start streak"), at risk ("Keep it alive", flickering hollow flame), done today (filled flame). |
| `Dialog` | `Dialog.tsx` | The one dialog shell. `title`, `kicker?`, `description?`, `size` (`sm`/`md`/`lg`/`xl`), `footer?`, `closeOnScrim?` (off by default so a stray tap never loses typing). |
| `AccessPicker` | `AccessPicker.tsx` | No access / View / Edit as one labelled row. `value`, `onChange(level \| null)`, `who`. |
| `BackButton` | `BackButton.tsx` | The way back out of a screen. `label`, `onClick`. |
| `GuidedGoal` | `GuidedGoal.tsx` | The optional "Help me plan" questions for a new goal. |
| `AppSelect` | `AppSelect.tsx` | Custom dropdown replacing native `<select>` (consistent font/colour/width). `options[{value,label,hint?}]`, `ariaLabel`, `align`. |
| `LoginScreen` | | Google + email/password auth UI. |
| `Onboarding` | `Onboarding.tsx` | The first-run questions (see §6). Props: `isOpen`, `name`, `onFinish(answers, plans)`, `onClose`. Contains `OptionRow`, `AskBubble`, `Confetti`, `SlideToCommit`. |
| `Orb` | `Orb.tsx` | The smiling mascot. `size`, `float`, `className`. |
| `CreateGoalModal` | | Title, category (preset chips with icons or custom), description, number of months (1–24), assign professionals. |
| `GoalAssignmentModal` | | Per-goal View/Edit/None for each connected professional. |
| `GiveUpInterventionModal` | | 3-step mindset check; extend timeline or confirm give-up. |
| `DailyTaskSection` | | The goal page's editing flow (steps 1–2 above): header with month menu, week strip, add-subcategory form with weekly repeat, the day's blocks. Owns the selected date; tells the roadmap when the month changes. |
| `SubcategoryBlock` | | One subcategory on one day (header, ⋯ menu, inline rename / repeat / confirm, task list, add-task line). Used by the goal page **and** Today. Pass `canManage={false}` and omit the edit/delete callbacks for execution-only use. |
| `GoalCard` | `GoalCard.tsx` | A goal on the Goals page, as **a brief of what is planned, not a dashboard of numbers** (no counts, percentages or "months left"). Category `.badge`, title, description; then **Next 7 days** as seven letter keys (today filled, a dot on planned days; tap a day → the goal opens on it) and a recessed list of the routines in that window — name, the days they fall on ("Mon · Wed · Fri") and a peek at the first two tasks (max 3 routines, "+ N more"). With nothing in the window it names the next planned routine; with nothing planned at all it shows **"Plan your first routine"** with a + so people see where to add (view-only users just see "Nothing planned yet"). Footer: owner access + Assign, or "Can edit · Role" / "View only"; "Open →" ("Start planning →" when empty). |
| `DayMark` | `DayMark.tsx` | The single mark under a day on the goal page's week strip (filled ring / open ring / dot / ★). |
| `MenuButton` | `MenuButton.tsx` | The ⋯ button and its `.menu`. `sections[{heading?, items[{label, icon?, onClick, danger?, active?, disabled?}]}]`. Closes on outside click and Escape. |
| `WeekdayPicker` | `WeekdayPicker.tsx` | The M T W T F S S keys. `value: number[]` (0 = Sunday), `onChange`. Used by the add form and the repeat editor. |
| `MonthlyMilestoneSection` | | The roadmap: the chosen month's note, "Mark achieved" key, month progress, and the month keys. `readOnly` for view-only. |
| `CollaboratorsPanel` | | The Connect tab (three modes — see §6). |
| `AccountProfilePanel` | | Client profile. |
| `ProfessionalProfilePanel` + `ProfessionalProfileCard` | | Editable professional profile; the read-only card is reused to show a professional to their clients. |
| `ChatPanel` | | Conversation UI; sized to `visualViewport` on phones. |

## 8. UX rules (behaviour users rely on)

1. **Role-aware chrome.** Owner = periwinkle, a professional inside a client workspace = pink. New UI gets this for free from the shared parts and `--tone-*` (set by `data-role` on the root); don't branch on `isOwner` for colour. (`data-tone="warm"` on the segmented control is the older mechanism — the name is historical; it renders pink.)
2. **Hide, don't disable, owner-only controls** for professionals (New Goal, edit goal details, give up, manage access). For view-only access show an explicit **lock / "Read-only"** badge rather than silently missing buttons. On the goal page a view-only professional gets no add button, no ⋯ menus, no task fields, locked checkboxes and no edit/delete icons.
3. **Back button walks inside the app** (see architecture §6) and a second back within 2 s leaves; show the "Press back again to leave" toast.
4. **Destructive actions confirm.** Give-up = 3-step flow; removing a professional/client = inline confirm; leaving professional mode = red confirm dialog stating clients will be disconnected; deleting a subcategory, deleting later days of a routine and stopping a routine = an inline prompt that states how many days and tasks go.
4a. **Show less until asked.** Prefer one button that opens a small form over a page of options (see the add-subcategory form: 4 quick picks, not 6 presets + sample tasks).
5. **Feedback is a single banner** under the header: success (periwinkle/pink by mode) or error (rose). Messages are plain-language and say what to do ("Check connection", "Please try again").
6. **Empty states always offer the next step** (e.g. "Create Your First Goal").
7. **Email address in the footer is a copy button** (shows "Email copied").
8. **Unread chat** = dot on the message icon and a count badge on the Connect tab.
9. **Touch targets**: tab-bar buttons and icon buttons are ≥ 28–32px; phone controls use `active:scale-95` for tactile feedback.
10. **Accessibility basics in use:** `aria-label` on icon buttons and the "+" button, `aria-current`/`aria-selected` on tabs, `:focus-visible` outline in Crayola, reduced-motion support, `title` tooltips on icon buttons.

## 9. Copy & tone

Encouraging and plain: "Wait, don't give up just yet!", "Progress is progress!", "Keep it alive". Short labels on the phone bar (Goals, Today, Connect, Profile), longer on desktop (All Goals, Today's Focus, Collaborate). Dates are shown as "Today · Sun, Oct 11" (weekday, month, day); months as "Oct 2026". Dates/months use `en-US` formatting.

Known copy quirk: the top bar inside a client workspace always says **"Trainer Mode"**, even when the professional is a Dietitian or Doctor.

## 10. Checklist when changing UI

- [ ] Works at phone width (~375px) **and** desktop; nothing hidden behind the phone tab bar.
- [ ] Uses the **shared parts** (`.chip`, `.btn-tone`, `.badge`, `.card-title`, wells, `.menu`) and `.neu*` surfaces — no new `bg-white` / `border-slate-*` boxes inside cards.
- [ ] Uses existing colour classes (remember the remapping) or `--tone-*`.
- [ ] Owner **and** professional (pink) tones considered; view-only state considered.
- [ ] New animations are covered by the reduced-motion block.
- [ ] Icon-only buttons have `aria-label`/`title`.
- [ ] If you add a screen/component, add it to the tables above.
