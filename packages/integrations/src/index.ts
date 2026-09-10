import { PassthroughAddressValidator } from './address/passthrough';
import { ConsoleEmailProvider } from './email/console';
import { StubPaymentProvider } from './payments/stub';
import { StubShippingProvider } from './shipping/stub';
import { StubTaxProvider } from './tax/stub';
import type { Providers } from './types';

export * from './types';
export { PassthroughAddressValidator, ConsoleEmailProvider, StubPaymentProvider, StubShippingProvider, StubTaxProvider };

/** Subset of the Worker env that selects and configures providers. */
export interface ProviderEnv {
  PAYMENT_PROVIDER?: string;
  TAX_PROVIDER?: string;
  SHIPPING_PROVIDER?: string;
  EMAIL_PROVIDER?: string;
  ADDRESS_PROVIDER?: string;
  FREE_SHIPPING_THRESHOLD?: string;
}

/**
 * Builds the provider set from env. Every provider name defaults to its
 * local stub, so the site runs end-to-end with no vendor keys. Real
 * implementations register here as they are added (e.g. 'cybersource',
 * 'taxjar', 'ups', 'sendgrid', 'smartystreets').
 */
export function createProviders(env: ProviderEnv): Providers {
  const freeShip = Math.round(Number(env.FREE_SHIPPING_THRESHOLD ?? '99') * 100);

  const pick = <T>(name: string | undefined, table: Record<string, () => T>, fallback: string): T => {
    const key = (name ?? fallback).toLowerCase();
    const factory = table[key];
    if (!factory) throw new Error(`Unknown provider "${key}". Known: ${Object.keys(table).join(', ')}`);
    return factory();
  };

  return {
    address: pick(env.ADDRESS_PROVIDER, { passthrough: () => new PassthroughAddressValidator() }, 'passthrough'),
    shipping: pick(
      env.SHIPPING_PROVIDER,
      {
        stub: () =>
          new StubShippingProvider({
            freeShippingThresholdCents: freeShip,
            economyCents: 795,
            fedex2DayCents: 1495,
            internationalCents: 2995,
          }),
      },
      'stub',
    ),
    tax: pick(env.TAX_PROVIDER, { stub: () => new StubTaxProvider() }, 'stub'),
    payment: pick(env.PAYMENT_PROVIDER, { stub: () => new StubPaymentProvider() }, 'stub'),
    email: pick(env.EMAIL_PROVIDER, { console: () => new ConsoleEmailProvider() }, 'console'),
  };
}
