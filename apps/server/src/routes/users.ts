import type { FastifyPluginAsync } from 'fastify';
import { asc, eq } from 'drizzle-orm';
import {
  createUserSchema,
  newId,
  resetPasswordSchema,
  updateUserSchema,
  type PublicUser,
} from '@fuel/shared';
import { HttpError, parse, requireAdmin } from '../app';
import { nextRev } from '../db/client';
import { users } from '../db/schema';
import { hashPassword } from '../auth/password';
import { deleteUserSessions } from '../auth/sessions';

const toPublic = (u: typeof users.$inferSelect): PublicUser => ({
  id: u.id,
  username: u.username,
  displayName: u.displayName,
  role: u.role,
  active: u.active,
});

export const userRoutes: FastifyPluginAsync = async (app) => {
  const { db } = app;

  app.get('/users', { preHandler: requireAdmin }, async () =>
    db.select().from(users).orderBy(asc(users.displayName)).all().map(toPublic),
  );

  app.post('/users', { preHandler: requireAdmin }, async (req, reply) => {
    const body = parse(createUserSchema, req.body);
    if (db.select().from(users).where(eq(users.username, body.username)).get()) {
      throw new HttpError(409, `The username "${body.username}" is already taken`);
    }
    const now = Date.now();
    const id = newId();
    db.insert(users)
      .values({
        id,
        username: body.username,
        displayName: body.displayName,
        passwordHash: await hashPassword(body.password),
        role: body.role,
        active: true,
        createdAt: now,
        updatedAt: now,
        createdBy: req.user!.id,
        rev: nextRev(db),
      })
      .run();
    reply.status(201);
    return toPublic(db.select().from(users).where(eq(users.id, id)).get()!);
  });

  app.patch<{ Params: { id: string } }>('/users/:id', { preHandler: requireAdmin }, async (req) => {
    const body = parse(updateUserSchema, req.body);
    const user = db.select().from(users).where(eq(users.id, req.params.id)).get();
    if (!user) throw new HttpError(404, 'User not found');
    if (user.id === req.user!.id && (body.active === false || body.role === 'member')) {
      throw new HttpError(400, 'You cannot deactivate or demote yourself');
    }
    db.update(users)
      .set({ ...body, updatedAt: Date.now(), rev: nextRev(db) })
      .where(eq(users.id, user.id))
      .run();
    if (body.active === false) deleteUserSessions(db, user.id);
    return toPublic(db.select().from(users).where(eq(users.id, user.id)).get()!);
  });

  app.post<{ Params: { id: string } }>(
    '/users/:id/password',
    { preHandler: requireAdmin },
    async (req) => {
      const body = parse(resetPasswordSchema, req.body);
      const user = db.select().from(users).where(eq(users.id, req.params.id)).get();
      if (!user) throw new HttpError(404, 'User not found');
      db.update(users)
        .set({ passwordHash: await hashPassword(body.password), updatedAt: Date.now() })
        .where(eq(users.id, user.id))
        .run();
      deleteUserSessions(db, user.id);
      return { ok: true };
    },
  );
};
