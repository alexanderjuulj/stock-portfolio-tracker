# Rahamasin

A stock portfolio tracker that runs **locally only** — you start it with pnpm on
your own machine, and your data lives in a local database you can import and
export. No cloud, no accounts, no deployment.

> Status: cleaned scaffold with the data layer wired up. The previous project's
> Supabase backend and domain features have been removed; the portfolio
> features come next.

## Stack

- **Frontend:** React 19 + Vite + TypeScript
- **Styling:** SCSS — global styles in `src/styles/`, co-located CSS modules per component
- **Routing:** react-router-dom · **Animation:** [motion](https://motion.dev)
- **Data:** a SQLite file (`data/rahamasin.db`) via Node's built-in `node:sqlite` —
  no database to install or run, served by an API mounted inside Vite itself

## Getting started

Prerequisites: [pnpm](https://pnpm.io) and Node ≥ 22.13 (for the built-in
SQLite module).

```sh
pnpm install
pnpm dev          # start the app at the printed localhost URL
```

Other scripts: `pnpm build` (typecheck + production build), `pnpm lint`,
`pnpm preview` (serve the built app).

That's everything — the first start creates `data/rahamasin.db` automatically,
and the API runs inside the Vite dev server (one process, one port). The
`ExperimentalWarning: SQLite` line Node prints on boot is harmless.

## Your data

- Lives in `data/rahamasin.db` (gitignored).
- **Backup / export:** download `http://localhost:5173/api/export` — a
  self-contained, dated `.db` snapshot.
- **Restore / import:** `POST` a snapshot's bytes to `/api/import`. The file is
  integrity-checked before it replaces the live database, and older snapshots
  are migrated forward automatically. (UI for both is planned.)

## Project structure

```
server/            # the /api routes + SQLite handling, run inside Vite's server
src/
  App.tsx          # routes; placeholder home page for now
  main.tsx         # entry point
  components/
    ui/            # local layout/typography primitives (Box, Flex, Grid, Text, Heading)
    shared/        # cross-feature pieces (ConfirmDialog)
  features/        # one folder per feature: {pages,components,hooks,api}, all barrel-exported
  lib/             # layout-prop engine, small utils
  styles/          # global SCSS: utils → base → layout
```

The full conventions — feature folder shape, file naming, component style,
barrel imports, styling rules and gotchas — are written down in
[CLAUDE.md](./CLAUDE.md).
