import { useEffect, useId, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Me } from '@fuel/shared';
import { Page } from '../../components/ui/Page';
import { FieldRow, Row, Section } from '../../components/ui/List';
import { Button, Segmented } from '../../components/ui/Controls';
import { SyncIndicator } from '../../components/ui/SyncIndicator';
import { toast } from '../../components/ui/Toast';
import { useMe } from '../../app/context';
import { useCars, usePendingCount, useSyncStatus } from '../../data/hooks';
import { api, errorMessage } from '../../data/api';
import { SESSION_QUERY, logout, updateCachedMe } from '../../data/session';
import { resetSyncState } from '../../data/sync';
import { setThemePref, useThemePref, type ThemePref } from '../../lib/theme';

const THEMES = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
] as const;

export function SettingsPage() {
  const me = useMe();
  const qc = useQueryClient();
  const cars = useCars();
  const theme = useThemePref();
  const pending = usePendingCount();
  const sync = useSyncStatus();
  const uid = useId();
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void navigator.storage
      ?.persisted?.()
      .then(setPersisted)
      .catch(() => setPersisted(null));
  }, []);

  const updateMe = async (patch: Partial<Pick<Me, 'defaultCarId' | 'displayName'>>) => {
    try {
      const { user } = await api<{ user: Me }>('/api/me', { method: 'PATCH', json: patch });
      updateCachedMe(user);
      qc.setQueryData(SESSION_QUERY, (s: object | undefined) => (s ? { ...s, user } : s));
      toast({ tone: 'success', message: 'Saved' });
    } catch (err) {
      toast({ tone: 'error', message: errorMessage(err) });
    }
  };

  const changePassword = async () => {
    setBusy(true);
    try {
      await api('/api/me/password', {
        method: 'POST',
        json: { currentPassword: current, newPassword: next },
      });
      setCurrent('');
      setNext('');
      toast({ tone: 'success', message: 'Password changed. Other devices were signed out.' });
    } catch (err) {
      toast({ tone: 'error', message: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  const doLogout = async () => {
    if (
      pending > 0 &&
      !window.confirm(
        `${pending} change${pending === 1 ? " hasn't" : "s haven't"} synced yet and will be lost if you log out now. Log out anyway?`,
      )
    )
      return;
    await logout(me.id);
    await resetSyncState();
    qc.clear();
    await qc.invalidateQueries({ queryKey: SESSION_QUERY });
    window.location.replace('/');
  };

  return (
    <Page title="Settings" back={{ label: 'More', to: '/more' }}>
      <Section header="Appearance">
        <div className="p-3">
          <Segmented
            label="Theme"
            options={THEMES}
            value={theme}
            onChange={(v: ThemePref) => setThemePref(v)}
          />
        </div>
      </Section>

      <Section
        header="Default car"
        footer="Opens first on this and your other devices. The app also remembers the last car you picked."
      >
        <FieldRow label="Car" htmlFor={`${uid}c`}>
          <select
            id={`${uid}c`}
            value={me.defaultCarId ?? ''}
            onChange={(e) => void updateMe({ defaultCarId: e.target.value || null })}
            className="field-input appearance-none bg-transparent text-label-2"
            style={{ textAlignLast: 'right' }}
          >
            <option value="">None</option>
            {cars.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </FieldRow>
      </Section>

      <Section header="Change password">
        <FieldRow label="Current" htmlFor={`${uid}o`}>
          <input
            id={`${uid}o`}
            type="password"
            className="field-input"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
          />
        </FieldRow>
        <FieldRow
          label="New"
          htmlFor={`${uid}n`}
          hint={next && next.length < 8 ? 'At least 8 characters' : undefined}
        >
          <input
            id={`${uid}n`}
            type="password"
            className="field-input"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
          />
        </FieldRow>
      </Section>
      <Button
        variant="tinted"
        className="mt-3 w-full"
        disabled={!current || next.length < 8}
        loading={busy}
        onClick={() => void changePassword()}
      >
        Change password
      </Button>

      <Section header="Sync">
        <div className="flex min-h-11 items-center justify-between px-4 py-1">
          <SyncIndicator />
          {sync.lastSyncedAt && (
            <span className="text-footnote text-label-2">
              Last:{' '}
              {new Date(sync.lastSyncedAt).toLocaleTimeString('el-GR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}
        </div>
        <Row
          title="Offline storage"
          value={persisted == null ? 'Unknown' : persisted ? 'Protected' : 'Best effort'}
          chevron={false}
        />
      </Section>

      <Section>
        <Row title={`Log out ${me.displayName}`} destructive onClick={() => void doLogout()} />
      </Section>

      <p className="mt-6 text-center text-footnote text-label-2">
        Fuel Tracker {__APP_VERSION__} · @{me.username} · {me.role === 'admin' ? 'Admin' : 'Member'}
      </p>
    </Page>
  );
}
