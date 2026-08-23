import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { MIGRATIONS } from "./migrations";

// Resolved against cwd: the pnpm scripts always run from the repo root.
const DATA_DIR = path.resolve(process.cwd(), "data");
export const DB_PATH = path.join(DATA_DIR, "rahamasin.db");

let db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (!db) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    db = openDatabase(DB_PATH);
  }
  return db;
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
 * never be missing from the export.
 */
export function exportSnapshot(): Buffer {
  const tmp = path.join(DATA_DIR, `.export-${process.pid}-${Date.now()}.db`);
  fs.rmSync(tmp, { force: true });
  try {
    getDb().exec(`VACUUM INTO '${tmp.replaceAll("'", "''")}'`);
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
    getDb(); // reopen + migrate immediately so a bad import surfaces here
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}
