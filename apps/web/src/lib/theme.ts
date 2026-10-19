import { useEffect, useState, useSyncExternalStore } from 'react';

export type ThemePref = 'system' | 'light' | 'dark';
const KEY = 'fuel:theme';
const listeners = new Set<() => void>();

export function getThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

export function setThemePref(pref: ThemePref) {
  try {
    if (pref === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch {
    /* ignore */
  }
  const root = document.documentElement;
  if (pref === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', pref);
  listeners.forEach((l) => l());
}

export const useThemePref = () =>
  useSyncExternalStore((l) => {
    listeners.add(l);
    return () => listeners.delete(l);
  }, getThemePref);

/** Effective theme after applying the system preference. */
export function useIsDark(): boolean {
  const pref = useThemePref();
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const on = () => setSystemDark(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return pref === 'dark' || (pref === 'system' && systemDark);
}

/** Read the current value of a CSS custom property (for canvas-drawn charts). */
export const cssVar = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/**
 * Categorical series palette (validated for CVD separation in light and dark; order matters).
 * Car colours are picked from these slots, so a car keeps one identity in the switcher and in
 * every chart. Each light slot has a dark-mode step of the same hue.
 */
export const SERIES_LIGHT = [
  '#2a78d6',
  '#eb6834',
  '#1baf7a',
  '#eda100',
  '#e87ba4',
  '#008300',
  '#6250d6',
  '#e34948',
] as const;
export const SERIES_DARK = [
  '#3987e5',
  '#d95926',
  '#199e70',
  '#c98500',
  '#d55181',
  '#008300',
  '#9085e9',
  '#e66767',
] as const;

export const CAR_COLORS = SERIES_LIGHT;

export const carColor = (car: { color: string | null } | undefined, index = 0) =>
  car?.color ?? CAR_COLORS[index % CAR_COLORS.length]!;

/** The mode-appropriate step for a series colour (unknown custom colours pass through). */
export function seriesColor(hex: string, dark: boolean): string {
  if (!dark) return hex;
  const i = SERIES_LIGHT.findIndex((c) => c.toLowerCase() === hex.toLowerCase());
  return i >= 0 ? SERIES_DARK[i]! : hex;
}
