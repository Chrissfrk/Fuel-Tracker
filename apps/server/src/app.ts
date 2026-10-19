import fs from 'node:fs';
import path from 'node:path';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { z } from 'zod';
import type { AppConfig } from './env';
import { openDatabase, type DB } from './db/client';
import { SESSION_COOKIE, SESSION_TTL_MS, resolveSession, type SessionUser } from './auth/sessions';
import { authRoutes } from './routes/auth';
import { userRoutes } from './routes/users';
import { syncRoutes } from './routes/sync';
import { carRoutes } from './routes/cars';
import { photoRoutes } from './routes/photos';
import { ioRoutes } from './routes/io';
import { adminRoutes } from './routes/admin';

declare module 'fastify' {
  interface FastifyInstance {
    db: DB;
    config: AppConfig;
    setSessionCookie: (req: FastifyRequest, reply: FastifyReply, token: string) => void;
  }
  interface FastifyRequest {
    user: SessionUser | null;
    sessionToken: string | null;
  }
}

export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

export function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const r = schema.safeParse(data);
  if (!r.success) throw new HttpError(400, z.prettifyError(r.error));
  return r.data;
}

export async function requireUser(req: FastifyRequest) {
  if (!req.user) throw new HttpError(401, 'Please log in');
}

export async function requireAdmin(req: FastifyRequest) {
  if (!req.user) throw new HttpError(401, 'Please log in');
  if (req.user.role !== 'admin') throw new HttpError(403, 'Admins only');
}

export async function buildApp(config: AppConfig, opts: { db?: DB; logger?: boolean } = {}) {
  fs.mkdirSync(path.join(config.dataDir, 'uploads'), { recursive: true });
  fs.mkdirSync(path.join(config.dataDir, 'backups'), { recursive: true });
  const db = opts.db ?? openDatabase(path.join(config.dataDir, 'app.db'), config.migrationsDir);

  const app = Fastify({
    logger: opts.logger === false ? false : { level: config.logLevel },
    trustProxy: true,
    bodyLimit: 2 * 1024 * 1024,
  });
  app.decorate('db', db);
  app.decorate('config', config);
  app.decorateRequest('user', null);
  app.decorateRequest('sessionToken', null);
  app.addHook('onClose', async () => db.$client.close());

  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'"],
        workerSrc: ["'self'"],
        manifestSrc: ["'self'"],
        fontSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: null,
      },
    },
    hsts: config.cookieSecure === true,
    crossOriginEmbedderPolicy: false,
  });
  await app.register(cookie, { secret: config.sessionSecret });
  await app.register(rateLimit, { global: false });

  const secureFor = (req: FastifyRequest) =>
    config.cookieSecure === 'auto' ? req.protocol === 'https' : config.cookieSecure;

  app.decorate('setSessionCookie', (req: FastifyRequest, reply: FastifyReply, token: string) => {
    reply.setCookie(SESSION_COOKIE, token, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: secureFor(req),
      signed: true,
      maxAge: Math.floor(SESSION_TTL_MS / 1000),
    });
  });

  app.addHook('onRequest', async (req, reply) => {
    if (!req.url.startsWith('/api/')) return;
    // Same-origin only: reject cross-site state-changing requests (defence in depth on top of SameSite).
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const origin = req.headers.origin;
      // req.host honours X-Forwarded-Host (trustProxy), so dev proxies and Caddy/Tailscale work.
      if (origin && new URL(origin).host !== req.headers.host && new URL(origin).host !== req.host) {
        throw new HttpError(403, 'Cross-origin request blocked');
      }
    }
    const raw = req.cookies[SESSION_COOKIE];
    if (!raw) return;
    const unsigned = req.unsignCookie(raw);
    if (!unsigned.valid || !unsigned.value) return;
    const session = resolveSession(db, unsigned.value);
    if (!session) {
      reply.clearCookie(SESSION_COOKIE, { path: '/' });
      return;
    }
    req.user = session.user;
    req.sessionToken = unsigned.value;
    if (session.refreshed) app.setSessionCookie(req, reply, unsigned.value);
  });

  app.setErrorHandler((err: Error & { statusCode?: number; validation?: unknown }, req, reply) => {
    const status = err instanceof HttpError ? err.statusCode : (err.statusCode ?? 500);
    if (status >= 500) req.log.error(err);
    reply
      .status(status)
      .send({ error: status >= 500 ? 'Something went wrong on the server' : err.message });
  });

  app.get('/api/health', async () => ({ status: 'ok', version: config.version }));

  await app.register(authRoutes, { prefix: '/api' });
  await app.register(userRoutes, { prefix: '/api' });
  await app.register(syncRoutes, { prefix: '/api' });
  await app.register(carRoutes, { prefix: '/api' });
  await app.register(photoRoutes, { prefix: '/api' });
  await app.register(ioRoutes, { prefix: '/api' });
  await app.register(adminRoutes, { prefix: '/api' });

  // ---- Static PWA ----
  const hasWeb = fs.existsSync(path.join(config.webDist, 'index.html'));
  if (hasWeb) {
    await app.register(fastifyStatic, {
      root: config.webDist,
      wildcard: false,
      setHeaders(res, filePath) {
        const name = path.basename(filePath);
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.header('Cache-Control', 'public, max-age=31536000, immutable');
        } else if (name === 'sw.js' || name === 'index.html' || name.endsWith('.webmanifest')) {
          res.header('Cache-Control', 'no-cache');
        }
      },
    });
    // Serve real files; any other path gets the SPA shell (client-side routing).
    app.get('/*', async (req, reply) => {
      if (req.url.startsWith('/api/')) {
        return reply.status(404).send({ error: `Not found: ${req.method} ${req.url}` });
      }
      const rel = decodeURIComponent(req.url.split('?')[0]!).replace(/^\/+/, '');
      const file = path.join(config.webDist, rel);
      if (
        rel &&
        file.startsWith(config.webDist) &&
        fs.existsSync(file) &&
        fs.statSync(file).isFile()
      ) {
        return reply.sendFile(rel);
      }
      reply.header('Cache-Control', 'no-cache');
      return reply.sendFile('index.html');
    });
  }
  app.setNotFoundHandler((req, reply) => {
    reply.status(404).send({ error: `Not found: ${req.method} ${req.url}` });
  });

  return app;
}

export type App = Awaited<ReturnType<typeof buildApp>>;
