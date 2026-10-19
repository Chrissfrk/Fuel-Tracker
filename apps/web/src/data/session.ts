import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { Me, SessionResponse } from '@fuel/shared';
import { NetworkError, api, onUnauthorized } from './api';
import { deleteUserDb, getDb, hasDb } from './db';

const ME_KEY = 'fuel:me';

function cachedMe(): Me | null {
  try {
    const raw = localStorage.getItem(ME_KEY);
    return raw ? (JSON.parse(raw) as Me) : null;
  } catch {
    return null;
  }
}

function storeMe(me: Me | null) {
  try {
    if (me) localStorage.setItem(ME_KEY, JSON.stringify(me));
    else localStorage.removeItem(ME_KEY);
  } catch {
    /* storage unavailable */
  }
}

export interface SessionState extends SessionResponse {
  /** True when the server couldn't be reached and the last known user is shown. */
  offline: boolean;
}

export const SESSION_QUERY = ['session'] as const;

async function fetchSession(): Promise<SessionState> {
  try {
    const s = await api<SessionResponse>('/api/auth/session', { timeoutMs: 8000 });
    storeMe(s.user);
    return { ...s, offline: false };
  } catch (err) {
    if (err instanceof NetworkError) {
      // Offline at the pump: keep working as the last signed-in user.
      return { needsSetup: false, user: cachedMe(), offline: true };
    }
    throw err;
  }
}

export function useSession() {
  const qc = useQueryClient();
  useEffect(
    () =>
      onUnauthorized(() => {
        void qc.invalidateQueries({ queryKey: SESSION_QUERY });
      }),
    [qc],
  );
  return useQuery({
    queryKey: SESSION_QUERY,
    queryFn: fetchSession,
    initialData: () => {
      const me = cachedMe();
      return me ? { needsSetup: false, user: me, offline: true } : undefined;
    },
    initialDataUpdatedAt: 0,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export async function login(username: string, password: string) {
  const { user } = await api<{ user: Me }>('/api/auth/login', {
    method: 'POST',
    json: { username, password },
  });
  storeMe(user);
  return user;
}

export async function setup(username: string, displayName: string, password: string) {
  const { user } = await api<{ user: Me }>('/api/auth/setup', {
    method: 'POST',
    json: { username, displayName, password },
  });
  storeMe(user);
  return user;
}

/** Number of local changes that haven't reached the server. */
export async function unsyncedCount(): Promise<number> {
  return hasDb() ? getDb().outbox.count() : 0;
}

export async function logout(userId: string) {
  try {
    await api('/api/auth/logout', { method: 'POST' });
  } catch {
    /* offline: the cookie is cleared server-side on next login anyway */
  }
  storeMe(null);
  // Shared family devices: don't leave the previous person's data on the phone.
  await deleteUserDb(userId);
}

export function updateCachedMe(me: Me) {
  storeMe(me);
}
