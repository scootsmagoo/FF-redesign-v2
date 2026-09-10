import type { Address, RateRequest, ShippingProvider, ShippingRate } from '../types';

export interface StubShippingConfig {
  /** cents; legacy storeAdmin.pFreeShipThresh, $99 */
  freeShippingThresholdCents: number;
  economyCents: number;
  fedex2DayCents: number;
  internationalCents: number;
}

const CONTIGUOUS_EXCLUDED = new Set(['AK', 'HI', 'PR', 'GU', 'VI', 'AS', 'MP']);
const PO_BOX = /\b(p\.?\s*o\.?\s*box|post\s+office\s+box)\b/i;

/**
 * Table-driven rates that mirror the legacy method labels
 * (FREE Economy 4-10 days, Economy, FAST FedEx) so the checkout UI is real
 * while carrier APIs are still unwired. UPS/USPS/FedEx REST providers
 * replace this behind the same interface.
 */
export class StubShippingProvider implements ShippingProvider {
  readonly name = 'stub';
  constructor(private readonly cfg: StubShippingConfig) {}

  async getRates(req: RateRequest): Promise<ShippingRate[]> {
    const d = req.destination;
    if (d.country !== 'US') {
      return [
        { id: 'intl-economy', label: 'International Economy (7-21 Days)', carrier: 'DHL', priceCents: this.cfg.internationalCents, minDays: 7, maxDays: 21, available: true },
      ];
    }
    const contiguous = !CONTIGUOUS_EXCLUDED.has(d.region.toUpperCase()) && !isMilitary(d);
    const poBox = PO_BOX.test(`${d.line1} ${d.line2 ?? ''}`);
    const allItemsFreeShip = req.items.length > 0 && req.items.every((i) => i.freeShipping);
    const free = contiguous && (req.freeShippingEligible || allItemsFreeShip || req.subtotalCents >= this.cfg.freeShippingThresholdCents);

    const rates: ShippingRate[] = [
      {
        id: 'economy',
        label: free ? 'FREE Economy Shipping (4-10 Days)' : 'Economy (4-10 Days)',
        carrier: 'USPS/UPS',
        priceCents: free ? 0 : this.cfg.economyCents,
        minDays: 4,
        maxDays: 10,
        available: true,
      },
      {
        id: 'fedex-2day',
        label: 'FAST - FedEx Delivery (1-2 Days)',
        carrier: 'FedEx',
        priceCents: this.cfg.fedex2DayCents,
        minDays: 1,
        maxDays: 2,
        available: !poBox && contiguous,
      },
    ];
    return rates;
  }
}

function isMilitary(a: Address): boolean {
  return /^(apo|fpo|dpo)$/i.test(a.city.trim()) || /^(AA|AE|AP)$/i.test(a.region.trim());
}
