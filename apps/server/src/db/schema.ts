import { index, integer, primaryKey, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { EXPENSE_CATEGORIES, FUEL_TYPES, ODOMETER_SOURCES, ROLES } from '@fuel/shared';

// Column names are mapped to snake_case by the `casing` option (see db/client.ts, drizzle.config.ts).

/** Fields on every synced table. `rev` is a server-assigned, ever-increasing change number. */
const record = () => ({
  id: text().primaryKey(),
  createdAt: integer().notNull(),
  updatedAt: integer().notNull(),
  deletedAt: integer(),
  createdBy: text().notNull(),
  rev: integer().notNull(),
});

export const meta = sqliteTable('meta', {
  key: text().primaryKey(),
  value: integer().notNull(),
});

export const users = sqliteTable('users', {
  id: text().primaryKey(),
  username: text().notNull().unique(),
  displayName: text().notNull(),
  passwordHash: text().notNull(),
  role: text({ enum: ROLES }).notNull(),
  active: integer({ mode: 'boolean' }).notNull().default(true),
  defaultCarId: text(),
  createdAt: integer().notNull(),
  updatedAt: integer().notNull(),
  deletedAt: integer(),
  createdBy: text().notNull(),
  rev: integer().notNull(),
});

export const sessions = sqliteTable(
  'sessions',
  {
    /** SHA-256 of the cookie token; the raw token is never stored. */
    id: text().primaryKey(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: integer().notNull(),
    expiresAt: integer().notNull(),
    lastSeenAt: integer().notNull(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

export const cars = sqliteTable(
  'cars',
  {
    ...record(),
    name: text().notNull(),
    make: text(),
    model: text(),
    plate: text(),
    fuelType: text({ enum: FUEL_TYPES }).notNull(),
    tankSizeLiters: real().notNull(),
    startOdometerKm: real().notNull(),
    startDate: text().notNull(),
    color: text(),
    archived: integer({ mode: 'boolean' }).notNull().default(false),
  },
  (t) => [index('cars_rev_idx').on(t.rev)],
);

/** When a car has any rows here it is restricted to those users (admins always see it). */
export const carAccess = sqliteTable(
  'car_access',
  {
    carId: text()
      .notNull()
      .references(() => cars.id, { onDelete: 'cascade' }),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.carId, t.userId] })],
);

export const fillups = sqliteTable(
  'fillups',
  {
    ...record(),
    carId: text().notNull(),
    date: text().notNull(),
    tripKm: real().notNull(),
    liters: real().notNull(),
    totalCost: real().notNull(),
    fullTank: integer({ mode: 'boolean' }).notNull().default(true),
    missedPrevious: integer({ mode: 'boolean' }).notNull().default(false),
    fuelType: text({ enum: FUEL_TYPES }),
    station: text(),
    note: text(),
    receiptPhotoId: text(),
  },
  (t) => [index('fillups_rev_idx').on(t.rev), index('fillups_car_idx').on(t.carId, t.date)],
);

export const expenses = sqliteTable(
  'expenses',
  {
    ...record(),
    carId: text().notNull(),
    date: text().notNull(),
    category: text({ enum: EXPENSE_CATEGORIES }).notNull(),
    amount: real().notNull(),
    odometerKm: real(),
    note: text(),
    receiptPhotoId: text(),
  },
  (t) => [index('expenses_rev_idx').on(t.rev), index('expenses_car_idx').on(t.carId, t.date)],
);

export const odometerReadings = sqliteTable(
  'odometer_readings',
  {
    ...record(),
    carId: text().notNull(),
    date: text().notNull(),
    odometerKm: real().notNull(),
    source: text({ enum: ODOMETER_SOURCES }).notNull(),
  },
  (t) => [index('odometer_rev_idx').on(t.rev), index('odometer_car_idx').on(t.carId)],
);

export const reminders = sqliteTable(
  'reminders',
  {
    ...record(),
    carId: text().notNull(),
    type: text().notNull(),
    title: text().notNull(),
    everyKm: integer(),
    everyMonths: integer(),
    lastDoneKm: real(),
    lastDoneDate: text(),
    dueDate: text(),
  },
  (t) => [index('reminders_rev_idx').on(t.rev), index('reminders_car_idx').on(t.carId)],
);

export const budgets = sqliteTable(
  'budgets',
  {
    ...record(),
    /** null = household budget */
    carId: text(),
    monthlyAmount: real().notNull(),
  },
  (t) => [index('budgets_rev_idx').on(t.rev)],
);

export const photos = sqliteTable('photos', {
  ...record(),
  filename: text().notNull(),
  mimeType: text().notNull(),
  sizeBytes: integer().notNull(),
});

export const syncTables = {
  cars,
  fillups,
  expenses,
  odometerReadings,
  reminders,
  budgets,
} as const;
