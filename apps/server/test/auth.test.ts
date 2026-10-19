import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMember, login, makeApp, setupAdmin } from './helpers';
import type { App } from '../src/app';
import { loadConfig } from '../src/env';

let app: App;
let cleanup: () => Promise<void>;
beforeEach(async () => ({ app, cleanup } = await makeApp()));
afterEach(() => cleanup());

describe('config', () => {
  it('refuses to start without a SESSION_SECRET', () => {
    expect(() => loadConfig({})).toThrow(/SESSION_SECRET/);
    expect(() => loadConfig({ SESSION_SECRET: 'short' })).toThrow(/SESSION_SECRET/);
  });
});

describe('health', () => {
  it('reports ok', async () => {
    const res = await app.inject('/api/health');
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('ok');
  });
  it('sends security headers', async () => {
    const res = await app.inject('/api/health');
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});

describe('first-run setup', () => {
  it('reports that setup is needed, then creates the admin', async () => {
    expect((await app.inject('/api/auth/session')).json()).toEqual({
      needsSetup: true,
      user: null,
    });
    const admin = await setupAdmin(app);
    expect(admin.user.role).toBe('admin');
    const session = (await admin.get('/api/auth/session')).json();
    expect(session.needsSetup).toBe(false);
    expect(session.user.displayName).toBe('Nikos');
  });

  it('cannot run twice', async () => {
    await setupAdmin(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/setup',
      payload: { username: 'evil', displayName: 'Evil', password: 'password123' },
    });
    expect(res.statusCode).toBe(409);
  });

  it('validates input', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/setup',
      payload: { username: 'a', displayName: '', password: 'short' },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('login / logout', () => {
  it('sets an httpOnly SameSite=Lax cookie', async () => {
    await setupAdmin(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'ADMIN', password: 'correct horse' },
    });
    expect(res.statusCode).toBe(200);
    const cookie = res.cookies.find((c) => c.name === 'sid')!;
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).toBe('Lax');
  });

  it('rejects wrong passwords and unknown users with the same message', async () => {
    await setupAdmin(app);
    const a = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'admin', password: 'nope' },
    });
    const b = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'ghost', password: 'nope' },
    });
    expect(a.statusCode).toBe(401);
    expect(b.statusCode).toBe(401);
    expect(a.json().error).toBe(b.json().error);
  });

  it('rate-limits login attempts', async () => {
    await setupAdmin(app);
    let last = 0;
    for (let i = 0; i < 12; i++) {
      last = (
        await app.inject({
          method: 'POST',
          url: '/api/auth/login',
          payload: { username: 'x', password: 'y' },
        })
      ).statusCode;
    }
    expect(last).toBe(429);
  });

  it('logs out and invalidates the session', async () => {
    const admin = await setupAdmin(app);
    await admin.post('/api/auth/logout');
    expect((await admin.get('/api/auth/session')).json().user).toBeNull();
    expect((await admin.get('/api/sync')).statusCode).toBe(401);
  });

  it('ignores tampered cookies', async () => {
    const admin = await setupAdmin(app);
    const res = await app.inject({
      url: '/api/auth/session',
      headers: { cookie: admin.cookie.slice(0, -2) + 'xx' },
    });
    expect(res.json().user).toBeNull();
  });

  it('blocks cross-origin writes', async () => {
    const admin = await setupAdmin(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { cookie: admin.cookie, origin: 'https://evil.example', host: 'localhost:3000' },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('own account', () => {
  it('changes password and default car', async () => {
    const admin = await setupAdmin(app);
    expect(
      (
        await admin.post('/api/me/password', {
          currentPassword: 'wrong',
          newPassword: 'new password',
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await admin.post('/api/me/password', {
          currentPassword: 'correct horse',
          newPassword: 'new password',
        })
      ).statusCode,
    ).toBe(200);
    await login(app, 'admin', 'new password');
    const res = await admin.patch('/api/me', {
      defaultCarId: '00000000-0000-4000-8000-000000000001',
    });
    expect(res.json().user.defaultCarId).toBe('00000000-0000-4000-8000-000000000001');
  });
});

describe('user management', () => {
  it('lets admins create, reset and deactivate users', async () => {
    const admin = await setupAdmin(app);
    const maria = await createMember(admin, app);
    expect(maria.user.role).toBe('member');

    const list = (await admin.get('/api/users')).json();
    expect(list.map((u: { username: string }) => u.username).sort()).toEqual(['admin', 'maria']);

    expect(
      (await admin.post(`/api/users/${maria.user.id}/password`, { password: 'reset-pass-1' }))
        .statusCode,
    ).toBe(200);
    expect((await maria.get('/api/sync')).statusCode).toBe(401); // sessions revoked
    const again = await login(app, 'maria', 'reset-pass-1');

    expect(
      (await admin.patch(`/api/users/${maria.user.id}`, { active: false })).json().active,
    ).toBe(false);
    expect((await again.get('/api/sync')).statusCode).toBe(401);
    const blocked = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'maria', password: 'reset-pass-1' },
    });
    expect(blocked.statusCode).toBe(403);
  });

  it('rejects duplicate usernames and self-deactivation', async () => {
    const admin = await setupAdmin(app);
    await createMember(admin, app);
    expect(
      (
        await admin.post('/api/users', {
          username: 'maria',
          displayName: 'M',
          password: 'password123',
          role: 'member',
        })
      ).statusCode,
    ).toBe(409);
    expect((await admin.patch(`/api/users/${admin.user.id}`, { active: false })).statusCode).toBe(
      400,
    );
  });

  it('is admin-only', async () => {
    const admin = await setupAdmin(app);
    const maria = await createMember(admin, app);
    expect((await maria.get('/api/users')).statusCode).toBe(403);
    expect(
      (
        await maria.post('/api/users', {
          username: 'x1x',
          displayName: 'X',
          password: 'password123',
          role: 'admin',
        })
      ).statusCode,
    ).toBe(403);
  });
});

describe('static PWA serving', () => {
  it('serves the SPA for deep links but JSON 404s for unknown API paths', async () => {
    const fs = await import('node:fs');
    const os = await import('node:os');
    const path = await import('node:path');
    const { buildApp } = await import('../src/app');
    const web = fs.mkdtempSync(path.join(os.tmpdir(), 'fuel-web-'));
    const data = fs.mkdtempSync(path.join(os.tmpdir(), 'fuel-data-'));
    fs.writeFileSync(path.join(web, 'index.html'), '<!doctype html><title>shell</title>');
    fs.writeFileSync(path.join(web, 'sw.js'), '// sw');
    const app2 = await buildApp(
      loadConfig({
        SESSION_SECRET: 'x'.repeat(40),
        DATA_DIR: data,
        WEB_DIST: web,
        LOG_LEVEL: 'silent',
      }),
      { logger: false },
    );
    try {
      const deep = await app2.inject('/more/settings');
      expect(deep.statusCode).toBe(200);
      expect(deep.body).toContain('shell');
      const sw = await app2.inject('/sw.js');
      expect(sw.headers['cache-control']).toBe('no-cache');
      const api = await app2.inject('/api/does-not-exist');
      expect(api.statusCode).toBe(404);
      expect(api.json().error).toMatch(/Not found/);
    } finally {
      await app2.close();
      fs.rmSync(web, { recursive: true, force: true });
      fs.rmSync(data, { recursive: true, force: true });
    }
  });
});
