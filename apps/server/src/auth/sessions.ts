import crypto from 'node:crypto';
import { and, eq, gt, lt } from 'drizzle-orm';
import type { Me } from '@fuel/shared';
import type { DB } from '../db/client';
import { sessions, users } from '../db/schema';

export const SESSION_COOKIE = 'sid';
export const SESSION_TTL_MS = 180 * 24 * 60 * 60 * 1000;
/** Only extend a session's expiry (a DB write) at most once per day. */
const TOUCH_INTERVAL_MS = 24 * 60 * 60 * 1000;

export type SessionUser = Me;

const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

export function createSession(db: DB, userId: string, now = Date.now()): string {
  const token = crypto.randomBytes(32).toString('base64url');
  db.insert(sessions)
    .values({
      id: hashToken(token),
      userId,
      createdAt: now,
      lastSeenAt: now,
      expiresAt: now + SESSION_TTL_MS,
    })
    .run();
  return token;
}

export function toMe(u: typeof users.$inferSelect): Me {
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    role: u.role,
    active: u.active,
    defaultCarId: u.defaultCarId,
  };
}

/** Resolve a cookie token to an active user, sliding the expiry forward. */
export function resolveSession(
  db: DB,
  token: string,
  now = Date.now(),
): { user: SessionUser; refreshed: boolean } | null {
  const id = hashToken(token);
  const row = db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, id), gt(sessions.expiresAt, now)))
    .get();
  if (!row || !row.user.active || row.user.deletedAt != null) return null;
  let refreshed = false;
  if (now - row.session.lastSeenAt > TOUCH_INTERVAL_MS) {
    db.update(sessions)
      .set({ lastSeenAt: now, expiresAt: now + SESSION_TTL_MS })
      .where(eq(sessions.id, id))
      .run();
    refreshed = true;
  }
  return { user: toMe(row.user), refreshed };
}

export function deleteSession(db: DB, token: string) {
  db.delete(sessions)
    .where(eq(sessions.id, hashToken(token)))
    .run();
}

export function deleteUserSessions(db: DB, userId: string, exceptToken?: string) {
  const all = db
    .select({ id: sessions.id })
    .from(sessions)
    .where(eq(sessions.userId, userId))
    .all();
  const keep = exceptToken ? hashToken(exceptToken) : null;
  for (const s of all) {
    if (s.id !== keep) db.delete(sessions).where(eq(sessions.id, s.id)).run();
  }
}

export function purgeExpiredSessions(db: DB, now = Date.now()) {
  db.delete(sessions).where(lt(sessions.expiresAt, now)).run();
}
