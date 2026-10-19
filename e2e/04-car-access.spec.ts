import { expect, test } from '@playwright/test';
import { ADMIN, MEMBER, addFillup, login } from './helpers';

test('an admin can limit a car; the member no longer sees it or its records', async ({
  browser,
}) => {
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await login(admin, ADMIN);
  await admin.goto('/more/cars/new');
  await admin.getByLabel('Name', { exact: true }).fill('Octavia');
  await admin.getByLabel('Tank size').fill('50');
  await admin.getByLabel('Start odometer').fill('118000');
  await admin.getByRole('button', { name: 'Save' }).click();
  await admin.getByRole('link', { name: /Octavia/ }).click();
  const toggle = admin.getByRole('switch', { name: 'Maria can use Octavia' });
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await expect(admin.getByText(/Only the people switched on/)).toBeVisible();

  // Log a fill-up for Octavia as admin.
  await admin.goto('/');
  await admin
    .getByRole('button', { name: /Polo|Octavia/ })
    .first()
    .click();
  await admin.getByRole('menuitemradio', { name: /Octavia/ }).click();
  await addFillup(admin, { trip: '700', liters: '38', cost: '60', station: 'Secret Station' });
  await adminCtx.close();

  const memberCtx = await browser.newContext();
  const member = await memberCtx.newPage();
  await login(member, MEMBER);
  await member.getByRole('link', { name: 'History' }).click();
  await expect(member.getByText('Offline Station')).toBeVisible();
  await expect(member.getByText('Secret Station')).toHaveCount(0);
  await member.goto('/more/cars');
  await expect(member.getByRole('link', { name: /Polo/ })).toBeVisible();
  await expect(member.getByRole('link', { name: /Octavia/ })).toHaveCount(0);
  await memberCtx.close();
});
