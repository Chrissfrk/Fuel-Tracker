import {
  newId,
  recordSchemas,
  type BaseRecord,
  type SyncRecordMap,
  type SyncTable,
} from '@fuel/shared';
import { z } from 'zod';
import { getDb } from './db';
import { requestSync } from './sync';

export class ValidationError extends Error {
  constructor(public issues: z.core.$ZodIssue[]) {
    super(issues[0]?.message ?? 'Invalid input');
  }
  /** First message per top-level field, for inline form errors. */
  get fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const i of this.issues) {
      const k = String(i.path[0] ?? '_');
      out[k] ??= i.message;
    }
    return out;
  }
}

export function newBase(userId: string): BaseRecord {
  const now = Date.now();
  return { id: newId(), createdAt: now, updatedAt: now, deletedAt: null, createdBy: userId };
}

/**
 * Offline-first write: validate, store locally, queue for the server, kick the sync worker.
 * `updatedAt` always moves forward so last-write-wins treats this as the newest version.
 */
export async function saveRecord<T extends SyncTable>(
  table: T,
  record: SyncRecordMap[T],
): Promise<SyncRecordMap[T]> {
  const db = getDb();
  const t = db.table_(table);
  const prev = await t.get(record.id);
  const stamped = { ...record, updatedAt: Math.max(Date.now(), (prev?.updatedAt ?? 0) + 1) };
  const parsed = (recordSchemas[table] as z.ZodType).safeParse(stamped);
  if (!parsed.success) throw new ValidationError(parsed.error.issues);
  const clean = parsed.data as SyncRecordMap[T];
  await db.transaction('rw', t, db.outbox, async () => {
    await t.put(clean as never);
    await db.outbox.add({
      kind: 'record',
      table,
      recordId: clean.id,
      opId: newId(),
      createdAt: Date.now(),
      attempts: 0,
    });
  });
  requestSync();
  return clean;
}

export async function saveRecords<T extends SyncTable>(table: T, records: SyncRecordMap[T][]) {
  for (const r of records) await saveRecord(table, r);
}

/** Soft delete. Returns an undo function that restores the record. */
export async function softDelete<T extends SyncTable>(
  table: T,
  id: string,
): Promise<() => Promise<void>> {
  const db = getDb();
  const rec = (await db.table_(table).get(id)) as SyncRecordMap[T] | undefined;
  if (!rec) return async () => {};
  await saveRecord(table, { ...rec, deletedAt: Date.now() });
  return async () => {
    const current = (await db.table_(table).get(id)) as SyncRecordMap[T] | undefined;
    if (current) await saveRecord(table, { ...current, deletedAt: null });
  };
}

/** Undo for a newly created record = delete it. */
export const undoCreate = (table: SyncTable, id: string) => async () => {
  await softDelete(table, id);
};

/** Store a compressed receipt photo locally and queue its upload. */
export async function savePhoto(blob: Blob): Promise<string> {
  const db = getDb();
  const id = newId();
  await db.transaction('rw', db.photos, db.outbox, async () => {
    await db.photos.put({ id, blob, mimeType: blob.type || 'image/jpeg', uploaded: false });
    await db.outbox.add({
      kind: 'photo',
      recordId: id,
      opId: newId(),
      createdAt: Date.now(),
      attempts: 0,
    });
  });
  requestSync();
  return id;
}
