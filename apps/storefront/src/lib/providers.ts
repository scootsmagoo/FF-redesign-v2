import { env } from 'cloudflare:workers';
import { createProviders, type Providers } from '@ff/integrations';

let cached: Providers | undefined;

/** Payment/tax/shipping/email/address providers, selected by env vars (stubs by default). */
export function getProviders(): Providers {
  cached ??= createProviders(env as unknown as Parameters<typeof createProviders>[0]);
  return cached;
}
