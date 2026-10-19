/**
 * Demo household: 2 users, 2 cars, 12 months of fill-ups (with partial fills and one missed
 * fill-up), expenses, odometer readings, reminders and budgets.
 *
 *   npm run seed            → refuses if the database already has users
 *   SEED_FORCE=1 npm run seed → wipes all data first
 */
import path from 'node:path';
import { sql } from 'drizzle-orm';
import { addDaysIso, addMonthsIso, newId, todayIso, type SyncTable } from '@fuel/shared';
import { openDatabase, nextRev, type DB } from './db/client';
import { SERVER_ROOT, resolveDataDir } from './env';
import { users } from './db/schema';
import { hashPassword } from './auth/password';
import { writeRecord } from './services/records';

const DEMO_PASSWORD = 'demo1234';

/** Deterministic PRNG so the demo looks the same every time. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261019);
const between = (a: number, b: number) => a + (b - a) * rand();
const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)]!;
const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;

let clock = Date.now() - 400 * 86400_000;
function base(createdBy: string, date?: string) {
  // createdAt follows the record's date so ordering within a day is realistic.
  clock = date
    ? Math.max(clock + 1, new Date(`${date}T12:00:00`).getTime() + Math.floor(rand() * 3600_000))
    : clock + 1;
  return { id: newId(), createdAt: clock, updatedAt: clock, deletedAt: null, createdBy };
}

const put = (db: DB, table: SyncTable, rec: Record<string, unknown>) => writeRecord(db, table, rec);

/** Summer A/C makes consumption ~10 % worse; winter cold a little worse too. */
function seasonFactor(date: string) {
  const m = Number(date.slice(5, 7));
  if (m >= 6 && m <= 9) return 1.1;
  if (m === 12 || m <= 2) return 1.04;
  return 1;
}

interface CarPlan {
  carId: string;
  baseL100: number;
  basePrice: number;
  tripRange: [number, number];
  gapDays: [number, number];
  stations: readonly string[];
  drivers: readonly string[];
  missedOnIndex: number | null;
}

function seedFillups(db: DB, plan: CarPlan, from: string, to: string) {
  let date = from;
  let deficit = 0; // liters a partial fill left un-topped
  let i = 0;
  while (date <= to) {
    const trip = Math.round(between(...plan.tripRange));
    const l100 = plan.baseL100 * seasonFactor(date) * between(0.94, 1.06);
    const used = (trip * l100) / 100;
    const month = Number(date.slice(5, 7));
    const price = plan.basePrice * (month >= 5 && month <= 8 ? 1.05 : 1) * between(0.97, 1.03);
    const partial = i % 7 === 5;
    const missed = plan.missedOnIndex === i;

    if (missed) {
      // This fill-up happened but was never logged; the next one is flagged.
      deficit = 0;
    } else {
      let liters: number;
      if (partial) {
        liters = used * between(0.4, 0.6);
        deficit += used - liters;
      } else {
        liters = used + deficit;
        deficit = 0;
      }
      liters = round(liters, 2);
      put(db, 'fillups', {
        ...base(pick(plan.drivers), date),
        carId: plan.carId,
        date,
        tripKm: trip,
        liters,
        totalCost: round(liters * price, 2),
        fullTank: !partial,
        missedPrevious: plan.missedOnIndex != null && i === plan.missedOnIndex + 1,
        fuelType: null,
        station: pick(plan.stations),
        note: partial ? 'Quick top-up' : null,
        receiptPhotoId: null,
      });
    }
    i++;
    date = addDaysIso(date, Math.round(between(...plan.gapDays)));
  }
}

async function main() {
  const dataDir = resolveDataDir();
  const db = openDatabase(path.join(dataDir, 'app.db'), path.join(SERVER_ROOT, 'drizzle'));
  const existing = db.select().from(users).all();
  if (existing.length > 0) {
    if (process.env.SEED_FORCE !== '1') {
      console.error('The database already has users. Run with SEED_FORCE=1 to wipe it and reseed.');
      process.exit(1);
    }
    for (const t of [
      'car_access',
      'sessions',
      'fillups',
      'expenses',
      'odometer_readings',
      'reminders',
      'budgets',
      'photos',
      'cars',
      'users',
    ]) {
      db.run(sql.raw(`DELETE FROM ${t}`));
    }
  }

  const today = todayIso();
  const start = addMonthsIso(today, -12);
  const hash = await hashPassword(DEMO_PASSWORD);
  const now = Date.now();
  const nikos = newId();
  const maria = newId();
  db.$client.transaction(() => {
    db.insert(users)
      .values([
        {
          id: nikos,
          username: 'nikos',
          displayName: 'Nikos',
          passwordHash: hash,
          role: 'admin',
          active: true,
          createdAt: now,
          updatedAt: now,
          createdBy: nikos,
          rev: nextRev(db),
        },
        {
          id: maria,
          username: 'maria',
          displayName: 'Maria',
          passwordHash: hash,
          role: 'member',
          active: true,
          createdAt: now,
          updatedAt: now,
          createdBy: nikos,
          rev: nextRev(db),
        },
      ])
      .run();

    const polo = newId();
    const octavia = newId();
    put(db, 'cars', {
      ...base(nikos),
      id: polo,
      name: 'Polo',
      make: 'Volkswagen',
      model: 'Polo 1.0 TSI',
      plate: 'ΙΚΒ-4821',
      fuelType: '95',
      tankSizeLiters: 40,
      startOdometerKm: 62140,
      startDate: start,
      color: '#2a78d6',
      archived: false,
    });
    put(db, 'cars', {
      ...base(nikos),
      id: octavia,
      name: 'Octavia',
      make: 'Škoda',
      model: 'Octavia Combi 2.0 TDI',
      plate: 'ΥΖΗ-1093',
      fuelType: 'diesel',
      tankSizeLiters: 50,
      startOdometerKm: 118400,
      startDate: start,
      color: '#eb6834',
      archived: false,
    });

    const stations = [
      'Shell Kifisias',
      'BP Marousi',
      'EKO Chalandri',
      'Avin Vrilissia',
      'Aegean Kifisias',
      'Revoil Halandri',
    ];
    seedFillups(
      db,
      {
        carId: polo,
        baseL100: 6.1,
        basePrice: 1.86,
        tripRange: [330, 470],
        gapDays: [7, 13],
        stations,
        drivers: [maria, maria, nikos],
        missedOnIndex: 17,
      },
      addDaysIso(start, 2),
      today,
    );
    seedFillups(
      db,
      {
        carId: octavia,
        baseL100: 5.3,
        basePrice: 1.58,
        tripRange: [650, 860],
        gapDays: [11, 18],
        stations,
        drivers: [nikos, nikos, maria],
        missedOnIndex: null,
      },
      addDaysIso(start, 4),
      today,
    );

    const e = (
      carId: string,
      date: string,
      category: string,
      amount: number,
      by: string,
      extra: Record<string, unknown> = {},
    ) =>
      put(db, 'expenses', {
        ...base(by, date),
        carId,
        date,
        category,
        amount,
        odometerKm: null,
        note: null,
        receiptPhotoId: null,
        ...extra,
      });

    // Yearly bills
    e(polo, addDaysIso(start, 20), 'insurance', 285, nikos, { note: 'Interamerican, 12 months' });
    e(octavia, addDaysIso(start, 45), 'insurance', 342, nikos, { note: 'Ethniki, 12 months' });
    const feb = `${Number(today.slice(0, 4)) - (today.slice(5, 7) >= '03' ? 0 : 1)}-02-20`;
    e(polo, feb, 'road_tax', 120, nikos, { note: 'Τέλη κυκλοφορίας' });
    e(octavia, feb, 'road_tax', 210, nikos, { note: 'Τέλη κυκλοφορίας' });
    e(octavia, addMonthsIso(start, 5), 'kteo', 55, nikos, { note: 'Passed, no remarks' });
    // Service & repairs (with odometer readings that correct the estimate)
    e(polo, addMonthsIso(start, 3), 'service', 189, nikos, {
      odometerKm: 66120,
      note: 'Oil & filter, cabin filter',
    });
    e(octavia, addMonthsIso(start, 7), 'service', 265, nikos, {
      odometerKm: 132800,
      note: '30k service',
    });
    e(octavia, addMonthsIso(start, 9), 'tires', 480, nikos, { note: '4 × Michelin Primacy 4' });
    e(polo, addMonthsIso(start, 10), 'repair', 145, maria, { note: 'Rear brake pads' });
    // Monthly small stuff
    for (let m = 0; m < 12; m++) {
      const d = addMonthsIso(start, m);
      e(octavia, addDaysIso(d, 6), 'tolls', round(between(18, 34), 2), nikos, {
        note: 'Attiki Odos',
      });
      if (m % 2 === 0) e(polo, addDaysIso(d, 12), 'wash', 12, maria);
      if (m % 3 === 1)
        e(polo, addDaysIso(d, 15), 'parking', round(between(6, 15), 2), maria, {
          note: 'Syntagma',
        });
    }

    put(db, 'odometerReadings', {
      ...base(maria, addMonthsIso(start, 8)),
      carId: polo,
      date: addMonthsIso(start, 8),
      odometerKm: 72900,
      source: 'manual',
    });

    const r = (carId: string, over: Record<string, unknown>) =>
      put(db, 'reminders', {
        ...base(nikos),
        carId,
        everyKm: null,
        everyMonths: null,
        lastDoneKm: null,
        lastDoneDate: null,
        dueDate: null,
        ...over,
      });
    r(polo, {
      type: 'oil',
      title: 'Oil & filter change',
      everyKm: 10000,
      everyMonths: 12,
      lastDoneKm: 66120,
      lastDoneDate: addMonthsIso(start, 3),
    });
    r(polo, {
      type: 'insurance',
      title: 'Insurance renewal',
      everyMonths: 12,
      dueDate: addDaysIso(addMonthsIso(start, 12), 20),
    });
    r(polo, { type: 'kteo', title: 'KTEO', everyMonths: 24, dueDate: addMonthsIso(today, 7) });
    r(octavia, {
      type: 'oil',
      title: 'Oil & filter change',
      everyKm: 15000,
      everyMonths: 12,
      lastDoneKm: 132800,
      lastDoneDate: addMonthsIso(start, 7),
    });
    r(octavia, {
      type: 'brakes',
      title: 'Brake check',
      everyKm: 20000,
      everyMonths: 12,
      lastDoneKm: 112000,
      lastDoneDate: addMonthsIso(start, -2),
    });
    r(octavia, {
      type: 'road_tax',
      title: 'Road tax (τέλη κυκλοφορίας)',
      everyMonths: 12,
      dueDate: `${Number(feb.slice(0, 4)) + 1}-02-28`,
    });
    r(octavia, { type: 'timing_belt', title: 'Timing belt', everyKm: 120000, lastDoneKm: 60000 });

    put(db, 'budgets', { ...base(nikos), carId: null, monthlyAmount: 450 });
    put(db, 'budgets', { ...base(nikos), carId: polo, monthlyAmount: 160 });
  })();

  db.$client.close();
  console.log(`Seeded demo household into ${dataDir}/app.db`);
  console.log(`  admin  → nikos / ${DEMO_PASSWORD}`);
  console.log(`  member → maria / ${DEMO_PASSWORD}`);
}

await main();
