import type { FastifyPluginAsync } from 'fastify';
import { eq } from 'drizzle-orm';
import { carAccessSchema } from '@fuel/shared';
import { HttpError, parse, requireAdmin } from '../app';
import { carAccess, cars, users } from '../db/schema';

export const carRoutes: FastifyPluginAsync = async (app) => {
  const { db } = app;

  /** Empty list = shared with the whole household. */
  app.get<{ Params: { id: string } }>(
    '/cars/:id/access',
    { preHandler: requireAdmin },
    async (req) => ({
      userIds: db
        .select({ userId: carAccess.userId })
        .from(carAccess)
        .where(eq(carAccess.carId, req.params.id))
        .all()
        .map((r) => r.userId),
    }),
  );

  app.put<{ Params: { id: string } }>(
    '/cars/:id/access',
    { preHandler: requireAdmin },
    async (req) => {
      const { userIds } = parse(carAccessSchema, req.body);
      if (!db.select({ id: cars.id }).from(cars).where(eq(cars.id, req.params.id)).get()) {
        throw new HttpError(404, 'Car not found');
      }
      const known = new Set(
        db
          .select({ id: users.id })
          .from(users)
          .all()
          .map((u) => u.id),
      );
      const unique = [...new Set(userIds)].filter((id) => known.has(id));
      db.$client.transaction(() => {
        db.delete(carAccess).where(eq(carAccess.carId, req.params.id)).run();
        for (const userId of unique)
          db.insert(carAccess).values({ carId: req.params.id, userId }).run();
      })();
      return { userIds: unique };
    },
  );
};
