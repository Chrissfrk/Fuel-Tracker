import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildApp, type App } from '../src/app';
import { loadConfig } from '../src/env';
import { newId, todayIso } from '@fuel/shared';

export async function makeApp(): Promise<{
  app: App;
  dataDir: string;
  cleanup: () => Promise<void>;
}> {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fuel-test-'));
  const config = loadConfig({
    SESSION_SECRET: 'test-secret-test-secret-test-secret-1234',
    DATA_DIR: dataDir,
    WEB_DIST: path.join(dataDir, 'no-web'),
    COOKIE_SECURE: 'false',
    LOG_LEVEL: 'silent',
  });
  const app = await buildApp(config, { logger: false });
  return {
    app,
    dataDir,
    cleanup: async () => {
      await app.close();
      fs.rmSync(dataDir, { recursive: true, force: true });
    },
  };
}

import type { LightMyRequestResponse } from 'fastify';

type Res = Promise<LightMyRequestResponse>;

export interface Client {
  cookie: string;
  user: { id: string; role: string; displayName: string };
  get: (url: string) => Res;
  post: (url: string, body?: unknown) => Res;
  put: (url: string, body?: unknown) => Res;
  patch: (url: string, body?: unknown) => Res;
}

function cookieFrom(res: LightMyRequestResponse): string {
  const c = res.cookies.find((x) => x.name === 'sid');
  if (!c) throw new Error(`no session cookie (status ${res.statusCode}: ${res.body})`);
  return `sid=${c.value}`;
}

export function client(app: App, cookie: string, user: Client['user']): Client {
  const req =
    (method: 'GET' | 'POST' | 'PUT' | 'PATCH') =>
    (url: string, body?: unknown): Res =>
      app.inject({
        method,
        url,
        headers: { cookie },
        ...(body !== undefined ? { payload: body as object } : {}),
      });
  return { cookie, user, get: req('GET'), post: req('POST'), put: req('PUT'), patch: req('PATCH') };
}

export async function setupAdmin(app: App): Promise<Client> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/setup',
    payload: { username: 'admin', displayName: 'Nikos', password: 'correct horse' },
  });
  return client(app, cookieFrom(res), res.json().user);
}

export async function login(app: App, username: string, password: string): Promise<Client> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username, password },
  });
  return client(app, cookieFrom(res), res.json().user);
}

export async function createMember(
  admin: Client,
  app: App,
  username = 'maria',
  displayName = 'Maria',
) {
  const res = await admin.post('/api/users', {
    username,
    displayName,
    password: 'password123',
    role: 'member',
  });
  if (res.statusCode !== 201) throw new Error(res.body);
  return login(app, username, 'password123');
}

const stamp = () => Date.now();

export function carRecord(over: Record<string, unknown> = {}) {
  const t = stamp();
  return {
    id: newId(),
    createdAt: t,
    updatedAt: t,
    deletedAt: null,
    createdBy: 'client',
    name: 'Polo',
    make: 'VW',
    model: null,
    plate: null,
    fuelType: '95',
    tankSizeLiters: 45,
    startOdometerKm: 50000,
    startDate: '2026-01-01',
    color: '#007aff',
    archived: false,
    ...over,
  };
}

export function fillupRecord(carId: string, over: Record<string, unknown> = {}) {
  const t = stamp();
  return {
    id: newId(),
    createdAt: t,
    updatedAt: t,
    deletedAt: null,
    createdBy: 'client',
    carId,
    date: todayIso(),
    tripKm: 600,
    liters: 40,
    totalCost: 70,
    fullTank: true,
    missedPrevious: false,
    fuelType: null,
    station: 'Shell',
    note: null,
    receiptPhotoId: null,
    ...over,
  };
}

export const op = (table: string, record: object) => ({ opId: newId(), table, record });

export async function push(c: Client, ...ops: ReturnType<typeof op>[]) {
  const res = await c.post('/api/sync/push', { ops });
  if (res.statusCode !== 200) throw new Error(res.body);
  return res.json().results as { opId: string; status: string; error?: string }[];
}
