import type { FastifyPluginAsync } from 'fastify';
import { count, eq } from 'drizzle-orm';
import {
  changePasswordSchema,
  loginSchema,
  newId,
  setupSchema,
  updateMeSchema,
  type SessionResponse,
} from '@fuel/shared';
import { HttpError, parse, requireUser } from '../app';
import { nextRev } from '../db/client';
import { users } from '../db/schema';
import { hashPassword, verifyPassword } from '../auth/password';
import {
  SESSION_COOKIE,
  createSession,
  deleteSession,
  deleteUserSessions,
  toMe,
} from '../auth/sessions';

const loginLimit = { rateLimit: { max: 10, timeWindow: '15 minutes' } };

/** Hash used to keep login timing similar when the username doesn't exist. */
let dummyHash: Promise<string> | null = null;

export const authRoutes: FastifyPluginAsync = async (app) => {
  const { db } = app;
  const userCount = () => db.select({ n: count() }).from(users).get()!.n;

  app.get('/auth/session', async (req): Promise<SessionResponse> => ({
    needsSetup: userCount() === 0,
    user: req.user,
  }));

  app.post('/auth/setup', { config: loginLimit }, async (req, reply) => {
    const body = parse(setupSchema, req.body);
    const passwordHash = await hashPassword(body.password);
    const now = Date.now();
    const id = newId();
    const created = db.$client.transaction(() => {
      if (userCount() > 0) return false;
      db.insert(users)
        .values({
          id,
          username: body.username,
          displayName: body.displayName,
          passwordHash,
          role: 'admin',
          active: true,
          createdAt: now,
          updatedAt: now,
          createdBy: id,
          rev: nextRev(db),
        })
        .run();
      return true;
    })();
    if (!created) throw new HttpError(409, 'Setup is already complete');
    const token = createSession(db, id);
    app.setSessionCookie(req, reply, token);
    return { user: toMe(db.select().from(users).where(eq(users.id, id)).get()!) };
  });

  app.post('/auth/login', { config: loginLimit }, async (req, reply) => {
    const body = parse(loginSchema, req.body);
    const user = db.select().from(users).where(eq(users.username, body.username)).get();
    if (!user) {
      dummyHash ??= hashPassword('not-a-real-password');
      await verifyPassword(await dummyHash, body.password);
      throw new HttpError(401, 'Wrong username or password');
    }
    const ok = await verifyPassword(user.passwordHash, body.password);
    if (!ok) throw new HttpError(401, 'Wrong username or password');
    if (!user.active || user.deletedAt != null) {
      throw new HttpError(403, 'This account has been deactivated. Ask your admin.');
    }
    const token = createSession(db, user.id);
    app.setSessionCookie(req, reply, token);
    return { user: toMe(user) };
  });

  app.post('/auth/logout', async (req, reply) => {
    if (req.sessionToken) deleteSession(db, req.sessionToken);
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });

  app.patch('/me', { preHandler: requireUser }, async (req) => {
    const body = parse(updateMeSchema, req.body);
    db.update(users)
      .set({ ...body, updatedAt: Date.now(), rev: nextRev(db) })
      .where(eq(users.id, req.user!.id))
      .run();
    return { user: toMe(db.select().from(users).where(eq(users.id, req.user!.id)).get()!) };
  });

  app.post('/me/password', { preHandler: requireUser, config: loginLimit }, async (req) => {
    const body = parse(changePasswordSchema, req.body);
    const user = db.select().from(users).where(eq(users.id, req.user!.id)).get()!;
    if (!(await verifyPassword(user.passwordHash, body.currentPassword))) {
      throw new HttpError(400, 'Your current password is not correct');
    }
    db.update(users)
      .set({ passwordHash: await hashPassword(body.newPassword), updatedAt: Date.now() })
      .where(eq(users.id, user.id))
      .run();
    // Log out other devices, keep this one.
    deleteUserSessions(db, user.id, req.sessionToken ?? undefined);
    return { ok: true };
  });
};
