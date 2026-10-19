import { expect, type Page } from '@playwright/test';

export const ADMIN = { name: 'Nikos', username: 'nikos', password: 'demo-pass-1' };
export const MEMBER = { name: 'Maria', username: 'maria', password: 'demo-pass-2' };

export async function login(page: Page, user: { username: string; password: string }) {
  await page.goto('/');
  await page.getByLabel('Username').fill(user.username);
  await page.getByLabel('Password').fill(user.password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
}

export async function addFillup(
  page: Page,
  v: { trip: string; liters: string; cost: string; station?: string },
) {
  await page.getByRole('button', { name: 'Add a fill-up or expense' }).click();
  const sheet = page.getByRole('dialog', { name: 'Add fill-up' });
  await expect(sheet).toBeVisible();
  await sheet.getByLabel('Trip').fill(v.trip);
  await sheet.getByLabel('Liters').fill(v.liters);
  await sheet.getByLabel('Total cost').fill(v.cost);
  if (v.station) await sheet.getByLabel('Station').fill(v.station);
  await sheet.getByRole('button', { name: /^Save/ }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Fill-up saved' })).toBeVisible();
  await expect(sheet).toBeHidden();
}
