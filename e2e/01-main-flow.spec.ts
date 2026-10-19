import { expect, test } from '@playwright/test';
import { ADMIN, addFillup } from './helpers';

test('first run: set up, add a car, log a fill-up, see it in history and the monthly view', async ({
  page,
}) => {
  await page.goto('/');

  // First-run setup creates the admin.
  await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible();
  await page.getByLabel('Your name').fill(ADMIN.name);
  await page.getByLabel('Username').fill(ADMIN.username);
  await page.getByLabel('Password').fill(ADMIN.password);
  await page.getByRole('button', { name: 'Create admin account' }).click();

  // Add a car.
  await page.getByRole('button', { name: 'Add your first car' }).click();
  await page.getByLabel('Name', { exact: true }).fill('Polo');
  await page.getByLabel('Tank size').fill('40');
  await page.getByLabel('Start odometer').fill('62000');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('link', { name: /Polo/ })).toBeVisible();

  // Log a fill-up with Greek decimal commas; €/L is calculated live.
  await page.getByRole('link', { name: 'Home' }).click();
  await page.getByRole('button', { name: 'Add a fill-up or expense' }).click();
  const sheet = page.getByRole('dialog', { name: 'Add fill-up' });
  await sheet.getByLabel('Trip').fill('612');
  await sheet.getByLabel('Liters').fill('41,2');
  await sheet.getByLabel('Total cost').fill('72,50');
  await expect(sheet.getByText('1,760 €/L')).toBeVisible();
  await sheet.getByLabel('Station').fill('Shell Kifisias');
  await sheet.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Fill-up saved' })).toBeVisible();

  // Dashboard reflects it.
  await expect(page.getByText('72,50 €').first()).toBeVisible();
  await expect(page.getByText('612 km').first()).toBeVisible();

  // History shows it with who logged it.
  await page.getByRole('link', { name: 'History' }).click();
  await expect(page.getByText('Shell Kifisias')).toBeVisible();
  await expect(page.getByText('Logged by Nikos')).toBeVisible();

  // Monthly view has the month row.
  await page.getByRole('link', { name: 'Stats' }).click();
  const table = page.getByRole('table');
  await expect(table).toBeVisible();
  const row = table.getByRole('row').nth(1);
  await expect(row).toContainText('612 km');
  await expect(row).toContainText('72,50 €');

  // A second, implausible fill-up shows a gentle warning but can still be saved.
  await page.getByRole('button', { name: 'Add a fill-up or expense' }).click();
  await sheet.getByLabel('Trip').fill('500');
  await sheet.getByLabel('Liters').fill('412');
  await sheet.getByLabel('Total cost').fill('700');
  await expect(sheet.getByText(/a lot more than your tank holds/)).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Save anyway' })).toBeEnabled();
  page.once('dialog', (d) => void d.accept());
  await sheet.getByRole('button', { name: 'Cancel' }).click();
  await expect(sheet).toBeHidden();

  await addFillup(page, { trip: '580', liters: '38,4', cost: '68,10', station: 'BP Marousi' });
});
