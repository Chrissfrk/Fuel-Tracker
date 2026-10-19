import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
import type { Car, Expense, Fillup, Me, OdometerReading } from '@fuel/shared';
import { useCars } from '../data/hooks';
import type { CarSelection } from '../components/ui/CarSwitcher';

export const MeContext = createContext<Me | null>(null);

export function useMe(): Me {
  const me = useContext(MeContext);
  if (!me) throw new Error('useMe outside of the signed-in app');
  return me;
}

export const isAdmin = (me: Me) => me.role === 'admin';
/** Members may change what they logged; admins may change anything. */
export const canEditRecord = (me: Me, r: { createdBy: string }) =>
  me.role === 'admin' || r.createdBy === me.id;

// ---------- Selected car (remembered per user) ----------

const selListeners = new Set<() => void>();
const selKey = (userId: string) => `fuel:lastCar:${userId}`;

function readSel(userId: string): string | null {
  try {
    return localStorage.getItem(selKey(userId));
  } catch {
    return null;
  }
}

export function useCarSelection() {
  const me = useMe();
  const cars = useCars();
  const stored = useSyncExternalStore(
    (l) => {
      selListeners.add(l);
      return () => selListeners.delete(l);
    },
    () => readSel(me.id),
  );

  const selection: CarSelection | null = useMemo(() => {
    if (cars.length === 0) return null;
    if (stored === 'all' && cars.length > 1) return 'all';
    if (stored && cars.some((c) => c.id === stored)) return stored;
    if (me.defaultCarId && cars.some((c) => c.id === me.defaultCarId)) return me.defaultCarId;
    return cars[0]!.id;
  }, [cars, stored, me.defaultCarId]);

  const setSelection = (v: CarSelection) => {
    try {
      localStorage.setItem(selKey(me.id), v);
    } catch {
      /* ignore */
    }
    selListeners.forEach((l) => l());
  };

  const selectedCars: Car[] = useMemo(
    () => (selection === 'all' ? cars : cars.filter((c) => c.id === selection)),
    [cars, selection],
  );
  const carIds = useMemo(() => selectedCars.map((c) => c.id), [selectedCars]);
  /** The single car for car-specific actions (adding a fill-up), even in "All cars" view. */
  const primaryCar: Car | null =
    selection === 'all' ? (cars[0] ?? null) : (selectedCars[0] ?? null);
  return { cars, selection, setSelection, selectedCars, carIds, primaryCar };
}

// ---------- Add / edit sheet controller ----------

export type AddMode = 'fillup' | 'expense' | 'odometer';
export type Editing =
  | { kind: 'fillup'; record: Fillup }
  | { kind: 'expense'; record: Expense }
  | { kind: 'odometer'; record: OdometerReading };

export interface AddSheetState {
  open: boolean;
  mode: AddMode;
  editing: Editing | null;
  /** Prefill (e.g. from "mark reminder done"). */
  prefill?: Partial<Expense>;
}

let sheet: AddSheetState = { open: false, mode: 'fillup', editing: null };
const sheetListeners = new Set<() => void>();
const setSheet = (s: AddSheetState) => {
  sheet = s;
  sheetListeners.forEach((l) => l());
};

export const addSheet = {
  open(mode: AddMode = 'fillup', prefill?: Partial<Expense>) {
    setSheet({ open: true, mode, editing: null, prefill });
  },
  edit(editing: Editing) {
    setSheet({ open: true, mode: editing.kind, editing });
  },
  close() {
    setSheet({ ...sheet, open: false });
  },
  setMode(mode: AddMode) {
    setSheet({ ...sheet, mode });
  },
};

export const useAddSheet = () =>
  useSyncExternalStore(
    (l) => {
      sheetListeners.add(l);
      return () => sheetListeners.delete(l);
    },
    () => sheet,
  );

/**
 * A car id held in form state that falls back to a sensible default once cars have loaded
 * (local data arrives asynchronously, so the first render may have no cars yet).
 */
export function useCarIdState(initial: string | null | undefined) {
  const { cars, primaryCar } = useCarSelection();
  const [carId, setCarId] = useState(initial ?? '');
  const valid = cars.some((c) => c.id === carId);
  useEffect(() => {
    if (!valid && cars.length > 0 && !initial) setCarId(primaryCar?.id ?? cars[0]!.id);
  }, [valid, cars, primaryCar, initial]);
  return [carId, setCarId] as const;
}
