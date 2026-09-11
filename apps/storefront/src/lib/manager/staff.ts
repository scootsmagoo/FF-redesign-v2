import { eq } from 'drizzle-orm';
import { salesCodes } from '@ff/db';
import { getDb } from '../db';

/** Sales-person codes (legacy custom_sales_code). Define the code in NAV before adding it here. */

export async function listSalesCodes(includeInactive = false) {
  const db = getDb();
  const rows = await db.select().from(salesCodes).orderBy(salesCodes.name);
  return includeInactive ? rows : rows.filter((r) => r.active);
}

export async function saveSalesCode(input: { id?: number | null; name: string; code: string; active?: boolean }): Promise<number> {
  const db = getDb();
  const name = input.name.trim();
  const code = input.code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  if (!name) throw new Error('Employee name is required.');
  if (!code) throw new Error('Sales code is required (letters and numbers).');
  const dup = await db.select({ id: salesCodes.id }).from(salesCodes).where(eq(salesCodes.code, code)).limit(1);
  if (dup[0] && dup[0].id !== input.id) throw new Error(`Sales code ${code} already exists.`);
  if (input.id) {
    await db.update(salesCodes).set({ name, code, active: input.active ?? true }).where(eq(salesCodes.id, input.id));
    return input.id;
  }
  const [row] = await db.insert(salesCodes).values({ name, code, active: true }).returning({ id: salesCodes.id });
  return row!.id;
}

/** Soft delete, as the legacy page did: orders keep referencing the code. */
export async function deactivateSalesCode(id: number): Promise<void> {
  await getDb().update(salesCodes).set({ active: false }).where(eq(salesCodes.id, id));
}
