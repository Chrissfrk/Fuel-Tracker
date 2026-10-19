import fs from 'node:fs';
import path from 'node:path';
import type { FastifyBaseLogger } from 'fastify';
import { todayIso } from '@fuel/shared';
import type { DB } from './db/client';

export const BACKUP_KEEP = 14;
const BACKUP_RE = /^app-\d{4}-\d{2}-\d{2}\.db$/;

/** SQLite online backup to `app-YYYY-MM-DD.db`, keeping the newest `BACKUP_KEEP` files. */
export async function runBackup(db: DB, dir: string, now = new Date()): Promise<string> {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `app-${todayIso(now)}.db`);
  const tmp = `${file}.tmp`;
  await db.$client.backup(tmp);
  fs.renameSync(tmp, file);
  pruneBackups(dir);
  return file;
}

export function pruneBackups(dir: string, keep = BACKUP_KEEP): string[] {
  const files = fs
    .readdirSync(dir)
    .filter((f) => BACKUP_RE.test(f))
    .sort();
  const remove = files.slice(0, Math.max(0, files.length - keep));
  for (const f of remove) fs.rmSync(path.join(dir, f));
  return remove;
}

export function listBackups(dir: string) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => BACKUP_RE.test(f))
    .sort()
    .reverse()
    .map((name) => ({ name, sizeBytes: fs.statSync(path.join(dir, name)).size }));
}

/** Run every night at 03:00 local time (set TZ, e.g. Europe/Athens). */
export function scheduleNightlyBackups(db: DB, dir: string, log: FastifyBaseLogger) {
  let timer: NodeJS.Timeout;
  const schedule = () => {
    const now = new Date();
    const next = new Date(now);
    next.setHours(3, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    timer = setTimeout(async () => {
      try {
        const file = await runBackup(db, dir);
        log.info({ file }, 'nightly backup written');
      } catch (err) {
        log.error({ err }, 'nightly backup failed');
      }
      schedule();
    }, next.getTime() - now.getTime());
    timer.unref();
  };
  schedule();
  return () => clearTimeout(timer);
}
