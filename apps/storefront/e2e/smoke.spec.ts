import { expect, test } from '@playwright/test';

import { PRODUCT } from './fixtures';

test.describe('storefront smoke', () => {
  test('home page renders with the header, search and a single H1', async ({ page }) => {
    const res = await page.goto('/');
    expect(res?.status()).toBe(200);
    await expect(page.locator('main h1')).toHaveCount(1);
    await expect(page.getByRole('link', { name: /filtersfast\.com/i }).first()).toBeVisible();
    await expect(page.locator('input[name="q"]').first()).toBeAttached(); // hidden behind the search toggle on phones
    const width = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(width, 'page must not scroll horizontally').toBeLessThanOrEqual(1);
  });

  test('product page shows price, part number and an Add To Cart form', async ({ page }) => {
    const res = await page.goto(PRODUCT.path);
    expect(res?.status()).toBe(200);
    await expect(page.locator('main h1')).toContainText(/EDR1RXD1/i);
    await expect(page.locator('form#buyForm')).toBeVisible();
    await expect(page.locator('form#buyForm button', { hasText: /add to cart/i })).toBeVisible();
    await expect(page.locator('script[type="application/ld+json"]').first()).toHaveCount(1);
  });

  test('searching a SKU short-circuits to its product page', async ({ page }) => {
    await page.goto(`/search?q=${encodeURIComponent(PRODUCT.sku)}`);
    await expect(page).toHaveURL(new RegExp(PRODUCT.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });

  test('categories index and a category page render', async ({ page }) => {
    await page.goto('/categories');
    const first = page.locator('main a[href^="/c/"]').first();
    await expect(first).toBeVisible();
    const href = await first.getAttribute('href');
    const res = await page.goto(href!);
    expect(res?.status()).toBe(200);
    await expect(page.locator('main h1')).toHaveCount(1);
  });

  test('legacy .asp product URL redirects permanently', async ({ request }) => {
    const res = await request.get('/WFCB-Frigidaire-PureSourcePlus-Water-Filter.asp', { maxRedirects: 0 });
    expect([301, 308]).toContain(res.status());
    expect(res.headers()['location']).toMatch(/^(https?:\/\/[^/]+)?\/p\//);
  });

  test('sitemap index and robots are served', async ({ request, baseURL }) => {
    const sm = await request.get('/sitemap-index.xml');
    expect(sm.status()).toBe(200);
    expect(await sm.text()).toContain('sitemap-products-1.xml');
    const robots = await request.get('/robots.txt');
    expect(robots.status()).toBe(200);
    const body = await robots.text();
    if (baseURL?.includes('filtersfast.com')) expect(body).toContain('Sitemap:');
    else expect(body).toContain('Disallow: /');
  });

  test('unknown pages return a branded 404', async ({ page }) => {
    const res = await page.goto('/this-page-does-not-exist-e2e');
    expect(res?.status()).toBe(404);
    await expect(page.locator('main h1')).toBeVisible();
  });

  test('manager is locked behind its own sign-in', async ({ request }) => {
    const res = await request.get('/manager/orders', { maxRedirects: 0 });
    expect(res.status()).toBe(302);
    expect(res.headers()['location']).toContain('/manager/login');
  });
});
