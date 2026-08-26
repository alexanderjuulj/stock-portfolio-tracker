# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Rahamasin** — a stock portfolio tracker web app that runs **locally only**: started with `pnpm dev`, never deployed. Data lives in a SQLite file (`data/rahamasin.db`, gitignored) that can be exported and imported through the API; there is no separate backend process and no cloud dependency.

Features so far: a **dashboard** (`/`) with one row per stock — amount summed across accounts, average buy price, live market price, profit (abs + %), market value (native + EUR), portfolio weight, day change % (vs. previous close), sector, personal notes — that expands into the per-account purchase lots (with dates), plus totals (open and realized profit, free cash with its share of the portfolio), account filter tabs, a **sector donut chart** (`SectorChart`, plain SVG, hover to isolate a slice), **selling** (pick the account, amount, price prefilled from the quote, date, reason; proceeds can be credited to the account's free cash), and an **Accounts** section showing free cash per account (native + EUR), stocks value and total, with an all-accounts total; a **history page** (`/history`) listing every purchase and sale with its realized profit/loss and a per-stock×account summary; and a **settings page** (`/settings`) for the quote provider / API key and DB backup import/export. See "Data model", "Ledger" and "Market data" under Data layer.

The repo started as a clean-out of a previous React project: all Supabase code and the old app's domain features were removed, but the scaffold — folder conventions, layout primitives, SCSS architecture, tooling — was kept and is documented below.

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
  api.ts             # route handlers: health, export, import, portfolio, history, holdings, sales, stocks, accounts, settings
  db.ts              # opens/migrates the DB; export/import snapshot helpers
  migrations.ts      # append-only ordered SQL migrations (user_version-based)
  accounts.ts        # accounts CRUD + validation
  stocks.ts          # per-ticker stock records (sector/currency/notes), upsert + orphan cleanup
  holdings.ts        # purchase lots CRUD + validation (lot = ticker × account), ledger-guarded
  sales.ts           # sales CRUD + validation; cash credit in the account's currency
  ledger.ts          # lists lots + sales; FIFO replay → open lots, settled sales (cost basis, realized P/L)
  portfolio.ts       # joins ledger + stocks + accounts + quotes + FX into positions/accounts/totals
  history.ts         # buys + sells with realized P/L, per stock × account summary
  quotes.ts          # Yahoo/Finnhub quote fetchers, Frankfurter FX, SQLite caches
  settings.ts        # key/value settings helpers (getSetting/setSetting)
src/
  App.tsx            # AppHeader + routes: / (DashboardPage), /history (HistoryPage), /settings (SettingsPage)
  main.tsx           # entry: StrictMode + createRoot
  components/
    index.ts         # top-level barrel: re-exports ./ui and ./shared
    ui/              # layout/typography primitives (see below)
    shared/          # cross-feature pieces: AppHeader, ConfirmDialog, FormDialog, Field (+ fieldClasses)
  features/          # one folder per app feature: portfolio/, settings/
    index.ts         # aggregates all feature barrels
  lib/               # non-UI plumbing shared app-wide
    api.ts           # apiGet/apiPost/apiPut/apiDelete fetch wrappers for /api
    finance.ts       # CURRENCIES (Frankfurter-convertible ISO codes) and SECTORS (GICS) option lists
    layoutProps.ts   # responsive-prop engine for the ui primitives
    privacy.ts       # "hide figures" store (localStorage, usePrivacy); formatters mask money + share counts while on (formatQuote never does)
    utils.ts         # cn() classname joiner, formatPrice/formatSignedPrice/formatNumber/formatPercent/formatDate, slugify
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

`src/components/shared/` holds cross-feature presentational pieces, re-exported through `@/components` too: `AppHeader` (brand + Dashboard/History/Settings nav + `PrivacyToggle` and `ThemeToggle` icon buttons, `icon-button` mixin), `ActionMenu` (three-dot trigger + dropdown of `{ label, onSelect, danger?, accent? }` items, portalled to `body` so table scroll wrappers don't clip it — used for the row actions in the holdings table), `ConfirmDialog`, `FormDialog` (modal form shell: backdrop, title, error line, Cancel/Submit — mount it only while open so field state starts fresh) and `Field` (label + control + hint on the dialog's two-column grid; `full` spans both) with `fieldClasses` (`input`/`select`/`textarea` class names for the controls inside). Feature forms compose these and own only their field state.

## Data layer

- **Storage**: one SQLite file, `data/rahamasin.db`, opened with Node's built-in `node:sqlite` (`DatabaseSync`) in WAL mode with foreign keys on. No DB dependency to install; Node prints a harmless `ExperimentalWarning: SQLite` on boot.
- **The API lives inside Vite** — `server/plugin.ts` mounts a connect middleware on `/api/*` in both `pnpm dev` and `pnpm preview`. There is deliberately no second process, port, or CORS setup; `pnpm dev` is the only command.
- **Schema changes are migrations**: append a SQL string to `MIGRATIONS` in `server/migrations.ts` — never edit or reorder shipped entries, since `PRAGMA user_version` on existing DB files (and exported backups) records how many have run. Pending migrations run on boot and after an import, each in its own transaction.
- **Import/export** are DB-file-level and already implemented: `GET /api/export` streams a consistent snapshot (`VACUUM INTO`, so WAL state is never missing) as a dated `.db` download; `POST /api/import` (raw bytes body) integrity-checks the upload before swapping it in, then migrates it forward. An invalid upload never touches the live DB.
- **Request flow**: components → feature hooks → feature `api/` modules → `apiGet`/`apiPost`/`apiPut`/`apiDelete` (`src/lib/api.ts`) → route handlers in `server/api.ts` → prepared statements against `getDb()`. Request/response types live in `src/types/api.ts`, imported by the server via relative path and by the client via `@/types/api`. Validation errors come back as 400 with `{ error }`; the client wrapper throws them as `Error(message)`.
- **Data model** (migrations 002–003): `accounts` (name, cash currency, free cash) · `stocks` keyed by ticker (sector, fallback currency, personal notes — everything that is true of a ticker regardless of who holds it) · `holdings` = purchase **lots** (ticker → stocks, account_id → accounts, quantity *as bought*, purchase_price, purchased_at) · `sales` (ticker, account_id, quantity, price, currency + `eur_per_unit` snapshot, `cash_credited`, reason, sold_at). The same ticker may appear in many accounts and several times in one; the dashboard aggregates open lots per ticker (`PortfolioPosition`, with `lots[]` for the breakdown). Stock records are created with the first lot (`upsertStock`) and removed when the last lot goes (`deleteOrphanStocks`); saving a lot with `stock` fields updates the shared stock record. Deleting an account cascades to its lots and sales; deleting a stock removes its lots and sales (the UI confirms with counts).
- **Ledger** (`server/ledger.ts`): lots and sales are the source of truth; what is still held and what each sale earned are *derived* by `replayLedger` — per account × ticker, events in date order (undated lots count as oldest, a purchase precedes a sale on the same day), each sale consuming the **oldest lots first (FIFO)**. Output: open lots (`remaining`) and settled sales (`costBasis`, `realizedPl`, `unmatchedQuantity`). Because it's derived, correcting an old purchase price re-computes later realized P/L. `assertLedgerConsistent` guards lot edits/deletes (400 if a sale would lose its purchase); `availableQuantity` guards new sales (can't sell more than held on that date). Realized P/L in EUR uses the sale-time `eur_per_unit` when known, else today's rate. Recording a sale with `creditCash` adds `quantity × price`, converted trading → account currency via the EUR rates, to the account's free cash and stores it as `cash_credited`; editing/deleting the sale applies the delta / takes it back.
- **Routes**: `GET /api/portfolio[?refresh=1][&account=ID]` (positions per ticker + `accounts[]` summaries with cash and realized P/L in EUR + `stocks[]` catalog + scoped `totals` (stocks, cash, invested, open profit, realized) + `fxRates` + `errors[]`; `account` scopes positions/totals, `accounts`/`stocks` are always unscoped; `refresh=1` bypasses the quote/FX caches), `GET /api/history[?account=ID]` (buys + sells newest first with per-sale cost basis / realized P/L, realized per stock × account, totals), `POST /api/holdings`, `PUT|DELETE /api/holdings/:id`, `POST /api/sales`, `PUT|DELETE /api/sales/:id` (ticker/account fixed), `PUT|DELETE /api/stocks/:ticker`, `POST /api/accounts`, `PUT|DELETE /api/accounts/:id`, `GET|PUT /api/settings`, plus `health`, `export`, `import`.
- **Market data** (`server/quotes.ts`): prices (plus the previous session's close, migration 004, for `dayChangePct`) are fetched **server-side** and cached in the `quotes` table for 15 min; EUR rates come from Frankfurter (ECB reference rates, keyless) cached 12 h in `fx_rates`. Provider is the `quote_provider` setting — `yahoo` (default; unofficial `query1.finance.yahoo.com/v8/finance/chart/<symbol>` endpoint, no key, worldwide symbols like `NOVO-B.CO`, reports currency + name) or `finnhub` (official free tier, needs `finnhub_api_key` setting, US listings only, no currency in the response). A failed fetch falls back to the cached price flagged `quoteStale`, with a per-ticker message in `errors[]`; the rest of the portfolio still renders.
- **Currency rule**: a stock's stored `currency` is only a fallback — when the quote reports a currency (Yahoo), that one is used for purchase prices, market price, profit and the EUR conversion (`currencyEffective` in the response). London `GBp` quotes are normalised to GBP. Account cash is converted with the same ECB rates. All derived numbers (profit, EUR values, weights, per-account and scoped totals) are computed in `server/portfolio.ts`; the client only formats.
- **Typo-proof inputs**: the lot form suggests existing tickers (datalist) and prefills the stock's sector/currency/notes when a known ticker is typed; sector and currency are selects (`SectorSelect` = GICS + sectors already in use + "Other…", `CurrencySelect` = `CURRENCIES`). Decimal inputs accept `,` as well as `.`.
- **Sell form** (`SellForm`): account select limited to accounts holding the stock (forced choice when more than one), amount capped at what that account holds, price prefilled from the quote, date defaulting to today, required reason, "add proceeds to free cash" with the converted amount, and a live FIFO preview (`fifoCost` mirrors the server's replay for the chosen account's lots). The same component edits a sale from the History page (`initial` set, `position` null).
- The server code is typechecked by `tsconfig.node.json` (not the app config — no `@/` alias there) and gets Node globals in `eslint.config.js`.

## Styling

- **Component styles**: co-located CSS modules (`<Name>.module.scss`). The `@/` alias works in SCSS `@use`.
- **Global SCSS** in `src/styles/`, loaded once from `App.tsx` via `main.scss`, in this order: `utils/` (variables, functions/breakpoint helpers) → `base/` (fonts, global, reset, typography, colors) → `layout/`. `utils/_form.scss` holds shared form mixins for feature modules to `@use`.
- **Visual direction — "night desk"**: a trading terminal after hours. OLED-black, blue-cast ground (`--clr-paper`, `--clr-paper-2/3` for raised surfaces and hairlines, `--clr-surface` for dialogs/menus/the chart card), near-white text (`--clr-ink`, `--clr-ink-soft` for secondary), luminous mint `--clr-gain` / coral `--clr-loss` for signed figures, amber `--clr-foil` as the single signal color (kickers, active nav, Sell markers, selection), `--clr-muted` for labels. `--clr-glow` is a mint halo used only on focus rings, focused fields and the hero figure. A light **"day desk"** variant (cool paper, deep ink, the same semantics darkened for contrast) sits on the same tokens. Both are mixins in `base/_colors.scss` (`night` on `:root`, `day` under `prefers-color-scheme: light` and `[data-theme="light"]`), including `color-scheme`, the `--select-chevron` data URI and the `--chart-1..10` slice colors the `SectorChart` fills reference. The ink/paper names mean foreground/ground and the older aliases (`--clr-accent`, `--clr-gray-dark`, `--clr-gray-light`, `--clr-gold`, `--clr-white`, `--background-color-secondary`) are kept. Never hardcode a hex in a module — add a token to both mixins instead.
- **Theme switching**: `src/lib/theme.ts` (`Theme` = `system | light | dark`, `getTheme`/`applyTheme`, `THEMES` option list) keeps the choice in `localStorage` (`rahamasin.theme`, a per-browser preference, deliberately not in the DB) and sets `data-theme` on `<html>`; an inline script in `index.html` applies it before first paint. `useTheme` (a `useSyncExternalStore` store, re-exported from the settings hooks) gives `theme`, the OS-resolved `resolved` palette and `setTheme`; the header's `ThemeToggle` flips between light and dark (pinning the choice), while the Settings page's "Appearance" section offers the full System/Night/Day choice.
- Shared mixins in `utils/_form.scss`: `caps-label` (tracked small caps for every label/table header), `kicker`, `figures($size)` (mono tabular numbers — use it on every numeric cell/value), `page-heading`, `double-rule`, fields (dark inset wells with a hairline border, mint border + glow on focus) and buttons (`button-primary` = mint block, ink on hover; `button-ghost` = hairline). Dialogs and menus are ink-bordered with a hard slate offset shadow instead of a blur.
- **Font**: Space Grotesk (400–700) from Google Fonts for text plus JetBrains Mono (`--font-mono`) for every figure; both linked in `index.html`. `--font-primary` falls back to the self-hosted Helvetica Neue LT Pro (`public/static/fonts/`, faces in `base/_fonts.scss`, only fetched offline; no 600 weight). Data tables use 0.875rem text / 0.8125rem mono with 8px cell padding.
- **Signature elements**: the `TickerTape` strip above the dashboard hero (scrolling positions with day change; paused on hover, static + hand-scrollable under `prefers-reduced-motion`) and the "ledger strip" of stat tiles (`.ledger` in `DashboardPage.module.scss`: one ruled row divided by hairlines). Keep the rest quiet — no gradients, radii or blurred shadows; the only soft light is `--clr-glow`.
- **Animation** uses the `motion` package — import from `motion/react`, never `framer-motion`. `base/_global.scss` collapses all animation under `prefers-reduced-motion`.

## Gotchas

- `Text`/`Heading` type props (`size`, `weight`, `color`, …) become **inline styles** and beat any class. To style one via a CSS module, omit the conflicting props — `Heading` deliberately has no size/weight/color defaults for this reason (an unstyled `Heading` inherits until given props or module styles).
- Sass drops empty rules — and their CSS-module class mappings with them — so every module class needs at least one declaration.
- `pnpm-workspace.yaml` is not a monorepo marker; it's where pnpm 11 keeps install settings (`@parcel/watcher` build script deliberately disabled — Vite drives sass through `sass-embedded`).
- Path alias `@/` → `src/` (defined in both `vite.config.ts` and `tsconfig.app.json`).
- ESLint's `react-hooks/set-state-in-effect` rule is on: don't call setState (or a function that does) synchronously inside `useEffect`. Seed state from props at mount (mount the component only when its data exists — see `HoldingForm` / `MarketDataForm`) or keep setState inside promise callbacks (see `usePortfolio`).
- Editing files under `server/` restarts the Vite dev server (they're imported by `vite.config.ts`); the DB connection and caches survive in SQLite, so nothing is lost.
