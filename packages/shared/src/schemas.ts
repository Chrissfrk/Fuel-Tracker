import { z } from 'zod';

export const FUEL_TYPES = ['95', '100', 'diesel', 'lpg', 'other'] as const;
export const EXPENSE_CATEGORIES = [
  'service',
  'tires',
  'insurance',
  'road_tax',
  'kteo',
  'tolls',
  'parking',
  'wash',
  'repair',
  'other',
] as const;
export const ROLES = ['admin', 'member'] as const;
export const ODOMETER_SOURCES = ['manual', 'expense'] as const;

export const fuelTypeSchema = z.enum(FUEL_TYPES);
export const expenseCategorySchema = z.enum(EXPENSE_CATEGORIES);
export const roleSchema = z.enum(ROLES);

export type FuelType = z.infer<typeof fuelTypeSchema>;
export type ExpenseCategory = z.infer<typeof expenseCategorySchema>;
export type Role = z.infer<typeof roleSchema>;

/** Calendar date as `YYYY-MM-DD` (no time, no timezone). */
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .refine((s) => {
    const [y, m, d] = s.split('-').map(Number) as [number, number, number];
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  }, 'Invalid date');

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((s) => (s === '' ? null : s));

const timestamp = z.number().int().nonnegative();

/** Fields every synced record carries. */
export const baseRecordSchema = z.object({
  id: z.uuid(),
  createdAt: timestamp,
  updatedAt: timestamp,
  deletedAt: timestamp.nullable(),
  createdBy: z.string(),
});
export type BaseRecord = z.infer<typeof baseRecordSchema>;

export const carSchema = baseRecordSchema.extend({
  name: z.string().trim().min(1, 'Give the car a name').max(60),
  make: optionalText(60),
  model: optionalText(60),
  plate: optionalText(20),
  fuelType: fuelTypeSchema,
  tankSizeLiters: z.number().positive('Tank size must be above 0').max(500),
  startOdometerKm: z.number().min(0).max(5_000_000),
  startDate: isoDateSchema,
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable(),
  archived: z.boolean(),
});
export type Car = z.infer<typeof carSchema>;

export const fillupSchema = baseRecordSchema.extend({
  carId: z.uuid(),
  date: isoDateSchema,
  tripKm: z.number().min(0).max(10_000),
  liters: z.number().positive('Liters must be above 0').max(2_000),
  totalCost: z.number().min(0).max(100_000),
  fullTank: z.boolean(),
  missedPrevious: z.boolean(),
  fuelType: fuelTypeSchema.nullable(),
  station: optionalText(80),
  note: optionalText(500),
  receiptPhotoId: z.uuid().nullable(),
});
export type Fillup = z.infer<typeof fillupSchema>;

export const expenseSchema = baseRecordSchema.extend({
  carId: z.uuid(),
  date: isoDateSchema,
  category: expenseCategorySchema,
  amount: z.number().positive('Amount must be above 0').max(1_000_000),
  odometerKm: z.number().min(0).max(5_000_000).nullable(),
  note: optionalText(500),
  receiptPhotoId: z.uuid().nullable(),
});
export type Expense = z.infer<typeof expenseSchema>;

export const odometerReadingSchema = baseRecordSchema.extend({
  carId: z.uuid(),
  date: isoDateSchema,
  odometerKm: z.number().min(0).max(5_000_000),
  source: z.enum(ODOMETER_SOURCES),
});
export type OdometerReading = z.infer<typeof odometerReadingSchema>;

export const reminderSchema = baseRecordSchema
  .extend({
    carId: z.uuid(),
    type: z.string().min(1).max(40),
    title: z.string().trim().min(1, 'Give the reminder a title').max(80),
    everyKm: z.number().int().positive().max(1_000_000).nullable(),
    everyMonths: z.number().int().positive().max(240).nullable(),
    lastDoneKm: z.number().min(0).max(5_000_000).nullable(),
    lastDoneDate: isoDateSchema.nullable(),
    dueDate: isoDateSchema.nullable(),
  })
  .refine((r) => r.everyKm != null || r.everyMonths != null || r.dueDate != null, {
    message: 'Set a km interval, a month interval or a due date',
    path: ['everyKm'],
  });
export type Reminder = z.infer<typeof reminderSchema>;

export const budgetSchema = baseRecordSchema.extend({
  carId: z.uuid().nullable(),
  monthlyAmount: z.number().positive().max(1_000_000),
});
export type Budget = z.infer<typeof budgetSchema>;

export const photoSchema = baseRecordSchema.extend({
  filename: z.string().max(200),
  mimeType: z.enum(['image/jpeg', 'image/webp', 'image/png']),
  sizeBytes: z.number().int().positive(),
});
export type Photo = z.infer<typeof photoSchema>;

/** Every table the offline sync engine knows about. Photos upload separately (online only). */
export const SYNC_TABLES = [
  'cars',
  'fillups',
  'expenses',
  'odometerReadings',
  'reminders',
  'budgets',
] as const;
export type SyncTable = (typeof SYNC_TABLES)[number];

export const recordSchemas = {
  cars: carSchema,
  fillups: fillupSchema,
  expenses: expenseSchema,
  odometerReadings: odometerReadingSchema,
  reminders: reminderSchema,
  budgets: budgetSchema,
} as const satisfies Record<SyncTable, z.ZodType>;

export interface SyncRecordMap {
  cars: Car;
  fillups: Fillup;
  expenses: Expense;
  odometerReadings: OdometerReading;
  reminders: Reminder;
  budgets: Budget;
}

// ---------- Users & auth ----------

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{3,32}$/, '3–32 characters: letters, numbers, dot, dash or underscore');
export const passwordSchema = z.string().min(8, 'At least 8 characters').max(200);
export const displayNameSchema = z.string().trim().min(1, 'Enter a name').max(40);

export const publicUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  displayName: z.string(),
  role: roleSchema,
  active: z.boolean(),
});
export type PublicUser = z.infer<typeof publicUserSchema>;

export const meSchema = publicUserSchema.extend({ defaultCarId: z.string().nullable() });
export type Me = z.infer<typeof meSchema>;

export const setupSchema = z.object({
  username: usernameSchema,
  displayName: displayNameSchema,
  password: passwordSchema,
});
export const loginSchema = z.object({
  username: z.string().trim().toLowerCase().min(1),
  password: z.string().min(1),
});
export const createUserSchema = z.object({
  username: usernameSchema,
  displayName: displayNameSchema,
  password: passwordSchema,
  role: roleSchema,
});
export const updateUserSchema = z.object({
  displayName: displayNameSchema.optional(),
  role: roleSchema.optional(),
  active: z.boolean().optional(),
});
export const resetPasswordSchema = z.object({ password: passwordSchema });
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});
export const updateMeSchema = z.object({
  displayName: displayNameSchema.optional(),
  defaultCarId: z.uuid().nullable().optional(),
});
export const carAccessSchema = z.object({ userIds: z.array(z.string()).max(100) });

// ---------- Sync ----------

export const pushOpSchema = z.object({
  opId: z.string().min(1).max(64),
  table: z.enum(SYNC_TABLES),
  record: z.record(z.string(), z.unknown()),
});
export type PushOp = z.infer<typeof pushOpSchema>;

export const pushRequestSchema = z.object({ ops: z.array(pushOpSchema).max(500) });

export interface PushResult {
  opId: string;
  status: 'applied' | 'stale' | 'rejected';
  error?: string;
}

export interface SyncChanges {
  cars: Car[];
  fillups: Fillup[];
  expenses: Expense[];
  odometerReadings: OdometerReading[];
  reminders: Reminder[];
  budgets: Budget[];
}

export interface SyncPullResponse {
  rev: number;
  /** Cars this user may currently see; the client drops anything else. */
  carIds: string[];
  users: PublicUser[];
  changes: SyncChanges;
}

export interface HealthResponse {
  status: 'ok';
  version: string;
}

export interface SessionResponse {
  needsSetup: boolean;
  user: Me | null;
}
