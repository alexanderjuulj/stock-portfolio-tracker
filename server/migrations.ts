// Ordered schema migrations. The database's `PRAGMA user_version` records how
// many of these have run; on boot (and after an import) every migration past
// that point is applied in order, each in its own transaction.
//
// Rules:
// - Append only — never edit or reorder an entry that has shipped, since
//   existing database files (including exported backups) rely on the index.
// - Plain SQL strings; one entry may contain multiple statements.
export const MIGRATIONS: string[] = [];
