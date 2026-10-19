import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
/** apps/server — works from both src/ (tsx) and dist/ (bundle). */
export const SERVER_ROOT = path.resolve(here, '..');

export interface AppConfig {
  port: number;
  host: string;
  sessionSecret: string;
  dataDir: string;
  /** `auto` = secure cookies whenever the request arrived over HTTPS (directly or via proxy). */
  cookieSecure: boolean | 'auto';
  webDist: string;
  migrationsDir: string;
  version: string;
  logLevel: string;
}

declare const __APP_VERSION__: string | undefined;

export function resolveDataDir(env: NodeJS.ProcessEnv = process.env): string {
  return path.resolve(
    env.DATA_DIR ??
      (env.NODE_ENV === 'production' ? '/data' : path.join(SERVER_ROOT, '../../.data')),
  );
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const sessionSecret = env.SESSION_SECRET ?? '';
  if (sessionSecret.length < 32) {
    throw new Error(
      'SESSION_SECRET is missing or shorter than 32 characters. Generate one with: openssl rand -base64 48',
    );
  }
  const secure = (env.COOKIE_SECURE ?? 'auto').toLowerCase();
  return {
    port: Number(env.PORT ?? 3000),
    host: env.HOST ?? '0.0.0.0',
    sessionSecret,
    dataDir: resolveDataDir(env),
    cookieSecure: secure === 'true' ? true : secure === 'false' ? false : 'auto',
    webDist: path.resolve(env.WEB_DIST ?? path.join(SERVER_ROOT, '../web/dist')),
    migrationsDir: path.join(SERVER_ROOT, 'drizzle'),
    version:
      typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : (env.npm_package_version ?? 'dev'),
    logLevel: env.LOG_LEVEL ?? 'info',
  };
}
