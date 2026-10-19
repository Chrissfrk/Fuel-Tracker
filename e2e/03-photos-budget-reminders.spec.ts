import { expect, test } from '@playwright/test';
import { ADMIN, login } from './helpers';

// 2×2 red PNG
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==',
  'base64',
);

test('expense with a receipt photo uploads and displays', async ({ page }) => {
  await login(page, ADMIN);
  await page.getByRole('button', { name: 'Add a fill-up or expense' }).click();
  const sheet = page.getByRole('dialog', { name: 'Add fill-up' });
  await sheet.getByRole('radio', { name: 'Expense' }).click();
  const exp = page.getByRole('dialog', { name: 'Add expense' });
  await exp.getByRole('radio', { name: 'Car wash' }).click();
  await exp.getByLabel('Amount').fill('12');
  await exp
    .locator('input[type=file]')
    .setInputFiles({ name: 'receipt.png', mimeType: 'image/png', buffer: PNG });
  await expect(exp.getByRole('img', { name: 'Receipt preview' })).toBeVisible();
  const upload = page.waitForResponse(
    (r) => r.url().includes('/api/photos/') && r.request().method() === 'PUT',
  );
  await exp.getByRole('button', { name: 'Save', exact: true }).click();
  expect((await upload).status()).toBe(201);

  await page.getByRole('link', { name: 'History' }).click();
  await page.getByRole('button', { name: /Car wash/ }).click();
  const edit = page.getByRole('dialog', { name: 'Edit expense' });
  await expect(edit.getByRole('button', { name: 'View receipt photo' })).toBeVisible();
  await edit.getByRole('button', { name: 'View receipt photo' }).click();
  await expect(
    page.getByRole('dialog', { name: 'Receipt photo' }).getByRole('img', { name: 'Receipt' }),
  ).toBeVisible();
});

test('budget ring shows progress against the monthly budget', async ({ page }) => {
  await login(page, ADMIN);
  await page.goto('/more/budget');
  await page.getByLabel('Polo').fill('100');
  await page.getByRole('button', { name: 'Save budgets' }).click();
  await page.getByRole('link', { name: 'Home' }).click();
  // 3 fill-ups + wash this month are well over 100 €.
  await expect(page.getByText('Over budget')).toBeVisible();
});

test('a reminder can be added from a preset and marked done', async ({ page }) => {
  await login(page, ADMIN);
  await page.goto('/more/reminders');
  await page.getByRole('button', { name: 'Add a reminder' }).click();
  await page.getByRole('button', { name: /Oil & filter change/ }).click();
  await page.getByLabel('At').fill('50000'); // start was 62.000 km → overdue
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('link', { name: /Oil & filter change.*Overdue/ })).toBeVisible();

  await page.getByRole('link', { name: /Oil & filter change/ }).click();
  await page.getByRole('button', { name: 'Mark done' }).click();
  const done = page.getByRole('dialog', { name: 'Mark done' });
  await done.getByLabel('Amount').fill('89');
  await done.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('link', { name: /Oil & filter change.*OK/ })).toBeVisible();

  await page.getByRole('link', { name: 'History' }).click();
  await expect(page.getByRole('button', { name: /Service.*89,00 €/ })).toBeVisible();
});
