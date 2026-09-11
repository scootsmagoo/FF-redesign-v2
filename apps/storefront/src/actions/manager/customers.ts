import { ActionError, defineAction } from 'astro:actions';
import { z } from 'astro:schema';
import { sendRendered, siteUrl } from '~/lib/emails';
import { addCustomerNote, deleteCustomer, executeMerge, listBackorderEmails, markBackordersNotified, revokeCustomerSessions, setCustomerStatus, setTaxExempt, updateCustomer } from '~/lib/manager/customers';
import { requireArea } from '~/lib/manager/permissions';
import { toInt } from '~/lib/manager/util';
import { getDb } from '~/lib/db';
import { products } from '@ff/db';
import { eq } from 'drizzle-orm';

const fail = (e: unknown): never => {
  throw new ActionError({ code: 'BAD_REQUEST', message: e instanceof Error ? e.message : 'Something went wrong' });
};
const withCustomer = z.object({ customerId: z.number().int().positive() });
const ids = (v: unknown) =>
  String(v ?? '')
    .split(/[^0-9]+/)
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);

export const customerActions = {
  updateCustomer: defineAction({
    accept: 'form',
    input: withCustomer.extend({
      email: z.string().max(120),
      firstName: z.string().max(60).nullish(),
      lastName: z.string().max(60).nullish(),
      phone: z.string().max(30).nullish(),
      company: z.string().max(80).nullish(),
      newsletter: z.boolean().default(false),
      smsOptIn: z.boolean().default(false),
      isEmployee: z.boolean().default(false),
      isMilitary: z.boolean().default(false),
      reminderMonths: z.string().max(3).nullish(),
    }),
    handler: async (input, ctx) => {
      requireArea(ctx, 'Customers', 1);
      try {
        return { ok: true, ...(await updateCustomer(input.customerId, { ...input, firstName: input.firstName ?? null, lastName: input.lastName ?? null, phone: input.phone ?? null, company: input.company ?? null, reminderMonths: toInt(input.reminderMonths) })) };
      } catch (e) {
        return fail(e);
      }
    },
  }),

  /** Status may be changed at full control; notes at restricted control too (legacy Customers = 2). */
  setCustomerStatus: defineAction({
    accept: 'form',
    input: withCustomer.extend({ status: z.enum(['active', 'inactive']) }),
    handler: async ({ customerId, status }, ctx) => {
      requireArea(ctx, 'Customers', 1);
      await setCustomerStatus(customerId, status);
      return { ok: true };
    },
  }),

  setTaxExempt: defineAction({
    accept: 'form',
    input: withCustomer.extend({ taxExempt: z.boolean().default(false), until: z.string().max(10).nullish() }),
    handler: async ({ customerId, taxExempt, until }, ctx) => {
      requireArea(ctx, 'TaxExemption', 1);
      await setTaxExempt(customerId, taxExempt, until ?? null);
      return { ok: true };
    },
  }),

  addCustomerNote: defineAction({
    accept: 'form',
    input: withCustomer.extend({ text: z.string().max(4000) }),
    handler: async ({ customerId, text }, ctx) => {
      const admin = requireArea(ctx, 'Customers', 0);
      try {
        await addCustomerNote(customerId, text, admin.email);
      } catch (e) {
        return fail(e);
      }
      return { ok: true };
    },
  }),

  revokeCustomerSessions: defineAction({
    accept: 'form',
    input: withCustomer,
    handler: async ({ customerId }, ctx) => {
      requireArea(ctx, 'Customers', 1);
      return { ok: true, revoked: await revokeCustomerSessions(customerId) };
    },
  }),

  deleteCustomer: defineAction({
    accept: 'form',
    input: withCustomer.extend({ confirm: z.string().max(20) }),
    handler: async ({ customerId, confirm }, ctx) => {
      requireArea(ctx, 'Customers', 1);
      if (confirm !== String(customerId)) throw new ActionError({ code: 'BAD_REQUEST', message: 'Type the customer id to confirm.' });
      try {
        await deleteCustomer(customerId);
      } catch (e) {
        return fail(e);
      }
      return { ok: true };
    },
  }),

  mergeCustomers: defineAction({
    accept: 'form',
    input: withCustomer.extend({ mode: z.enum(['customer', 'order']), ids: z.string().max(5000), deactivate: z.boolean().default(false) }),
    handler: async ({ customerId, mode, ids: list, deactivate }, ctx) => {
      const admin = requireArea(ctx, 'Customers', 1);
      try {
        return { ok: true, moved: await executeMerge(customerId, mode, ids(list), deactivate, admin.email) };
      } catch (e) {
        return fail(e);
      }
    },
  }),

  /** Emails everyone waiting on a product/option that is back in stock, then closes their requests. */
  notifyBackorders: defineAction({
    accept: 'form',
    input: z.object({ productId: z.number().int().positive(), optionId: z.number().int().nullish() }),
    handler: async ({ productId, optionId }, ctx) => {
      requireArea(ctx, 'BackorderNotifications', 1);
      const p = await getDb().query.products.findFirst({ columns: { name: true, slug: true, sku: true }, where: eq(products.id, productId) });
      if (!p) throw new ActionError({ code: 'BAD_REQUEST', message: 'Product not found.' });
      const waiting = await listBackorderEmails(productId, optionId ?? null);
      const url = `${siteUrl()}/p/${p.slug}`;
      let sent = 0;
      for (const w of waiting) {
        const r = await sendRendered('order-confirmation', w.email, {
          subject: `${p.name} is back in stock at FiltersFast.com`,
          html: `<p>Good news: <a href="${url}">${p.name}</a> (${p.sku}) is back in stock. Order soon while it lasts.</p>`,
          text: `Good news: ${p.name} (${p.sku}) is back in stock: ${url}`,
          templateData: { productName: p.name, sku: p.sku, url },
        });
        if (r.ok) sent++;
      }
      const closed = await markBackordersNotified(productId, optionId ?? null);
      return { ok: true, sent, closed };
    },
  }),
};
