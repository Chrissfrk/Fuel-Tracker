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

let app: App;
let cleanup: () => Promise<void>;
let admin: Client;
let maria: Client;

beforeEach(async () => {
  ({ app, cleanup } = await makeApp());
  admin = await setupAdmin(app);
  maria = await createMember(admin, app);
});
afterEach(() => cleanup());

const pull = async (c: Client, since = 0) => (await c.get(`/api/sync?since=${since}`)).json();

describe('push / pull', () => {
  it('stores records and returns them on pull with server-owned createdBy', async () => {
    const car = carRecord();
    const fill = fillupRecord(car.id);
    const results = await push(maria, op('cars', car), op('fillups', fill));
    expect(results.map((r) => r.status)).toEqual(['applied', 'applied']);

    const data = await pull(admin);
    expect(data.changes.cars).toHaveLength(1);
    expect(data.changes.fillups[0]).toMatchObject({
      id: fill.id,
      createdBy: maria.user.id,
      liters: 40,
    });
    expect(data.changes.fillups[0].rev).toBeUndefined();
    expect(data.users.map((u: { displayName: string }) => u.displayName).sort()).toEqual([
      'Maria',
      'Nikos',
    ]);
  });

  it('returns only changes after the cursor', async () => {
    const car = carRecord();
    await push(admin, op('cars', car));
    const first = await pull(admin);
    const fill = fillupRecord(car.id);
    await push(admin, op('fillups', fill));
    const second = await pull(admin, first.rev);
    expect(second.changes.cars).toHaveLength(0);
    expect(second.changes.fillups.map((f: { id: string }) => f.id)).toEqual([fill.id]);
    expect(second.rev).toBeGreaterThan(first.rev);
  });

  it('propagates soft deletes', async () => {
    const car = carRecord();
    const fill = fillupRecord(car.id);
    await push(admin, op('cars', car), op('fillups', fill));
    const { rev } = await pull(admin);
    await push(
      admin,
      op('fillups', { ...fill, deletedAt: Date.now(), updatedAt: fill.updatedAt + 1 }),
    );
    const after = await pull(admin, rev);
    expect(after.changes.fillups[0].deletedAt).not.toBeNull();
  });

  it('applies last write wins on updatedAt', async () => {
    const car = carRecord();
    const fill = fillupRecord(car.id);
    await push(admin, op('cars', car), op('fillups', fill));
    const newer = { ...fill, liters: 41, updatedAt: fill.updatedAt + 10 };
    const older = { ...fill, liters: 39, updatedAt: fill.updatedAt + 5 };
    expect((await push(admin, op('fillups', newer)))[0]!.status).toBe('applied');
    expect((await push(admin, op('fillups', older)))[0]!.status).toBe('stale');
    expect((await push(admin, op('fillups', newer)))[0]!.status).toBe('applied'); // idempotent replay
    const data = await pull(admin);
    expect(data.changes.fillups[0].liters).toBe(41);
  });

  it('keeps the original createdBy and createdAt on update', async () => {
    const car = carRecord();
    const fill = fillupRecord(car.id);
    await push(maria, op('cars', car), op('fillups', fill));
    await push(
      admin,
      op('fillups', {
        ...fill,
        createdBy: admin.user.id,
        createdAt: 1,
        updatedAt: fill.updatedAt + 1,
      }),
    );
    const row = (await pull(admin)).changes.fillups[0];
    expect(row.createdBy).toBe(maria.user.id);
    expect(row.createdAt).toBe(fill.createdAt);
  });

  it('clamps far-future client timestamps', async () => {
    const car = carRecord({ updatedAt: Date.now() + 10 * 24 * 3600 * 1000 });
    await push(admin, op('cars', car));
    const row = (await pull(admin)).changes.cars[0];
    expect(row.updatedAt).toBeLessThan(Date.now() + 120_000);
  });

  it('rejects invalid records with a reason, but applies the rest', async () => {
    const car = carRecord();
    const bad = fillupRecord(car.id, { liters: -5 });
    const results = await push(admin, op('cars', car), op('fillups', bad));
    expect(results[0]!.status).toBe('applied');
    expect(results[1]!.status).toBe('rejected');
    expect(results[1]!.error).toMatch(/liters/i);
  });

  it('rejects records for cars that do not exist', async () => {
    const results = await push(
      admin,
      op('fillups', fillupRecord('00000000-0000-4000-8000-00000000dead')),
    );
    expect(results[0]!.status).toBe('rejected');
  });

  it('requires login', async () => {
    expect((await app.inject('/api/sync')).statusCode).toBe(401);
    expect(
      (await app.inject({ method: 'POST', url: '/api/sync/push', payload: { ops: [] } }))
        .statusCode,
    ).toBe(401);
  });
});

describe('permissions', () => {
  it('stops members editing or deleting records others logged', async () => {
    const car = carRecord();
    const fill = fillupRecord(car.id);
    await push(admin, op('cars', car), op('fillups', fill));
    const edit = await push(
      maria,
      op('fillups', { ...fill, liters: 1, updatedAt: fill.updatedAt + 1 }),
    );
    expect(edit[0]!.status).toBe('rejected');
    const del = await push(
      maria,
      op('fillups', { ...fill, deletedAt: Date.now(), updatedAt: fill.updatedAt + 1 }),
    );
    expect(del[0]!.status).toBe('rejected');
  });

  it('lets members edit their own records and admins edit anything', async () => {
    const car = carRecord();
    const mine = fillupRecord(car.id);
    await push(admin, op('cars', car));
    await push(maria, op('fillups', mine));
    expect(
      (await push(maria, op('fillups', { ...mine, liters: 42, updatedAt: mine.updatedAt + 1 })))[0]!
        .status,
    ).toBe('applied');
    expect(
      (await push(admin, op('fillups', { ...mine, liters: 43, updatedAt: mine.updatedAt + 2 })))[0]!
        .status,
    ).toBe('applied');
  });

  it('lets members add and edit cars and reminders, but not delete cars or set budgets', async () => {
    const car = carRecord();
    expect((await push(maria, op('cars', car)))[0]!.status).toBe('applied');
    expect(
      (
        await push(maria, op('cars', { ...car, name: 'Polo GTI', updatedAt: car.updatedAt + 1 }))
      )[0]!.status,
    ).toBe('applied');
    expect(
      (
        await push(
          maria,
          op('cars', { ...car, deletedAt: Date.now(), updatedAt: car.updatedAt + 2 }),
        )
      )[0]!.status,
    ).toBe('rejected');
    const t = Date.now();
    const reminder = {
      id: crypto.randomUUID(),
      createdAt: t,
      updatedAt: t,
      deletedAt: null,
      createdBy: 'x',
      carId: car.id,
      type: 'oil',
      title: 'Oil',
      everyKm: 10000,
      everyMonths: null,
      lastDoneKm: null,
      lastDoneDate: null,
      dueDate: null,
    };
    expect((await push(maria, op('reminders', reminder)))[0]!.status).toBe('applied');
    const budget = {
      id: crypto.randomUUID(),
      createdAt: t,
      updatedAt: t,
      deletedAt: null,
      createdBy: 'x',
      carId: null,
      monthlyAmount: 200,
    };
    expect((await push(maria, op('budgets', budget)))[0]!.status).toBe('rejected');
    expect((await push(admin, op('budgets', budget)))[0]!.status).toBe('applied');
  });

  it('hides restricted cars and their records from members without access', async () => {
    const shared = carRecord({ name: 'Shared' });
    const priv = carRecord({ name: 'Private' });
    const privFill = fillupRecord(priv.id);
    await push(admin, op('cars', shared), op('cars', priv), op('fillups', privFill));

    const res = await admin.put(`/api/cars/${priv.id}/access`, { userIds: [admin.user.id] });
    expect(res.json().userIds).toEqual([admin.user.id]);

    const mariaView = await pull(maria);
    expect(mariaView.carIds).toEqual([shared.id]);
    expect(mariaView.changes.cars.map((c: { name: string }) => c.name)).toEqual(['Shared']);
    expect(mariaView.changes.fillups).toHaveLength(0);
    expect((await push(maria, op('fillups', fillupRecord(priv.id))))[0]!.status).toBe('rejected');
    expect(
      (
        await push(maria, op('cars', { ...priv, name: 'Mine now', updatedAt: priv.updatedAt + 1 }))
      )[0]!.status,
    ).toBe('rejected');

    // Granting access makes it visible again.
    await admin.put(`/api/cars/${priv.id}/access`, { userIds: [admin.user.id, maria.user.id] });
    expect((await pull(maria)).carIds.sort()).toEqual([shared.id, priv.id].sort());
    expect((await admin.get(`/api/cars/${priv.id}/access`)).json().userIds).toHaveLength(2);
  });

  it('keeps car access management admin-only', async () => {
    const car = carRecord();
    await push(admin, op('cars', car));
    expect((await maria.put(`/api/cars/${car.id}/access`, { userIds: [] })).statusCode).toBe(403);
  });
});
