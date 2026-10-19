import path from 'node:path';
import { loadConfig } from './env';
import { buildApp } from './app';
import { scheduleNightlyBackups } from './backup';
import { purgeExpiredSessions } from './auth/sessions';

let config;
try {
  config = loadConfig();
} catch (err) {
  console.error(`\n✖ ${(err as Error).message}\n`);
  process.exit(1);
}

const app = await buildApp(config);
const stopBackups = scheduleNightlyBackups(app.db, path.join(config.dataDir, 'backups'), app.log);
const purge = setInterval(() => purgeExpiredSessions(app.db), 6 * 60 * 60 * 1000);
purge.unref();

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'shutting down');
  stopBackups();
  clearInterval(purge);
  await app.close();
  process.exit(0);
};
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

await app.listen({ port: config.port, host: config.host });
app.log.info(`Fuel tracker ${config.version} · data in ${config.dataDir}`);
