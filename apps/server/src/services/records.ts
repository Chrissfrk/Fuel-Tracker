import { and, eq, gt, inArray, isNull, or } from 'drizzle-orm';
import { z } from 'zod';
import {
  SYNC_TABLES,
  recordSchemas,
  type PushOp,
  type PushResult,
  type SyncChanges,
  type SyncPullResponse,
  type SyncTable,
} from '@fuel/shared';
import { currentRev, nextRev, type DB } from '../db/client';
import { budgets, carAccess, cars, syncTables, users } from '../db/schema';
import type { SessionUser } from '../auth/sessions';

/** Server clock skew tolerance for client `updatedAt` values. */
const MAX_FUTURE_MS = 60_000;

/** Cars this user may see (including soft-deleted ones, so deletions still sync). */
export function visibleCarIds(db: DB, user: Pick<SessionUser, 'id' | 'role'>): Set<string> {
  const allCars = db.select({ id: cars.id }).from(cars).all();
  if (user.role === 'admin') return new Set(allCars.map((c) => c.id));
  const access = db.select().from(carAccess).all();
  const restricted = new Map<string, Set<string>>();
  for (const a of access) {
    let s = restricted.get(a.carId);
    if (!s) restricted.set(a.carId, (s = new Set()));
    s.add(a.userId);
  }
  return new Set(
    allCars
      .filter((c) => !restricted.has(c.id) || restricted.get(c.id)!.has(user.id))
      .map((c) => c.id),
  );
}

type AnyRow = Record<string, unknown> & {
  id: string;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
  createdBy: string;
  carId?: string | null;
};

function permissionError(
  table: SyncTable,
  user: SessionUser,
  existing: AnyRow | undefined,
  rec: AnyRow,
  visible: Set<string>,
): string | null {
  const isAdmin = user.role === 'admin';
  const deleting = rec.deletedAt != null && existing?.deletedAt == null;
  const carVisible = (id: string | null | undefined) => id != null && visible.has(id);

  switch (table) {
    case 'cars':
      if (isAdmin) return null;
      if (existing && !carVisible(existing.id)) return 'You do not have access to this car';
      if (deleting) return 'Only an admin can delete a car';
      return null;
    case 'budgets':
      return isAdmin ? null : 'Only an admin can change budgets';
    case 'reminders':
      if (!carVisible(rec.carId) || (existing && !carVisible(existing.carId))) {
        return 'You do not have access to this car';
      }
      return null;
    case 'fillups':
    case 'expenses':
    case 'odometerReadings':
      if (!carVisible(rec.carId) || (existing && !carVisible(existing.carId))) {
        return 'You do not have access to this car';
      }
      if (existing && !isAdmin && existing.createdBy !== user.id) {
        return 'You can only change records you logged';
      }
      return null;
  }
}

function tableOf(name: SyncTable) {
  // The tables share the record columns; per-table typing isn't useful for generic upserts.
  return syncTables[name] as unknown as typeof cars;
}

function stripRev<T extends { rev?: number }>(row: T): Omit<T, 'rev'> {
  const { rev: _rev, ...rest } = row;
  return rest;
}

/**
 * Apply one pushed record with last-write-wins on `updatedAt`.
 * The server owns `createdBy` and `createdAt` (set once, on insert) and assigns `rev`.
 */
export function applyOp(
  db: DB,
  user: SessionUser,
  op: PushOp,
  visible: Set<string>,
  now = Date.now(),
): PushResult {
  const schema = recordSchemas[op.table] as z.ZodType<AnyRow>;
  const parsed = schema.safeParse(op.record);
  if (!parsed.success) {
    return { opId: op.opId, status: 'rejected', error: z.prettifyError(parsed.error) };
  }
  const rec = parsed.data;
  const table = tableOf(op.table);
  const existing = db.select().from(table).where(eq(table.id, rec.id)).get() as AnyRow | undefined;

  const denied = permissionError(op.table, user, existing, rec, visible);
  if (denied) return { opId: op.opId, status: 'rejected', error: denied };

  const updatedAt = Math.min(rec.updatedAt, now + MAX_FUTURE_MS);
  if (existing && existing.updatedAt >= updatedAt) {
    return { opId: op.opId, status: existing.updatedAt === updatedAt ? 'applied' : 'stale' };
  }

  const row = {
    ...rec,
    createdBy: existing?.createdBy ?? user.id,
    createdAt: existing?.createdAt ?? Math.min(rec.createdAt, now),
    updatedAt,
    rev: nextRev(db),
  };
  db.insert(table)
    .values(row as typeof cars.$inferInsert)
    .onConflictDoUpdate({ target: table.id, set: row as typeof cars.$inferInsert })
    .run();
  if (op.table === 'cars' && !existing) visible.add(rec.id);
  return { opId: op.opId, status: 'applied' };
}

export function applyOps(db: DB, user: SessionUser, ops: readonly PushOp[]): PushResult[] {
  return db.$client.transaction(() => {
    const visible = visibleCarIds(db, user);
    return ops.map((op) => applyOp(db, user, op, visible));
  })();
}

/** Everything the user can see that changed after `since`. */
export function pullChanges(db: DB, user: SessionUser, since: number): SyncPullResponse {
  return db.$client.transaction(() => {
    const rev = currentRev(db);
    const visible = [...visibleCarIds(db, user)];
    const changes = {} as SyncChanges;
    for (const name of SYNC_TABLES) {
      const t = tableOf(name);
      let where;
      if (name === 'cars') where = and(gt(t.rev, since), inArray(t.id, visible));
      else if (name === 'budgets') {
        where = and(
          gt(budgets.rev, since),
          or(isNull(budgets.carId), inArray(budgets.carId, visible)),
        );
      } else {
        const ct = syncTables[name] as unknown as typeof syncTables.fillups;
        where = and(gt(ct.rev, since), inArray(ct.carId, visible));
      }
      const rows = db.select().from(t).where(where).all();
      (changes as unknown as Record<string, unknown[]>)[name] = rows.map(stripRev);
    }
    const userRows = db.select().from(users).where(isNull(users.deletedAt)).all();
    return {
      rev,
      carIds: visible,
      users: userRows.map((u) => ({
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        role: u.role,
        active: u.active,
      })),
      changes,
    };
  })();
}

/** Write a server-originated record (seed, import) through the same rev bookkeeping. */
export function writeRecord<T extends SyncTable>(
  db: DB,
  table: T,
  record: Record<string, unknown>,
): void {
  const t = tableOf(table);
  const row = { ...record, rev: nextRev(db) } as typeof cars.$inferInsert;
  db.insert(t).values(row).onConflictDoUpdate({ target: t.id, set: row }).run();
}
