import { useEffect, type ReactNode } from 'react';
import { useSession } from '../data/session';
import { openUserDb } from '../data/db';
import { LoginScreen, SetupScreen } from '../features/auth/AuthScreens';
import { Spinner } from '../components/ui/Controls';
import { MeContext } from './context';

/** First run → setup; signed out → login; otherwise the app (works offline with the last user). */
export function AuthGate({ children }: { children: ReactNode }) {
  const { data, isPending, error } = useSession();

  useEffect(() => {
    if (data?.user) {
      void navigator.storage?.persist?.().catch(() => {});
    }
  }, [data?.user]);

  if (isPending && !data) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-label-2">
        <Spinner size={28} />
      </div>
    );
  }
  if (error && !data) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-2 px-8 text-center">
        <p className="text-headline">Can't reach the server</p>
        <p className="text-subhead text-label-2">{(error as Error).message}</p>
      </div>
    );
  }
  if (data?.needsSetup) return <SetupScreen />;
  if (!data?.user) return <LoginScreen offline={data?.offline} />;

  openUserDb(data.user.id);
  return <MeContext.Provider value={data.user}>{children}</MeContext.Provider>;
}
