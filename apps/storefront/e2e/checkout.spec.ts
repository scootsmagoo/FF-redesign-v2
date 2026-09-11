import { expect, test } from '@playwright/test';
import { PRODUCT } from './fixtures';

/**
 * Guest order end to end: PDP → cart → addresses → shipping → review → payment → confirmation.
 * Places a real order on the target, so it only runs where payments are stubbed (the payment
 * page renders the `stub_ok` token). Every step is a plain form post, so it also proves the
 * no-JavaScript path.
 */
test.describe('guest checkout', () => {
  test.use({ javaScriptEnabled: false });

  test('places an order with the stub payment provider', async ({ page }) => {
    await page.goto(PRODUCT.path);
    await page.locator('form#buyForm button', { hasText: /add to cart/i }).click();
    await expect(page).toHaveURL(/\/cart/);
    await expect(page.locator('main h1')).toContainText(/1 Item in your Cart/i);
    await expect(page.locator('main').getByText(PRODUCT.sku).first()).toBeVisible();

    await page.goto('/checkout');
    const email = `e2e+${Date.now()}@example.com`;
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="shipping.firstName"]', 'Playwright');
    await page.fill('input[name="shipping.lastName"]', 'Tester');
    await page.fill('input[name="shipping.line1"]', '123 Test Street');
    await page.fill('input[name="shipping.city"]', 'Monroe');
    await page.selectOption('select[name="shipping.region"]', 'NC');
    await page.fill('input[name="shipping.postalCode"]', '28110');
    await page.fill('input[name="shipping.phone"]', '7045550100');
    await page.locator('form input[type="checkbox"][required]').check();
    await page.getByRole('button', { name: /continue to shipping method/i }).click();

    await expect(page).toHaveURL(/\/checkout\/shipping/);
    const rate = page.locator('input[name="rateId"]:not([disabled])').first();
    await rate.check();
    await page.getByRole('button', { name: /continue to review/i }).click();

    await expect(page).toHaveURL(/\/checkout\/review/);
    await expect(page.locator('main').getByText(PRODUCT.sku).first()).toBeVisible();
    await page.getByRole('link', { name: /continue to payment/i }).click();

    await expect(page).toHaveURL(/\/checkout\/payment/);
    const stub = page.locator('input[name="paymentToken"][value="stub_ok"]');
    test.skip((await stub.count()) === 0, 'payment provider is not the stub on this target; not placing a live order');
    await page.getByRole('button', { name: /place order/i }).click();

    await expect(page).toHaveURL(/\/checkout\/confirmation/);
    await expect(page.locator('main h1')).toContainText(/placed/i);
    await expect(page.locator('main').getByText(email)).toBeVisible();
    const number = await page.locator('main strong').filter({ hasText: /^FF[A-Z0-9]+$/ }).first().textContent();
    expect(number).toMatch(/^FF[A-Z0-9]{6,}$/);

    // Guest tracking with number + email finds the order.
    await page.goto(`/track-order?number=${number}&email=${encodeURIComponent(email)}`);
    await expect(page.locator('main').getByText(number!).first()).toBeVisible();
    await expect(page.locator('main').getByText(PRODUCT.sku).first()).toBeVisible();
  });
});
