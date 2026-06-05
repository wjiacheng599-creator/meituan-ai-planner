import { expect, test } from '@playwright/test';

test('loads the planner shell', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/美团AI规划师/);
  await expect(page.locator('#root')).toBeAttached();
});
