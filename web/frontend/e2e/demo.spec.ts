import { expect, test } from '@playwright/test';

test.describe('live demo', () => {
  test('visitor can open the dashboard without logging in', async ({ page }) => {
    await page.goto('./');

    await expect(page.getByRole('complementary').getByText('Live Demo', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Docker 환경' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'prod-server', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'staging-api', exact: true })).toBeVisible();
    await expect(page.getByText('Docker 수집기 연결 대기')).toBeVisible();
  });

  test('visitor can inspect logs for a Docker service', async ({ page }) => {
    await page.goto('./');

    await page.getByRole('button', { name: 'prod-server', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'prod-server' })).toBeVisible();

    await page.getByRole('button', { name: 'api', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'api' })).toBeVisible();

    await page.getByRole('button', { name: '로그', exact: true }).click();
    await expect(page.getByText('Connection timeout to upstream: auth.internal:8080 after 5000ms')).toBeVisible();
  });
});
