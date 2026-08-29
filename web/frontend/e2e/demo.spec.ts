import { expect, test } from '@playwright/test';

test.describe('live demo', () => {
  test('visitor can open the dashboard without logging in', async ({ page }) => {
    await page.goto('./');

    await expect(page.getByRole('complementary').getByText('Live Demo', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: '모니터링 개요' })).toBeVisible();
    await expect(page.getByRole('region', { name: '수집 상태 요약' })).toBeVisible();
    await expect(page.getByText('1개 장애 신호')).toBeVisible();
    await expect(page.getByRole('heading', { name: '현재 확인 필요' })).toBeVisible();
  });

  test('visitor can inspect logs for a Docker service', async ({ page }) => {
    await page.goto('./');

    await page.getByRole('link', { name: 'Docker 환경', exact: true }).click();
    await page.getByRole('button', { name: 'prod-server', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'prod-server' })).toBeVisible();

    await page.getByRole('button', { name: 'api', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'api' })).toBeVisible();

    await page.getByRole('tab', { name: '로그', exact: true }).click();
    await expect(page.getByText('Connection timeout to upstream: auth.internal:8080 after 5000ms')).toBeVisible();
  });

  test('mobile keeps the primary destinations in the bottom navigation', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('./');

    await expect(page.getByRole('button', { name: '데모 시나리오' })).toBeVisible();
    await expect(page.getByRole('link', { name: '개요', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Projects', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: '알림', exact: true })).toBeVisible();
    await page.getByRole('link', { name: '더보기', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: '더보기' })).toBeVisible();
  });

  test('empty scenario explains how to start monitoring', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('button', { name: '데모 시나리오' }).click();
    await expect(page.getByRole('listbox')).toBeVisible();
    await page.getByRole('option', { name: '첫 시작' }).click();

    await expect(page.getByText('아직 모니터링 대상이 없습니다')).toBeVisible();
    await expect(page.locator('section').filter({ hasText: '아직 모니터링 대상이 없습니다' }).getByRole('button', { name: '모니터링 시작', exact: true })).toBeVisible();
  });

  test('normal scenario shows that no action is needed', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('button', { name: '데모 시나리오' }).click();
    await page.getByRole('option', { name: '정상 운영' }).click();

    await expect(page.getByText('현재 확인이 필요한 이상이 없습니다')).toBeVisible();
  });

  test('partial failure preserves successful overview regions', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('button', { name: '데모 시나리오' }).click();
    await page.getByRole('option', { name: '부분 수집 실패' }).click();

    await expect(page.getByText('일부 모니터링 정보를 불러오지 못했습니다')).toBeVisible();
    await expect(page.getByRole('region', { name: '수집 상태 요약' })).toBeVisible();
    await expect(page.getByText('Docker 수집기', { exact: true })).toBeVisible();
  });
});
