import { presetFor, type ExpenseCategory, type FuelType } from '@fuel/shared';
import type { IconName } from '../components/ui/Icon';
import { hueVar, TONE } from '../lib/palette';

export const CATEGORY_META: Record<
  ExpenseCategory,
  { label: string; icon: IconName; color: string }
> = {
  service: { label: 'Service', icon: 'wrench', color: hueVar('blue') },
  tires: { label: 'Tires', icon: 'tire', color: hueVar('brown') },
  insurance: { label: 'Insurance', icon: 'shield', color: hueVar('green') },
  road_tax: { label: 'Road tax', icon: 'receipt', color: hueVar('purple') },
  kteo: { label: 'KTEO', icon: 'clipboard', color: hueVar('teal') },
  tolls: { label: 'Tolls', icon: 'road', color: hueVar('pink') },
  parking: { label: 'Parking', icon: 'parking', color: hueVar('indigo') },
  wash: { label: 'Car wash', icon: 'droplet', color: hueVar('cyan') },
  repair: { label: 'Repair', icon: 'hammer', color: hueVar('red') },
  other: { label: 'Other', icon: 'ellipsis', color: hueVar('gray') },
};

export const FUEL_LABEL: Record<FuelType, string> = {
  '95': 'Unleaded 95',
  '100': 'Unleaded 100',
  diesel: 'Diesel',
  lpg: 'LPG',
  other: 'Other',
};

export const FUEL_COLOR = hueVar(TONE.fuel);

/** Icon tile for a reminder: its preset's expense category, or a bell for custom ones. */
export function reminderIcon(type: string): { name: IconName; color: string } {
  const p = presetFor(type);
  if (!p) return { name: 'bell', color: hueVar(TONE.reminders) };
  const m = CATEGORY_META[p.category];
  return { name: m.icon, color: m.color };
}
