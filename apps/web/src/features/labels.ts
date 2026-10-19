import type { ExpenseCategory, FuelType } from '@fuel/shared';
import type { IconName } from '../components/ui/Icon';

export const CATEGORY_META: Record<
  ExpenseCategory,
  { label: string; icon: IconName; color: string }
> = {
  service: { label: 'Service', icon: 'wrench', color: '#0a84ff' },
  tires: { label: 'Tires', icon: 'tire', color: '#636366' },
  insurance: { label: 'Insurance', icon: 'shield', color: '#30a14e' },
  road_tax: { label: 'Road tax', icon: 'receipt', color: '#8e5bd8' },
  kteo: { label: 'KTEO', icon: 'clipboard', color: '#0fa5a5' },
  tolls: { label: 'Tolls', icon: 'road', color: '#f08c00' },
  parking: { label: 'Parking', icon: 'parking', color: '#5e5ce6' },
  wash: { label: 'Car wash', icon: 'droplet', color: '#32ade6' },
  repair: { label: 'Repair', icon: 'hammer', color: '#e5484d' },
  other: { label: 'Other', icon: 'ellipsis', color: '#8e8e93' },
};

export const FUEL_LABEL: Record<FuelType, string> = {
  '95': 'Unleaded 95',
  '100': 'Unleaded 100',
  diesel: 'Diesel',
  lpg: 'LPG',
  other: 'Other',
};

export const FUEL_COLOR = '#ff9f0a';
