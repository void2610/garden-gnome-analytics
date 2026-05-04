import { expect, test } from '@playwright/test';

test.describe('SortableTable 実機テスト', () => {
  test('ラン一覧: ヘッダクリックで行数が変わらない', async ({ page }) => {
    await page.goto('runs');
    await page.waitForSelector('table tbody tr', { timeout: 30_000 });
    const before = await page.locator('table tbody tr').count();
    expect(before).toBeGreaterThan(0);
    const headerButtons = page.locator('table thead button');
    const count = await headerButtons.count();
    for (let i = 0; i < 5; i++) {
      await headerButtons.nth(i % count).click();
      await page.waitForTimeout(80);
      expect(await page.locator('table tbody tr').count()).toBe(before);
    }
  });

  test('ステージ分析: ヘッダクリックで行数が変わらない', async ({ page }) => {
    await page.goto('stages');
    await page.waitForSelector('table tbody tr', { timeout: 30_000 });
    const before = await page.locator('table tbody tr').count();
    expect(before).toBeGreaterThan(0);
    const headerButtons = page.locator('table thead button');
    const count = await headerButtons.count();
    for (let i = 0; i < 5; i++) {
      await headerButtons.nth(i % count).click();
      await page.waitForTimeout(80);
      expect(await page.locator('table tbody tr').count()).toBe(before);
    }
  });

  test('エラー: ヘッダクリックで行数が変わらない', async ({ page }) => {
    await page.goto('errors');
    await page.waitForSelector('table tbody tr', { timeout: 30_000 });
    const before = await page.locator('table tbody tr').count();
    expect(before).toBeGreaterThan(0);
    const headerButtons = page.locator('table thead button');
    const count = await headerButtons.count();
    for (let i = 0; i < 5; i++) {
      await headerButtons.nth(i % count).click();
      await page.waitForTimeout(80);
      expect(await page.locator('table tbody tr').count()).toBe(before);
    }
  });

  // カード分析はタブ切替えがあり、初期画面ではヘッダ button が複数 tab 分マウントされて
  // 不可視ボタンへの click が当たるためスキップ。SortableTable 自体の検証は他で網羅。
});
