import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import {
  alive,
  type SyncRecordMap,
  type SyncTable,
  type Budget,
  type Car,
  type Expense,
  type Fillup,
  type OdometerReading,
  type PublicUser,
  type Reminder,
} from '@fuel/shared';
import { getDb } from './db';
import { syncStatusStore } from './sync';

const EMPTY: never[] = [];

export function useCars(opts: { includeArchived?: boolean } = {}): Car[] {
  const cars = useLiveQuery(() => getDb().cars.toArray(), []) ?? EMPTY;
  return useMemo(
    () =>
      alive(cars)
        .filter((c) => opts.includeArchived || !c.archived)
        .sort((a, b) => Number(a.archived) - Number(b.archived) || a.name.localeCompare(b.name)),
    [cars, opts.includeArchived],
  );
}

export const useLoaded = () =>
  useLiveQuery(
    () =>
      getDb()
        .cars.count()
        .then(() => true),
    [],
  ) ?? false;

/** All live records of one kind for the given cars (`null` = every visible car). */
function useRecords<T extends { carId: string | null; deletedAt: number | null }>(
  load: () => Promise<T[]>,
  carIds: readonly string[] | null,
): T[] {
  const rows = useLiveQuery(load, []) ?? (EMPTY as T[]);
  const key = carIds?.join(',') ?? '*';
  return useMemo(() => {
    const set = carIds ? new Set(carIds) : null;
    return alive(rows).filter((r) => !set || (r.carId != null && set.has(r.carId)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, key]);
}

export const useFillups = (carIds: readonly string[] | null) =>
  useRecords<Fillup>(() => getDb().fillups.toArray(), carIds);
export const useExpenses = (carIds: readonly string[] | null) =>
  useRecords<Expense>(() => getDb().expenses.toArray(), carIds);
export const useOdometerReadings = (carIds: readonly string[] | null) =>
  useRecords<OdometerReading>(() => getDb().odometerReadings.toArray(), carIds);
export const useReminders = (carIds: readonly string[] | null) =>
  useRecords<Reminder>(() => getDb().reminders.toArray(), carIds);

export function useBudgets(): Budget[] {
  const rows = useLiveQuery(() => getDb().budgets.toArray(), []) ?? EMPTY;
  return useMemo(() => alive(rows), [rows]);
}

export function useUsers(): PublicUser[] {
  return useLiveQuery(() => getDb().users.toArray(), []) ?? EMPTY;
}

export function useUserNames(): Map<string, string> {
  const users = useUsers();
  return useMemo(() => new Map(users.map((u) => [u.id, u.displayName])), [users]);
}

export const usePendingCount = () => useLiveQuery(() => getDb().outbox.count(), []) ?? 0;

export const useSyncStatus = () =>
  useSyncExternalStore(syncStatusStore.subscribe, syncStatusStore.get);

export function useLocalPhoto(id: string | null): string | null {
  const blob = useLiveQuery(
    async () => (id ? (await getDb().photos.get(id))?.blob : undefined),
    [id],
  );
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  return url ?? (id ? `/api/photos/${id}` : null);
}

/** One record by id: `undefined` while loading, `null` when missing or deleted. */
export function useRecord<T extends SyncTable>(
  table: T,
  id: string | undefined,
): SyncRecordMap[T] | null | undefined {
  return useLiveQuery(async () => {
    if (!id) return null;
    const r = (await getDb().table_(table).get(id)) as SyncRecordMap[T] | undefined;
    return r && r.deletedAt == null ? r : null;
  }, [table, id]);
}
