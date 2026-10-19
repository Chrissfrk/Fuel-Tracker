import Dexie, { type Table } from 'dexie';
import type {
  Budget,
  Car,
  Expense,
  Fillup,
  OdometerReading,
  PublicUser,
  Reminder,
  SyncTable,
} from '@fuel/shared';

export interface OutboxEntry {
  seq?: number;
  kind: 'record' | 'photo';
  table?: SyncTable;
  recordId: string;
  opId: string;
  createdAt: number;
  attempts: number;
  lastError?: string;
}

export interface LocalPhoto {
  id: string;
  blob: Blob;
  mimeType: string;
  uploaded: boolean;
}

export interface MetaRow {
  key: string;
  value: unknown;
}

export class FuelDB extends Dexie {
  cars!: Table<Car, string>;
  fillups!: Table<Fillup, string>;
  expenses!: Table<Expense, string>;
  odometerReadings!: Table<OdometerReading, string>;
  reminders!: Table<Reminder, string>;
  budgets!: Table<Budget, string>;
  users!: Table<PublicUser, string>;
  outbox!: Table<OutboxEntry, number>;
  photos!: Table<LocalPhoto, string>;
  meta!: Table<MetaRow, string>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      cars: 'id',
      fillups: 'id, carId, date',
      expenses: 'id, carId, date',
      odometerReadings: 'id, carId',
      reminders: 'id, carId',
      budgets: 'id, carId',
      users: 'id',
      outbox: '++seq, recordId',
      photos: 'id, uploaded',
      meta: 'key',
    });
  }

  table_<T extends SyncTable>(name: T) {
    return this[name] as unknown as Table<
      { id: string; updatedAt: number; carId?: string | null },
      string
    >;
  }
}

/** One local database per user, so switching accounts on a device never mixes data. */
let current: FuelDB | null = null;
let currentUser: string | null = null;

export function openUserDb(userId: string): FuelDB {
  if (current && currentUser === userId) return current;
  current?.close();
  current = new FuelDB(`fuel-${userId}`);
  currentUser = userId;
  return current;
}

export function getDb(): FuelDB {
  if (!current) throw new Error('Local database is not open (no user)');
  return current;
}

export function hasDb() {
  return current != null;
}

export async function deleteUserDb(userId: string) {
  if (currentUser === userId) {
    current?.close();
    current = null;
    currentUser = null;
  }
  await Dexie.delete(`fuel-${userId}`);
}

export async function getMeta<T>(key: string, fallback: T): Promise<T> {
  const row = await getDb().meta.get(key);
  return row ? (row.value as T) : fallback;
}

export async function setMeta(key: string, value: unknown) {
  await getDb().meta.put({ key, value });
}
