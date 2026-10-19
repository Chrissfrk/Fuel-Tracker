import { useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { errorMessage } from '../../data/api';
import { SESSION_QUERY, login, setup } from '../../data/session';
import { Button, focusNextOnEnter } from '../../components/ui/Controls';
import { FieldRow, Section } from '../../components/ui/List';

function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="relative isolate min-h-dvh overflow-hidden">
      <div
        aria-hidden
        className="page-glow"
        style={
          {
            '--glow': 'var(--accent)',
            '--glow-2': 'var(--indigo)',
            height: '70dvh',
          } as CSSProperties
        }
      />
      <main
        className="fade-in mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top) + 24px)',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)',
        }}
      >
        <img
          src="/pwa-192x192.png"
          alt=""
          width={76}
          height={76}
          className="mx-auto rounded-[18px] shadow-[0_12px_32px_-10px_color-mix(in_srgb,var(--accent)_70%,transparent)]"
        />
        <h1 className="mt-5 text-center text-large-title">{title}</h1>
        <p className="mt-1.5 text-center text-callout text-label-2">{subtitle}</p>
        {children}
      </main>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = 'text',
  autoComplete,
  autoFocus,
  id,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  autoFocus?: boolean;
  id: string;
}) {
  return (
    <FieldRow label={label} htmlFor={id}>
      <input
        id={id}
        className="field-input"
        type={type}
        value={value}
        autoComplete={autoComplete}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        autoFocus={autoFocus}
        enterKeyHint="next"
        data-next-field
        onChange={(e) => onChange(e.target.value)}
        required
      />
    </FieldRow>
  );
}

export function SetupScreen() {
  const qc = useQueryClient();
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await setup(username.trim().toLowerCase(), displayName.trim(), password);
      await qc.invalidateQueries({ queryKey: SESSION_QUERY });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome"
      subtitle="Create the admin account for your household. You can add family members afterwards."
    >
      <form
        onSubmit={submit}
        onKeyDown={(e) => focusNextOnEnter(e, () => void submit())}
        className="mt-4"
      >
        <Section footer="Usernames are lowercase. Passwords need at least 8 characters.">
          <TextField
            id="s-name"
            label="Your name"
            value={displayName}
            onChange={setDisplayName}
            autoComplete="name"
            autoFocus
          />
          <TextField
            id="s-user"
            label="Username"
            value={username}
            onChange={setUsername}
            autoComplete="username"
          />
          <TextField
            id="s-pass"
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
          />
        </Section>
        {error && (
          <p role="alert" className="mt-3 px-4 text-footnote text-red-text">
            {error}
          </p>
        )}
        <Button type="submit" className="mt-6 w-full" loading={busy}>
          Create admin account
        </Button>
      </form>
    </AuthLayout>
  );
}

export function LoginScreen({ offline }: { offline?: boolean }) {
  const qc = useQueryClient();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(username.trim().toLowerCase(), password);
      await qc.invalidateQueries({ queryKey: SESSION_QUERY });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Fuel Tracker" subtitle="Log in to see your family's cars.">
      <form
        onSubmit={submit}
        onKeyDown={(e) => focusNextOnEnter(e, () => void submit())}
        className="mt-4"
      >
        <Section>
          <TextField
            id="l-user"
            label="Username"
            value={username}
            onChange={setUsername}
            autoComplete="username"
            autoFocus
          />
          <TextField
            id="l-pass"
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
          />
        </Section>
        {(error || offline) && (
          <p role="alert" className="mt-3 px-4 text-footnote text-red-text">
            {error ?? "You're offline. Connect to log in for the first time on this device."}
          </p>
        )}
        <Button
          type="submit"
          className="mt-6 w-full"
          loading={busy}
          disabled={!username || !password}
        >
          Log in
        </Button>
        <p className="mt-4 px-4 text-center text-footnote text-label-2">
          Forgot your password? Ask your household admin to reset it.
        </p>
      </form>
    </AuthLayout>
  );
}
