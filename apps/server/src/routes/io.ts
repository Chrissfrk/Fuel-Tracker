import type { FastifyPluginAsync } from 'fastify';
import { eq, inArray, isNull, or } from 'drizzle-orm';
import { strToU8, zipSync } from 'fflate';
import { z } from 'zod';
import { SYNC_TABLES, recordSchemas, todayIso, type SyncTable } from '@fuel/shared';
import { HttpError, parse, requireAdmin, requireUser } from '../app';
import type { DB } from '../db/client';
import { nextRev } from '../db/client';
import { budgets, carAccess, syncTables, users } from '../db/schema';
import { visibleCarIds, writeRecord } from '../services/records';
import type { SessionUser } from '../auth/sessions';

export const BACKUP_FORMAT = 'fuel-tracker-backup';
export const BACKUP_VERSION = 1;

type Row = Record<string, unknown>;

function collect(db: DB, user: SessionUser, carId: string | null) {
  const visible = [...visibleCarIds(db, user)];
  const carIds = carId ? visible.filter((id) => id === carId) : visible;
  if (carId && carIds.length === 0) throw new HttpError(404, 'Car not found');
  const out = {} as Record<SyncTable, Row[]>;
  for (const name of SYNC_TABLES) {
    let rows: Row[];
    if (name === 'cars') {
      const t = syncTables.cars;
      rows = db.select().from(t).where(inArray(t.id, carIds)).all();
    } else if (name === 'budgets') {
      rows = db
        .select()
        .from(budgets)
        .where(
          carId
            ? eq(budgets.carId, carId)
            : or(isNull(budgets.carId), inArray(budgets.carId, carIds)),
        )
        .all();
    } else {
      const t = syncTables[name] as typeof syncTables.fillups;
      rows = db.select().from(t).where(inArray(t.carId, carIds)).all();
    }
    out[name] = rows.map(({ rev: _rev, ...r }) => r);
  }
  return out;
}

// ---------- CSV ----------

function csvCell(v: unknown): string {
  if (v == null) return '';
  const s = typeof v === 'boolean' ? (v ? 'true' : 'false') : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: Row[], columns: string[]): string {
  const lines = [columns.join(',')];
  for (const r of rows) lines.push(columns.map((c) => csvCell(r[c])).join(','));
  return '﻿' + lines.join('\r\n') + '\r\n';
}

const CSV_COLUMNS: Record<SyncTable, string[]> = {
  cars: [
    'id',
    'name',
    'make',
    'model',
    'plate',
    'fuelType',
    'tankSizeLiters',
    'startOdometerKm',
    'startDate',
    'color',
    'archived',
  ],
  fillups: [
    'id',
    'carId',
    'carName',
    'date',
    'tripKm',
    'liters',
    'totalCost',
    'pricePerLiter',
    'fullTank',
    'missedPrevious',
    'fuelType',
    'station',
    'note',
    'loggedBy',
  ],
  expenses: [
    'id',
    'carId',
    'carName',
    'date',
    'category',
    'amount',
    'odometerKm',
    'note',
    'loggedBy',
  ],
  odometerReadings: ['id', 'carId', 'carName', 'date', 'odometerKm', 'source', 'loggedBy'],
  reminders: [
    'id',
    'carId',
    'carName',
    'type',
    'title',
    'everyKm',
    'everyMonths',
    'lastDoneKm',
    'lastDoneDate',
    'dueDate',
  ],
  budgets: ['id', 'carId', 'carName', 'monthlyAmount'],
};

const CSV_FILES: Record<SyncTable, string> = {
  cars: 'cars.csv',
  fillups: 'fillups.csv',
  expenses: 'expenses.csv',
  odometerReadings: 'odometer-readings.csv',
  reminders: 'reminders.csv',
  budgets: 'budgets.csv',
};

// ---------- Import ----------

const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.number().int().max(BACKUP_VERSION),
  data: z.object(
    Object.fromEntries(
      SYNC_TABLES.map((t) => [t, z.array(z.record(z.string(), z.unknown())).default([])]),
    ) as Record<SyncTable, z.ZodDefault<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>>>>,
  ),
  users: z
    .array(
      z.object({
        id: z.string(),
        username: z.string(),
        displayName: z.string(),
        passwordHash: z.string(),
        role: z.enum(['admin', 'member']),
        active: z.boolean(),
        createdAt: z.number(),
        updatedAt: z.number(),
      }),
    )
    .default([]),
  carAccess: z.array(z.object({ carId: z.string(), userId: z.string() })).default([]),
});

export const ioRoutes: FastifyPluginAsync = async (app) => {
  const { db } = app;

  app.get<{ Querystring: { carId?: string } }>(
    '/export/json',
    { preHandler: requireUser },
    async (req, reply) => {
      const user = req.user!;
      const data = collect(db, user, req.query.carId ?? null);
      const isFull = user.role === 'admin' && !req.query.carId;
      const body = {
        format: BACKUP_FORMAT,
        version: BACKUP_VERSION,
        exportedAt: new Date().toISOString(),
        data,
        // Only a full admin export can restore accounts.
        users: isFull
          ? db
              .select()
              .from(users)
              .all()
              .map(({ rev: _r, defaultCarId: _d, deletedAt: _x, createdBy: _c, ...u }) => u)
          : [],
        carAccess: isFull ? db.select().from(carAccess).all() : [],
      };
      reply
        .header('Content-Type', 'application/json; charset=utf-8')
        .header('Content-Disposition', `attachment; filename="fuel-backup-${todayIso()}.json"`);
      return JSON.stringify(body);
    },
  );

  app.get<{ Querystring: { carId?: string } }>(
    '/export/csv',
    { preHandler: requireUser },
    async (req, reply) => {
      const data = collect(db, req.user!, req.query.carId ?? null);
      const carNames = new Map(data.cars.map((c) => [c.id as string, c.name as string]));
      const userNames = new Map(
        db
          .select()
          .from(users)
          .all()
          .map((u) => [u.id, u.displayName]),
      );
      const files: Record<string, Uint8Array> = {};
      for (const name of SYNC_TABLES) {
        const rows = data[name]
          .filter((r) => r.deletedAt == null)
          .map((r) => ({
            ...r,
            carName: r.carId
              ? (carNames.get(r.carId as string) ?? '')
              : name === 'budgets'
                ? 'Household'
                : '',
            loggedBy: userNames.get(r.createdBy as string) ?? '',
            pricePerLiter:
              name === 'fillups' && (r.liters as number) > 0
                ? Math.round(((r.totalCost as number) / (r.liters as number)) * 1000) / 1000
                : undefined,
          }));
        files[CSV_FILES[name]] = strToU8(toCsv(rows, CSV_COLUMNS[name]));
      }
      reply
        .header('Content-Type', 'application/zip')
        .header('Content-Disposition', `attachment; filename="fuel-export-${todayIso()}.zip"`);
      return Buffer.from(zipSync(files));
    },
  );

  app.post(
    '/import/json',
    { preHandler: requireAdmin, bodyLimit: 50 * 1024 * 1024 },
    async (req) => {
      const backup = parse(backupSchema, req.body);
      const counts: Record<string, { imported: number; skipped: number; invalid: number }> = {};
      const errors: string[] = [];

      db.$client.transaction(() => {
        let usersAdded = 0;
        for (const u of backup.users) {
          const clash = db
            .select()
            .from(users)
            .where(or(eq(users.id, u.id), eq(users.username, u.username)))
            .get();
          if (clash) continue;
          db.insert(users)
            .values({ ...u, createdBy: req.user!.id, rev: nextRev(db) })
            .run();
          usersAdded++;
        }
        counts.users = {
          imported: usersAdded,
          skipped: backup.users.length - usersAdded,
          invalid: 0,
        };

        for (const name of SYNC_TABLES) {
          const c = (counts[name] = { imported: 0, skipped: 0, invalid: 0 });
          const t = syncTables[name] as typeof syncTables.cars;
          for (const raw of backup.data[name]) {
            const parsed = recordSchemas[name].safeParse(raw);
            if (!parsed.success) {
              c.invalid++;
              if (errors.length < 20)
                errors.push(`${name} ${String(raw.id)}: ${z.prettifyError(parsed.error)}`);
              continue;
            }
            const existing = db
              .select({ updatedAt: t.updatedAt })
              .from(t)
              .where(eq(t.id, parsed.data.id))
              .get();
            // Restores merge: a newer version already on the server wins.
            if (existing && existing.updatedAt >= parsed.data.updatedAt) {
              c.skipped++;
              continue;
            }
            writeRecord(db, name, parsed.data);
            c.imported++;
          }
        }
        const knownCars = new Set(
          db
            .select({ id: syncTables.cars.id })
            .from(syncTables.cars)
            .all()
            .map((r) => r.id),
        );
        const knownUsers = new Set(
          db
            .select({ id: users.id })
            .from(users)
            .all()
            .map((r) => r.id),
        );
        for (const a of backup.carAccess) {
          if (knownCars.has(a.carId) && knownUsers.has(a.userId)) {
            db.insert(carAccess).values(a).onConflictDoNothing().run();
          }
        }
      })();
      return { counts, errors };
    },
  );
};
