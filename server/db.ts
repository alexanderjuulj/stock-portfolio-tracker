import { AsyncLocalStorage } from "node:async_hooks";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { MIGRATIONS } from "./migrations";

// Resolved against cwd: the pnpm scripts always run from the repo root.
const DATA_DIR = path.resolve(process.cwd(), "data");
export const DB_PATH = path.join(DATA_DIR, "rahamasin.db");
export const CONCEPT_DB_PATH = path.join(DATA_DIR, "rahamasin.concept.db");

let db: DatabaseSync | null = null;
let conceptDb: DatabaseSync | null = null;

// ── Concept mode ─────────────────────────────────────────────────────────────
// A sandbox: a full copy of the real database that requests carrying the
// `x-concept` header run against, so every feature works there unchanged and
// the real file is never written through it. Entering takes a fresh copy,
// leaving deletes it. AsyncLocalStorage carries the per-request flag through
// the awaits inside route handlers, so concurrent real-mode requests are
// never misrouted.

const conceptContext = new AsyncLocalStorage<boolean>();

/** Run `fn` (a whole request) against the concept sandbox or the real DB. */
export function runInConceptContext<T>(concept: boolean, fn: () => T): T {
  return conceptContext.run(concept, fn);
}

export function inConceptContext(): boolean {
  return conceptContext.getStore() === true;
}

function removeConceptFiles(): void {
  for (const sidecar of ["", "-wal", "-shm"]) {
    fs.rmSync(CONCEPT_DB_PATH + sidecar, { force: true });
  }
}

// `VACUUM INTO` from the live connection so a WAL checkpoint can't be missing.
function forkConceptFile(): void {
  removeConceptFiles();
  getRealDb().exec(`VACUUM INTO '${CONCEPT_DB_PATH.replaceAll("'", "''")}'`);
}

/** Enter concept mode: (re)create the sandbox as a fresh copy of the real DB. */
export function startConceptMode(): void {
  if (conceptDb) {
    conceptDb.close();
    conceptDb = null;
  }
  forkConceptFile();
  conceptDb = openDatabase(CONCEPT_DB_PATH);
}

/** Leave concept mode: discard the sandbox and everything done in it. */
export function stopConceptMode(): void {
  if (conceptDb) {
    conceptDb.close();
    conceptDb = null;
  }
  removeConceptFiles();
}

function getRealDb(): DatabaseSync {
  if (!db) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    db = openDatabase(DB_PATH);
  }
  return db;
}

export function getDb(): DatabaseSync {
  if (!inConceptContext()) return getRealDb();
  if (!conceptDb) {
    // Concept request without an open sandbox: reopen the file if it survived
    // a dev-server restart, else fork a fresh copy (a missed start call).
    if (!fs.existsSync(CONCEPT_DB_PATH)) forkConceptFile();
    conceptDb = openDatabase(CONCEPT_DB_PATH);
  }
  return conceptDb;
}

/** Path of the database file the current request operates on. */
export function activeDbPath(): string {
  return inConceptContext() ? CONCEPT_DB_PATH : DB_PATH;
}

function openDatabase(file: string): DatabaseSync {
  const d = new DatabaseSync(file);
  d.exec("PRAGMA journal_mode = WAL");
  d.exec("PRAGMA foreign_keys = ON");
  migrate(d);
  return d;
}

export function schemaVersion(d: DatabaseSync): number {
  const row = d.prepare("PRAGMA user_version").get() as { user_version: number };
  return row.user_version;
}

function migrate(d: DatabaseSync): void {
  for (let v = schemaVersion(d); v < MIGRATIONS.length; v++) {
    d.exec("BEGIN");
    try {
      d.exec(MIGRATIONS[v]);
      d.exec(`PRAGMA user_version = ${v + 1}`);
      d.exec("COMMIT");
    } catch (err) {
      d.exec("ROLLBACK");
      throw err;
    }
  }
}

/**
 * Write a consistent single-file snapshot of the live database and return it.
 * `VACUUM INTO` is used instead of copying the file so a WAL checkpoint can
 * never be missing from the export. Always the REAL database — backups are
 * of real data, whatever mode the request arrived in.
 */
export function exportSnapshot(): Buffer {
  const tmp = path.join(DATA_DIR, `.export-${process.pid}-${Date.now()}.db`);
  fs.rmSync(tmp, { force: true });
  try {
    getRealDb().exec(`VACUUM INTO '${tmp.replaceAll("'", "''")}'`);
    return fs.readFileSync(tmp);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

/**
 * Replace the live database with an uploaded snapshot. The bytes are written
 * to a temp file and opened + integrity-checked first; only then is the live
 * file swapped out. Reopening runs migrations, so importing an export taken
 * on an older schema upgrades it in place.
 */
export function importSnapshot(bytes: Buffer): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = path.join(DATA_DIR, `.import-${process.pid}-${Date.now()}.db`);
  fs.writeFileSync(tmp, bytes);
  try {
    const candidate = new DatabaseSync(tmp);
    try {
      const check = candidate.prepare("PRAGMA integrity_check").get() as {
        integrity_check: string;
      };
      if (check.integrity_check !== "ok") {
        throw new Error(`integrity_check failed: ${check.integrity_check}`);
      }
    } finally {
      candidate.close();
    }

    if (db) {
      db.close();
      db = null;
    }
    for (const sidecar of ["", "-wal", "-shm"]) {
      fs.rmSync(DB_PATH + sidecar, { force: true });
    }
    fs.renameSync(tmp, DB_PATH);
    getRealDb(); // reopen + migrate immediately so a bad import surfaces here
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}
