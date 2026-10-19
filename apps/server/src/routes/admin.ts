import path from 'node:path';
import type { FastifyPluginAsync } from 'fastify';
import { requireAdmin } from '../app';
import { listBackups, runBackup } from '../backup';

export const adminRoutes: FastifyPluginAsync = async (app) => {
  const dir = path.join(app.config.dataDir, 'backups');

  app.get('/admin/backups', { preHandler: requireAdmin }, async () => listBackups(dir));

  app.post('/admin/backups', { preHandler: requireAdmin }, async () => {
    const file = await runBackup(app.db, dir);
    return { name: path.basename(file) };
  });
};
