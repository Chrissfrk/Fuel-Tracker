import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { sql } from 'drizzle-orm';
import * as schema from './schema';

export type DB = BetterSQLite3Database<typeof schema> & { $client: Database.Database };

export function openDatabase(file: string, migrationsDir: string): DB {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('synchronous = NORMAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('busy_timeout = 5000');
  const db = drizzle({ client: sqlite, schema, casing: 'snake_case' }) as DB;
  migrate(db, { migrationsFolder: migrationsDir });
  db.run(sql`INSERT INTO meta (key, value) VALUES ('rev', 0) ON CONFLICT(key) DO NOTHING`);
  return db;
}

/** Next global change number. Call inside the same transaction as the write. */
export function nextRev(db: DB): number {
  const row = db.$client
    .prepare(`UPDATE meta SET value = value + 1 WHERE key = 'rev' RETURNING value`)
    .get() as { value: number };
  return row.value;
}

export function currentRev(db: DB): number {
  const row = db.$client.prepare(`SELECT value FROM meta WHERE key = 'rev'`).get() as
    { value: number } | undefined;
  return row?.value ?? 0;
}
