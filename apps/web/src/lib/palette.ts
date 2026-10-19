import type { CSSProperties } from 'react';

/**
 * UI hues (CSS tokens in index.css). Each has a fill step (`--x`) for icons and marks and an
 * AA text step (`--x-text`). Charts use the validated series palette in theme.ts instead.
 */
export type Hue =
  | 'blue'
  | 'indigo'
  | 'purple'
  | 'pink'
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'teal'
  | 'cyan'
  | 'brown'
  | 'gray';

export const hueVar = (h: Hue) => `var(--${h})`;
export const hueText = (h: Hue) => `var(--${h}-text)`;

/** Meaning → hue, used the same way on every screen (cards, icons, chart headers). */
export const TONE = {
  fuel: 'orange',
  distance: 'blue',
  economy: 'teal',
  price: 'indigo',
  cost: 'pink',
  odometer: 'cyan',
  budget: 'green',
  reminders: 'orange',
} as const satisfies Record<string, Hue>;

/** Ambient page tint for each section (matches the section's icon on the More tab). */
export const SECTION_HUE: [prefix: string, hue: Hue][] = [
  ['/more/cars', 'blue'],
  ['/more/reminders', 'orange'],
  ['/more/budget', 'green'],
  ['/more/data', 'indigo'],
  ['/more/paste', 'purple'],
  ['/more/users', 'pink'],
  ['/more/settings', 'gray'],
  ['/more', 'blue'],
  ['/history', 'indigo'],
  ['/stats', 'purple'],
];

/** Inline style that sets the tone variables used by `.tone-card` / `.tone-icon` / `.icon-tile`. */
export function toneStyle(color: string, text?: string): CSSProperties {
  return { '--h': color, '--ht': text ?? color } as CSSProperties;
}
export const hueStyle = (h: Hue) => toneStyle(hueVar(h), hueText(h));

/** A stable hue per person, for avatars (only hues that keep white initials >= 3:1). */
const AVATAR_HUES: Hue[] = ['blue', 'pink', 'indigo', 'purple'];
export function avatarHue(seed: string): Hue {
  let n = 0;
  for (const ch of seed) n = (n * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_HUES[n % AVATAR_HUES.length]!;
}
