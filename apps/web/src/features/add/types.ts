import type { Car, Expense } from '@fuel/shared';

export interface FormHandle {
  /** Validate and save. Resolves false when validation failed (errors shown inline). */
  submit: () => Promise<boolean>;
  isDirty: () => boolean;
}

export interface SaveResult {
  message: string;
  undo: () => Promise<void>;
}

export interface FormProps<T> {
  cars: Car[];
  defaultCarId: string;
  editing: T | null;
  readOnly: boolean;
  onStatus: (s: { canSave: boolean; label: string }) => void;
  onDone: (r: SaveResult) => void;
  prefill?: Partial<Expense>;
}
