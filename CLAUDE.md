# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Rahamasin** — a stock portfolio tracker web app that runs **locally only**: started with `pnpm dev`, never deployed. Data lives in a SQLite file (`data/rahamasin.db`, gitignored) that can be exported and imported through the API; there is no separate backend process and no cloud dependency. (Domain features are not built yet — details are coming.)

The repo started as a clean-out of a previous React project: all Supabase code and the old app's domain features were removed, but the scaffold — folder conventions, layout primitives, SCSS architecture, tooling — was kept and is documented below. `src/App.tsx` currently renders a placeholder home page that shows DB health.

Stack: React 19 + Vite + TypeScript + SCSS, `react-router-dom` for routing, `motion` for animation, Node's built-in `node:sqlite` for storage (requires Node ≥ 22.13; zero DB dependencies, no native compilation). pnpm only — no npm/yarn.

## Commands

- `pnpm dev` — start the dev server (this is how the app is run, always)
- `pnpm build` — typecheck (`tsc -b`) + production build
- `pnpm lint` — ESLint
- `pnpm preview` — serve the production build locally

## Folder structure

```
data/                # gitignored — rahamasin.db + WAL sidecars, created on first boot
public/
  favicon.svg
  static/fonts/HelveticaNeueLTPro/   # self-hosted brand font (.otf, all cuts)
server/              # the API — Node code run inside Vite's server, not bundled
  plugin.ts          # Vite plugin mounting the API middleware on /api (dev + preview)
  api.ts             # route handlers (health, export, import, + feature routes)
  db.ts              # opens/migrates the DB; export/import snapshot helpers
  migrations.ts      # append-only ordered SQL migrations (user_version-based)
src/
  App.tsx            # routes (BrowserRouter); placeholder home page for now
  main.tsx           # entry: StrictMode + createRoot
  components/
    index.ts         # top-level barrel: re-exports ./ui and ./shared
    ui/              # layout/typography primitives (see below)
    shared/          # cross-feature presentational pieces (ConfirmDialog)
  features/          # one folder per app feature (empty — barrel stub only)
    index.ts         # aggregates all feature barrels
  lib/               # non-UI plumbing shared app-wide
    api.ts           # apiGet/apiPost fetch wrappers for /api
    layoutProps.ts   # responsive-prop engine for the ui primitives
    utils.ts         # cn() classname joiner, formatPrice, slugify
  styles/            # global SCSS (see "Styling")
  types/
    api.ts           # request/response types shared by client and server
```

### Feature structure convention

Every feature lives in `src/features/<feature>/` with this shape:

```
src/features/<feature>/
  index.ts                       # re-exports the subdir barrels
  pages/
    index.ts                     # barrel
    <Name>/<Name>Page.tsx        # e.g. pages/Dashboard/DashboardPage.tsx
    <Name>/<Name>Page.module.scss
  components/
    index.ts
    <Name>/<Name>.tsx            # e.g. components/HoldingsList/HoldingsList.tsx
    <Name>/<Name>.module.scss    # co-located styles, same basename
  hooks/
    index.ts
    use<Name>.ts                 # e.g. hooks/usePortfolio.ts
  api/                           # data access for the feature (whatever the local DB ends up being)
    index.ts
    <resource>.ts                # e.g. api/holdings.ts — plain async functions
```

Rules that go with it:

- **Every subdir has an `index.ts` barrel**; the feature root `index.ts` re-exports the subdir barrels; `src/features/index.ts` aggregates all features.
- **Import through barrels** (`@/features/<feature>`, `@/components`), never deep paths. Exception: sibling components within a feature import relatively (`../HoldingsList/HoldingsList`).
- **Pages own data, components present.** Pages call hooks / api functions and pass plain props down. Components stay presentational wherever possible.
- **Hooks wrap api functions** with fetch/refetch/subscribe state; components never talk to the data layer directly.

### Component style

- `FC<Props>` with a local `type <Name>Props`, explicit `JSX.Element` return type, **default export** (barrels re-export as named: `export { default as X } from "./X"`).
- File naming: component `<Name>/<Name>.tsx`, page `<Name>/<Name>Page.tsx`, hook `use<Name>.ts`, styles `<Name>.module.scss` co-located next to the component.
- (`src/components/ui/*` and `src/components/shared/*` predate the `<Name>/<Name>.tsx` naming and use `<Name>/index.tsx` — leave them as they are; new feature components follow the `<Name>.tsx` convention.)

### UI primitives (`src/components/ui/`)

Radix-Themes-compatible layout primitives implemented locally, with no Radix dependency: `Box`, `Flex`, `Grid`, `Text`, `Heading`. **Use these, not raw divs with inline styles.** They share the machinery in `src/lib/layoutProps.ts`:

- Responsive props (`{ initial: "1", md: "3" }`) emit a scoped `<style>` block per instance, keyed by a stable hash. Breakpoints: xs 520 / sm 768 / md 1024 / lg 1280 / xl 1640.
- Spacing props (`p`, `m`, `gap`, …) take the Radix space scale `"1"`–`"9"` (0.25rem–4rem, defined in rem) or any raw CSS length.
- Import from `@/components` (the top-level barrel), not `@/components/ui`.

`src/components/shared/` holds cross-feature presentational pieces (currently `ConfirmDialog`); it re-exports through `@/components` too.

## Data layer

- **Storage**: one SQLite file, `data/rahamasin.db`, opened with Node's built-in `node:sqlite` (`DatabaseSync`) in WAL mode with foreign keys on. No DB dependency to install; Node prints a harmless `ExperimentalWarning: SQLite` on boot.
- **The API lives inside Vite** — `server/plugin.ts` mounts a connect middleware on `/api/*` in both `pnpm dev` and `pnpm preview`. There is deliberately no second process, port, or CORS setup; `pnpm dev` is the only command.
- **Schema changes are migrations**: append a SQL string to `MIGRATIONS` in `server/migrations.ts` — never edit or reorder shipped entries, since `PRAGMA user_version` on existing DB files (and exported backups) records how many have run. Pending migrations run on boot and after an import, each in its own transaction.
- **Import/export** are DB-file-level and already implemented: `GET /api/export` streams a consistent snapshot (`VACUUM INTO`, so WAL state is never missing) as a dated `.db` download; `POST /api/import` (raw bytes body) integrity-checks the upload before swapping it in, then migrates it forward. An invalid upload never touches the live DB.
- **Request flow**: components → feature hooks → feature `api/` modules → `apiGet`/`apiPost` (`src/lib/api.ts`) → route handlers in `server/api.ts` → prepared statements against `getDb()`. Request/response types live in `src/types/api.ts`, imported by the server via relative path and by the client via `@/types/api`.
- The server code is typechecked by `tsconfig.node.json` (not the app config — no `@/` alias there) and gets Node globals in `eslint.config.js`.

## Styling

- **Component styles**: co-located CSS modules (`<Name>.module.scss`). The `@/` alias works in SCSS `@use`.
- **Global SCSS** in `src/styles/`, loaded once from `App.tsx` via `main.scss`, in this order: `utils/` (variables, functions/breakpoint helpers) → `base/` (fonts, global, reset, typography, colors) → `layout/`. `utils/_form.scss` holds shared form mixins for feature modules to `@use`.
- Design tokens are CSS custom properties on `:root`: colors in `base/_colors.scss` (`--clr-accent` teal, grays, magenta), typography in `base/_typography.scss` (`--font-*`, `--fs-*`, `--fw-*`, `--lh-*`).
- **Font**: Helvetica Neue LT Pro, self-hosted from `public/static/fonts/`, faces registered in `base/_fonts.scss` (normal-width cuts only; the family has no 600 weight — 600 resolves to 700). `index.html` preloads the Roman cut.
- **Animation** uses the `motion` package — import from `motion/react`, never `framer-motion`.

## Gotchas

- `Text`/`Heading` type props (`size`, `weight`, `color`, …) become **inline styles** and beat any class. To style one via a CSS module, omit the conflicting props — `Heading` deliberately has no size/weight/color defaults for this reason (an unstyled `Heading` inherits until given props or module styles).
- Sass drops empty rules — and their CSS-module class mappings with them — so every module class needs at least one declaration.
- `pnpm-workspace.yaml` is not a monorepo marker; it's where pnpm 11 keeps install settings (`@parcel/watcher` build script deliberately disabled — Vite drives sass through `sass-embedded`).
- Path alias `@/` → `src/` (defined in both `vite.config.ts` and `tsconfig.app.json`).
