import { useId, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { PublicUser, Role } from '@fuel/shared';
import { BarButton, Page } from '../../components/ui/Page';
import { FieldRow, Row, Section } from '../../components/ui/List';
import { Button, Segmented, Spinner, Switch } from '../../components/ui/Controls';
import { Icon } from '../../components/ui/Icon';
import { Sheet } from '../../components/ui/Sheet';
import { EmptyState } from '../../components/ui/EmptyState';
import { toast } from '../../components/ui/Toast';
import { useMe } from '../../app/context';
import { api, errorMessage } from '../../data/api';
import { syncNow } from '../../data/sync';

const ROLE_OPTIONS = [
  { value: 'member', label: 'Member' },
  { value: 'admin', label: 'Admin' },
] as const;

export function UsersPage() {
  const me = useMe();
  const qc = useQueryClient();
  const {
    data: users,
    error,
    isPending,
  } = useQuery({ queryKey: ['users'], queryFn: () => api<PublicUser[]>('/api/users') });
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<PublicUser | null>(null);
  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ['users'] });
    void syncNow();
  };

  return (
    <Page
      title="Family members"
      back={{ label: 'More', to: '/more' }}
      trailing={
        <BarButton onClick={() => setAdding(true)} label="Add family member">
          <Icon name="plus" size={26} strokeWidth={2.2} />
        </BarButton>
      }
    >
      {isPending ? (
        <div className="flex justify-center py-16 text-label-2">
          <Spinner size={24} />
        </div>
      ) : error ? (
        <EmptyState
          icon="cloudOff"
          title="You're offline"
          message="Managing family members needs a connection."
        />
      ) : (
        <Section footer="Members can log fill-ups and expenses for the cars they can use, add cars and reminders, and edit what they logged. Admins can do everything.">
          {users!.map((u) => (
            <Row
              key={u.id}
              title={`${u.displayName}${u.id === me.id ? ' (you)' : ''}`}
              subtitle={`@${u.username} · ${u.role === 'admin' ? 'Admin' : 'Member'}${u.active ? '' : ' · Deactivated'}`}
              leading={
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-headline text-white ${u.active ? 'bg-accent' : 'bg-label-3'}`}
                  aria-hidden
                >
                  {u.displayName.slice(0, 1).toUpperCase()}
                </span>
              }
              onClick={() => setSelected(u)}
            />
          ))}
        </Section>
      )}
      <AddUserSheet open={adding} onClose={() => setAdding(false)} onDone={refresh} />
      {selected && (
        <UserSheet
          user={selected}
          isSelf={selected.id === me.id}
          onClose={() => setSelected(null)}
          onDone={refresh}
        />
      )}
    </Page>
  );
}

function AddUserSheet({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const uid = useId();
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('member');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api('/api/users', {
        method: 'POST',
        json: {
          displayName: displayName.trim(),
          username: username.trim().toLowerCase(),
          password,
          role,
        },
      });
      toast({ tone: 'success', message: `${displayName} can now log in` });
      setDisplayName('');
      setUsername('');
      setPassword('');
      setRole('member');
      onClose();
      await onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      label="Add family member"
      header={
        <div className="grid grid-cols-[1fr_auto_1fr] items-center px-2 pb-3">
          <button
            type="button"
            className="pressable min-h-11 justify-self-start px-2 text-accent-text"
            onClick={onClose}
          >
            Cancel
          </button>
          <h2 className="text-headline">New member</h2>
          <button
            type="button"
            disabled={busy || !displayName || !username || password.length < 8}
            className="pressable min-h-11 justify-self-end px-2 font-semibold text-accent-text disabled:opacity-35"
            onClick={() => void submit()}
          >
            Add
          </button>
        </div>
      }
    >
      <Section footer="Share the username and password with them. They can change the password in Settings.">
        <FieldRow label="Name" htmlFor={`${uid}n`}>
          <input
            id={`${uid}n`}
            className="field-input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Maria"
            autoFocus
          />
        </FieldRow>
        <FieldRow label="Username" htmlFor={`${uid}u`}>
          <input
            id={`${uid}u`}
            className="field-input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="maria"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </FieldRow>
        <FieldRow label="Password" htmlFor={`${uid}p`} hint="At least 8 characters">
          <input
            id={`${uid}p`}
            className="field-input"
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
          />
        </FieldRow>
      </Section>
      <div className="mt-6">
        <Segmented label="Role" options={ROLE_OPTIONS} value={role} onChange={setRole} />
      </div>
      {error && (
        <p className="mt-3 px-4 text-footnote text-red-text" role="alert">
          {error}
        </p>
      )}
    </Sheet>
  );
}

function UserSheet({
  user,
  isSelf,
  onClose,
  onDone,
}: {
  user: PublicUser;
  isSelf: boolean;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const uid = useId();
  const [open, setOpen] = useState(true);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const close = () => {
    setOpen(false);
    setTimeout(onClose, 350);
  };
  const patch = async (body: Partial<Pick<PublicUser, 'role' | 'active'>>) => {
    setBusy(true);
    try {
      await api(`/api/users/${user.id}`, { method: 'PATCH', json: body });
      await onDone();
      toast({ tone: 'success', message: 'Saved' });
      close();
    } catch (err) {
      toast({ tone: 'error', message: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };
  const reset = async () => {
    setBusy(true);
    try {
      await api(`/api/users/${user.id}/password`, { method: 'POST', json: { password } });
      toast({
        tone: 'success',
        message: `Password reset. ${user.displayName} needs to log in again.`,
      });
      close();
    } catch (err) {
      toast({ tone: 'error', message: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet
      open={open}
      onClose={close}
      label={user.displayName}
      header={
        <div className="grid grid-cols-[1fr_auto_1fr] items-center px-2 pb-3">
          <span />
          <h2 className="text-headline">{user.displayName}</h2>
          <button
            type="button"
            className="pressable min-h-11 justify-self-end px-2 font-semibold text-accent-text"
            onClick={close}
          >
            Done
          </button>
        </div>
      }
    >
      {!isSelf && (
        <>
          <div className="mt-3">
            <Segmented
              label="Role"
              options={ROLE_OPTIONS}
              value={user.role}
              onChange={(r) => void patch({ role: r })}
            />
          </div>
          <Section footer="Deactivated members can't log in. Their past records stay.">
            <FieldRow label="Can log in">
              <Switch
                checked={user.active}
                onChange={(v) => void patch({ active: v })}
                label="Can log in"
              />
            </FieldRow>
          </Section>
        </>
      )}
      <Section
        header="Reset password"
        footer={
          isSelf ? 'To change your own password, use Settings.' : 'Signs them out on all devices.'
        }
      >
        <FieldRow label="New password" htmlFor={`${uid}p`}>
          <input
            id={`${uid}p`}
            className="field-input"
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="8+ characters"
            autoComplete="off"
            autoCapitalize="none"
            disabled={isSelf}
          />
        </FieldRow>
      </Section>
      {!isSelf && (
        <Button
          className="mt-4 w-full"
          variant="tinted"
          disabled={password.length < 8}
          loading={busy}
          onClick={() => void reset()}
        >
          Reset password
        </Button>
      )}
    </Sheet>
  );
}
