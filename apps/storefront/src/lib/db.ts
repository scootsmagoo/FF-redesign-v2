import { env } from 'cloudflare:workers';
import { createDb, type Db } from '@ff/db';

let cached: Db | undefined;

/** Drizzle handle on the D1 binding. One instance per isolate is fine. */
export function getDb(): Db {
  cached ??= createDb(env.DB);
  return cached;
}
