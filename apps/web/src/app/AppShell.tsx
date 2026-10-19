import { Suspense, useEffect } from 'react';
import { Outlet, useSearchParams } from 'react-router';
import { TabBar } from '../components/ui/TabBar';
import { Toaster, toast } from '../components/ui/Toast';
import { Spinner } from '../components/ui/Controls';
import { setRejectedHandler, startAutoSync } from '../data/sync';
import { AddSheet } from '../features/add/AddSheet';
import { UpdatePrompt } from './UpdatePrompt';
import { addSheet, type AddMode } from './context';

export function AppShell() {
  const [params, setParams] = useSearchParams();

  useEffect(() => {
    setRejectedHandler((messages) =>
      toast({
        tone: 'error',
        message:
          messages.length === 1
            ? messages[0]!
            : `${messages.length} changes couldn't be saved: ${messages[0]}`,
        duration: 7000,
      }),
    );
    return startAutoSync();
  }, []);

  // Home-screen shortcut: /?add=fillup
  useEffect(() => {
    const add = params.get('add');
    if (add === 'fillup' || add === 'expense' || add === 'odometer') {
      addSheet.open(add as AddMode);
      params.delete('add');
      setParams(params, { replace: true });
    }
  }, [params, setParams]);

  return (
    <>
      <Suspense
        fallback={
          <div className="flex min-h-dvh items-center justify-center text-label-2">
            <Spinner size={26} />
          </div>
        }
      >
        <Outlet />
      </Suspense>
      <TabBar onAdd={() => addSheet.open('fillup')} />
      <AddSheet />
      <Toaster />
      <UpdatePrompt />
    </>
  );
}
