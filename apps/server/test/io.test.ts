import fs from 'node:fs';
import path from 'node:path';
import { unzipSync, strFromU8 } from 'fflate';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  carRecord,
  createMember,
  fillupRecord,
  makeApp,
  op,
  push,
  setupAdmin,
  type Client,
} from './helpers';
import type { App } from '../src/app';
import { pruneBackups, runBackup } from '../src/backup';
import { toCsv } from '../src/routes/io';

let app: App;
let dataDir: string;
let cleanup: () => Promise<void>;
let admin: Client;

beforeEach(async () => {
  ({ app, dataDir, cleanup } = await makeApp());
  admin = await setupAdmin(app);
});
afterEach(() => cleanup());

// Smallest valid JPEG header + filler.
const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(100, 1)]);

describe('photos', () => {
  it('uploads with a client id and serves it back', async () => {
    const id = crypto.randomUUID();
    const up = await app.inject({
      method: 'PUT',
      url: `/api/photos/${id}`,
      headers: { cookie: admin.cookie, 'content-type': 'image/jpeg' },
      payload: jpeg,
    });
    expect(up.statusCode).toBe(201);
    const again = await app.inject({
      method: 'PUT',
      url: `/api/photos/${id}`,
      headers: { cookie: admin.cookie, 'content-type': 'image/jpeg' },
      payload: jpeg,
    });
    expect(again.statusCode).toBe(200); // idempotent retry
    const get = await admin.get(`/api/photos/${id}`);
    expect(get.statusCode).toBe(200);
    expect(get.headers['content-type']).toBe('image/jpeg');
    expect(get.rawPayload.length).toBe(jpeg.length);
    expect(fs.readdirSync(path.join(dataDir, 'uploads'))).toEqual([`${id}.jpg`]);
  });

  it('rejects files that are not images and oversized uploads', async () => {
    const id = crypto.randomUUID();
    const fake = await app.inject({
      method: 'PUT',
      url: `/api/photos/${id}`,
      headers: { cookie: admin.cookie, 'content-type': 'image/png' },
      payload: Buffer.from('not a png at all'),
    });
    expect(fake.statusCode).toBe(415);
    const big = await app.inject({
      method: 'PUT',
      url: `/api/photos/${id}`,
      headers: { cookie: admin.cookie, 'content-type': 'image/jpeg' },
      payload: Buffer.concat([jpeg, Buffer.alloc(9 * 1024 * 1024)]),
    });
    expect(big.statusCode).toBe(413);
  });

  it('requires login to view', async () => {
    expect((await app.inject(`/api/photos/${crypto.randomUUID()}`)).statusCode).toBe(401);
  });
});

describe('export / import', () => {
  it('exports CSV as a zip with one file per record type', async () => {
    const car = carRecord({ name: 'Polo, "red"' });
    await push(
      admin,
      op('cars', car),
      op('fillups', fillupRecord(car.id, { liters: 40, totalCost: 70 })),
    );
    const res = await admin.get('/api/export/csv');
    expect(res.headers['content-type']).toBe('application/zip');
    const files = unzipSync(new Uint8Array(res.rawPayload));
    expect(Object.keys(files).sort()).toEqual([
      'budgets.csv',
      'cars.csv',
      'expenses.csv',
      'fillups.csv',
      'odometer-readings.csv',
      'reminders.csv',
    ]);
    const fills = strFromU8(files['fillups.csv']!);
    expect(fills).toContain('pricePerLiter');
    expect(fills).toContain('1.75');
    expect(fills).toContain('Nikos');
    expect(strFromU8(files['cars.csv']!)).toContain('"Polo, ""red"""');
  });

  it('round-trips a JSON backup into an empty server', async () => {
    const maria = await createMember(admin, app);
    const car = carRecord();
    const fill = fillupRecord(car.id);
    await push(maria, op('cars', car), op('fillups', fill));
    const backup = (await admin.get('/api/export/json')).json();
    expect(backup.users).toHaveLength(2);
    expect(backup.data.fillups).toHaveLength(1);

    const fresh = await makeApp();
    try {
      const freshAdmin = await setupAdmin(fresh.app);
      const res = await freshAdmin.post('/api/import/json', backup);
      expect(res.statusCode).toBe(200);
      const { counts } = res.json();
      expect(counts.fillups.imported).toBe(1);
      expect(counts.users.imported).toBe(1); // admin username already exists
      const pulled = (await freshAdmin.get('/api/sync')).json();
      expect(pulled.changes.fillups[0]).toMatchObject({ id: fill.id, createdBy: maria.user.id });

      const again = (await freshAdmin.post('/api/import/json', backup)).json();
      expect(again.counts.fillups.skipped).toBe(1);
    } finally {
      await fresh.cleanup();
    }
  });

  it('limits a member export to visible cars and omits accounts', async () => {
    const maria = await createMember(admin, app);
    const car = carRecord();
    await push(admin, op('cars', car));
    const backup = (await maria.get('/api/export/json')).json();
    expect(backup.users).toEqual([]);
    expect(backup.data.cars).toHaveLength(1);
    expect((await maria.post('/api/import/json', backup)).statusCode).toBe(403);
  });

  it('exports a single car', async () => {
    const a = carRecord({ name: 'A' });
    const b = carRecord({ name: 'B' });
    await push(admin, op('cars', a), op('cars', b), op('fillups', fillupRecord(b.id)));
    const one = (await admin.get(`/api/export/json?carId=${b.id}`)).json();
    expect(one.data.cars.map((c: { name: string }) => c.name)).toEqual(['B']);
    expect(one.data.fillups).toHaveLength(1);
  });

  it('rejects a file that is not a backup', async () => {
    expect((await admin.post('/api/import/json', { hello: 'world' })).statusCode).toBe(400);
  });

  it('escapes CSV cells', () => {
    expect(toCsv([{ a: 'x,y', b: 'say "hi"', c: null, d: true }], ['a', 'b', 'c', 'd'])).toBe(
      '﻿a,b,c,d\r\n"x,y","say ""hi""",,true\r\n',
    );
  });
});

describe('backups', () => {
  it('writes a dated SQLite backup and keeps the last 14', async () => {
    const dir = path.join(dataDir, 'backups');
    for (let d = 1; d <= 16; d++)
      fs.writeFileSync(path.join(dir, `app-2026-01-${String(d).padStart(2, '0')}.db`), '');
    fs.writeFileSync(path.join(dir, 'notes.txt'), '');
    const file = await runBackup(app.db, dir, new Date(2026, 1, 1));
    expect(path.basename(file)).toBe('app-2026-02-01.db');
    expect(fs.statSync(file).size).toBeGreaterThan(0);
    const left = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.db'))
      .sort();
    expect(left).toHaveLength(14);
    expect(left[0]).toBe('app-2026-01-04.db');
    expect(fs.existsSync(path.join(dir, 'notes.txt'))).toBe(true);
    expect(pruneBackups(dir)).toEqual([]);
  });

  it('exposes manual backups to admins only', async () => {
    const maria = await createMember(admin, app);
    expect((await admin.post('/api/admin/backups')).statusCode).toBe(200);
    expect((await admin.get('/api/admin/backups')).json()).toHaveLength(1);
    expect((await maria.post('/api/admin/backups')).statusCode).toBe(403);
  });
});
