import { SYNC_TABLES, type PushResult, type SyncPullResponse, type SyncTable } from '@fuel/shared';
import { ApiError, NetworkError, api } from './api';
import { getDb, getMeta, hasDb, setMeta, type OutboxEntry } from './db';

export type SyncState = 'idle' | 'syncing' | 'offline' | 'error';

export interface SyncStatus {
  state: SyncState;
  lastSyncedAt: number | null;
  lastError: string | null;
}

let status: SyncStatus = { state: 'idle', lastSyncedAt: null, lastError: null };
const listeners = new Set<() => void>();
const setStatus = (patch: Partial<SyncStatus>) => {
  status = { ...status, ...patch };
  listeners.forEach((l) => l());
};
export const syncStatusStore = {
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  get: () => status,
};

/** Rejected changes are reported to the UI (toast) through this hook. */
let onRejected: (messages: string[]) => void = () => {};
export const setRejectedHandler = (fn: (messages: string[]) => void) => {
  onRejected = fn;
};

const PUSH_BATCH = 100;
let running: Promise<void> | null = null;
let again = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let backoffMs = 2000;
let debounce: ReturnType<typeof setTimeout> | null = null;

/** Ask for a sync soon (coalesces bursts of local writes). */
export function requestSync(delay = 300) {
  if (debounce) clearTimeout(debounce);
  debounce = setTimeout(() => void syncNow(), delay);
}

export function syncNow(opts: { full?: boolean } = {}): Promise<void> {
  if (!hasDb()) return Promise.resolve();
  if (opts.full) void setMeta('cursor', 0);
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    try {
      do {
        again = false;
        await runOnce();
      } while (again);
    } finally {
      running = null;
    }
  })();
  return running;
}

async function runOnce() {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    setStatus({ state: 'offline' });
    return;
  }
  setStatus({ state: 'syncing' });
  try {
    const needFull = await pushOutbox();
    await pull(needFull);
    backoffMs = 2000;
    setStatus({ state: 'idle', lastSyncedAt: Date.now(), lastError: null });
  } catch (err) {
    if (err instanceof NetworkError) setStatus({ state: 'offline' });
    else if (err instanceof ApiError && err.status === 401) {
      setStatus({ state: 'error', lastError: 'Signed out' });
      return; // the auth gate takes over
    } else setStatus({ state: 'error', lastError: (err as Error).message });
    retryTimer = setTimeout(() => void syncNow(), backoffMs);
    backoffMs = Math.min(backoffMs * 2, 60_000);
  }
}

/** Send queued writes in order. Returns true when a full re-pull is needed. */
async function pushOutbox(): Promise<boolean> {
  const db = getDb();
  let needFull = false;
  const rejected: string[] = [];

  for (;;) {
    const entries = await db.outbox.orderBy('seq').limit(PUSH_BATCH).toArray();
    if (entries.length === 0) break;

    // Photos first (in order) so records that reference them never point at a missing file.
    const photoEntries = entries.filter((e) => e.kind === 'photo');
    for (const e of photoEntries) await pushPhoto(e);

    // Several edits to one record collapse into its latest version, at its first position.
    const recordEntries = entries.filter((e) => e.kind === 'record');
    const seen = new Set<string>();
    const ops: { entry: OutboxEntry; record: unknown }[] = [];
    for (const e of recordEntries) {
      const key = `${e.table}:${e.recordId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const record = await db.table_(e.table!).get(e.recordId);
      if (record) ops.push({ entry: e, record });
    }
    if (ops.length > 0) {
      const { results } = await api<{ results: PushResult[] }>('/api/sync/push', {
        method: 'POST',
        json: {
          ops: ops.map((o) => ({ opId: o.entry.opId, table: o.entry.table, record: o.record })),
        },
      });
      for (const r of results) {
        const op = ops.find((o) => o.entry.opId === r.opId);
        if (!op) continue;
        if (r.status !== 'applied') {
          // Server kept its own version: drop ours and re-pull the truth.
          needFull = true;
          await db.table_(op.entry.table!).delete(op.entry.recordId);
          if (r.status === 'rejected') rejected.push(r.error ?? 'A change was rejected');
        }
      }
    }
    // Clear everything we just handled, including collapsed duplicates and failed photos.
    await db.outbox.bulkDelete(entries.map((e) => e.seq!));
    if (entries.length < PUSH_BATCH) break;
  }
  if (rejected.length) onRejected(rejected);
  return needFull;
}

async function pushPhoto(entry: OutboxEntry) {
  const db = getDb();
  const photo = await db.photos.get(entry.recordId);
  if (!photo) return;
  try {
    await api(`/api/photos/${photo.id}`, {
      method: 'PUT',
      body: photo.blob,
      headers: { 'Content-Type': photo.mimeType },
      timeoutMs: 60_000,
    });
    await db.photos.update(photo.id, { uploaded: true });
  } catch (err) {
    if (err instanceof ApiError && err.status < 500 && err.status !== 401) {
      // Permanent failure (bad file): report it and let the queue move on.
      onRejected([`A receipt photo could not be uploaded: ${err.message}`]);
      return;
    }
    throw err;
  }
}

async function pull(full: boolean) {
  const db = getDb();
  const since = full ? 0 : await getMeta<number>('cursor', 0);
  const res = await api<SyncPullResponse>(`/api/sync?since=${since}`);
  const knownCarIds = new Set(await getMeta<string[]>('carIds', []));
  const gained = res.carIds.some((id) => !knownCarIds.has(id));

  // Access granted to a car we never saw → its older records predate our cursor.
  if (gained && since > 0) {
    await setMeta('carIds', res.carIds);
    return pull(true);
  }

  const pendingIds = new Set((await db.outbox.toArray()).map((e) => e.recordId));
  const allowed = new Set(res.carIds);

  await db.transaction(
    'rw',
    [...SYNC_TABLES.map((t) => db.table_(t)), db.users, db.meta],
    async () => {
      for (const name of SYNC_TABLES) {
        const rows = res.changes[name] as { id: string; updatedAt: number }[];
        if (rows.length === 0) continue;
        const table = db.table_(name);
        const local = new Map(
          (await table.bulkGet(rows.map((r) => r.id)))
            .filter((r) => r != null)
            .map((r) => [r!.id, r!]),
        );
        // Local edits still waiting to be pushed win if they're newer.
        const apply = rows.filter((r) => {
          const l = local.get(r.id);
          return !(l && pendingIds.has(r.id) && l.updatedAt > r.updatedAt);
        });
        await table.bulkPut(apply as never[]);
      }
      await pruneInaccessible(allowed);
      await db.users.clear();
      await db.users.bulkPut(res.users);
      await db.meta.put({ key: 'cursor', value: res.rev });
      await db.meta.put({ key: 'carIds', value: res.carIds });
    },
  );
}

/** Drop cached data for cars this user can no longer see. */
async function pruneInaccessible(allowed: Set<string>) {
  const db = getDb();
  const carIds = (await db.cars.toCollection().primaryKeys()) as string[];
  const gone = carIds.filter((id) => !allowed.has(id));
  if (gone.length === 0) return;
  await db.cars.bulkDelete(gone);
  for (const t of [
    'fillups',
    'expenses',
    'odometerReadings',
    'reminders',
    'budgets',
  ] as SyncTable[]) {
    await db.table_(t).where('carId').anyOf(gone).delete();
  }
}

/** Wire automatic syncing: start, focus, network back, periodic while visible. */
export function startAutoSync(): () => void {
  const onFocus = () => requestSync(0);
  const onVisible = () => {
    if (document.visibilityState === 'visible') requestSync(0);
  };
  const onOnline = () => requestSync(0);
  const onOffline = () => setStatus({ state: 'offline' });
  window.addEventListener('focus', onFocus);
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  const interval = setInterval(() => {
    if (document.visibilityState === 'visible') requestSync(0);
  }, 60_000);
  requestSync(0);
  return () => {
    window.removeEventListener('focus', onFocus);
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
    clearInterval(interval);
    if (retryTimer) clearTimeout(retryTimer);
  };
}

export async function resetSyncState() {
  status = { state: 'idle', lastSyncedAt: null, lastError: null };
  listeners.forEach((l) => l());
}

export type { SyncTable };
