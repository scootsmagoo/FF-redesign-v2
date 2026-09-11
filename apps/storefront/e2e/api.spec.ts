import { expect, test } from '@playwright/test';
import { PRODUCT } from './fixtures';

test.describe('inbound endpoints', () => {
  test('Ordergroove price API answers the legacy form payload and GET', async ({ request }) => {
    const post = await request.post('/api/ordergroove/price', { form: { json: JSON.stringify({ item: { product: String(PRODUCT.id), quantity: 1 } }) } });
    expect(post.status()).toBe(200);
    expect(post.headers()['access-control-allow-origin']).toBe('*');
    const body = (await post.json()) as { price: string };
    expect(body.price).toMatch(/^\d+\.\d{2}$/);
    const get = await request.get(`/api/ordergroove/price?product=${PRODUCT.id}&quantity=2`);
    expect(get.status()).toBe(200);
    const bad = await request.get('/api/ordergroove/price?product=abc');
    expect(bad.status()).toBe(400);
  });

  test('Ordergroove order insertion rejects bad credentials with the legacy XML envelope', async ({ request }) => {
    const res = await request.post('/api/ordergroove/orders', { form: { username: 'nobody', password: 'wrong', xml: '<order><head><orderOgId>1</orderOgId></head></order>' } });
    expect(res.status()).toBe(401);
    const text = await res.text();
    expect(text).toContain('<code>ERROR</code>');
    expect(text).toContain('<errorCode>AUTH</errorCode>');
  });

  test('WMS ship-confirm requires the automation token', async ({ request }) => {
    const res = await request.get('/api/automation/ship-confirm?idorder=1&tracking=9400111899223197428490');
    expect(res.status()).toBe(401);
    expect(await res.json()).toEqual({ ok: false, error: 'Unauthorized' });
  });

  test('refrigerator finder API is CORS-open and lists brands', async ({ request }) => {
    const res = await request.get('/api/refrigerator-finder');
    expect(res.status()).toBe(200);
    expect(res.headers()['access-control-allow-origin']).toBe('*');
    const body = (await res.json()) as { step: string; options: unknown[] };
    expect(body.step).toBe('brand');
    expect(body.options.length).toBeGreaterThan(0);
  });

  test('cross-site form posts to pages are refused, API form posts are not', async ({ request }) => {
    const page = await request.post('/cart?_action=cart.applyPromo', { form: { code: 'X' }, maxRedirects: 0 });
    expect(page.status()).toBe(403);
    const api = await request.post('/api/ordergroove/price', { form: { json: '{"item":{"product":"1"}}' } });
    expect(api.status()).not.toBe(403);
  });
});
