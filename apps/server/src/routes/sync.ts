import type { FastifyPluginAsync } from 'fastify';
import { pushRequestSchema } from '@fuel/shared';
import { parse, requireUser } from '../app';
import { applyOps, pullChanges } from '../services/records';

export const syncRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { since?: string } }>(
    '/sync',
    { preHandler: requireUser },
    async (req) => {
      const since = Math.max(0, Number(req.query.since ?? 0) || 0);
      return pullChanges(app.db, req.user!, since);
    },
  );

  app.post('/sync/push', { preHandler: requireUser, bodyLimit: 5 * 1024 * 1024 }, async (req) => {
    const { ops } = parse(pushRequestSchema, req.body);
    return { results: applyOps(app.db, req.user!, ops) };
  });
};
