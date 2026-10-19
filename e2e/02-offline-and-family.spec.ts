import { expect, test } from '@playwright/test';
import { ADMIN, MEMBER, addFillup, login } from './helpers';

test('admin adds a family member', async ({ page }) => {
  await login(page, ADMIN);
  await page.goto('/more/users');
  await page.getByRole('button', { name: 'Add family member' }).click();
  const sheet = page.getByRole('dialog', { name: 'Add family member' });
  await sheet.getByLabel('Name', { exact: true }).fill(MEMBER.name);
  await sheet.getByLabel('Username').fill(MEMBER.username);
  await sheet.getByLabel('Password').fill(MEMBER.password);
  await sheet.getByRole('button', { name: 'Add' }).click();
  await expect(page.getByText('@maria · Member')).toBeVisible();
});

test('a fill-up logged offline syncs when back online and reaches another family member', async ({
  browser,
}) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await login(page, MEMBER);
  // Let the service worker take control so the app can open offline.
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect(page.getByText('Synced')).toBeVisible();

  await ctx.setOffline(true);
  await addFillup(page, { trip: '455', liters: '30,1', cost: '53,90', station: 'Offline Station' });
  await expect(page.getByText(/1 waiting|1 change waiting/)).toBeVisible();

  // Reopen the app while still offline: the shell and the queued entry are still there.
  await page.reload();
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
  await page.getByRole('link', { name: 'History' }).click();
  await expect(page.getByText('Offline Station')).toBeVisible();

  // Back online → the outbox drains.
  await ctx.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.getByRole('link', { name: 'Home' }).click();
  await expect(page.getByText('Synced')).toBeVisible({ timeout: 15000 });
  await ctx.close();

  // Another family member sees it.
  const ctx2 = await browser.newContext();
  const page2 = await ctx2.newPage();
  await login(page2, ADMIN);
  await page2.getByRole('link', { name: 'History' }).click();
  await expect(page2.getByText('Offline Station')).toBeVisible();
  await expect(page2.getByText('Logged by Maria')).toBeVisible();
  await ctx2.close();
});

test("members can't edit records someone else logged", async ({ page }) => {
  await login(page, MEMBER);
  await page.getByRole('link', { name: 'History' }).click();
  await page.getByRole('button', { name: /Shell Kifisias/ }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByText('Only they or an admin can change it.')).toBeVisible();
  await expect(sheet.getByRole('button', { name: /^Save/ })).toHaveCount(0);
  await expect(sheet.getByRole('button', { name: /Delete/ })).toHaveCount(0);
});
