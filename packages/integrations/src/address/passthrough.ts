import type { Address, AddressValidationResult, AddressValidator } from '../types';

const PO_BOX = /\b(p\.?\s*o\.?\s*box|post\s+office\s+box)\b/i;
const MILITARY_CITY = /^(apo|fpo|dpo)$/i;

/**
 * No-network validator: normalises casing and detects PO boxes / military
 * addresses the same way the legacy IsNonPhysicalAddress() did.
 * SmartyStreets replaces this behind the same interface.
 */
export class PassthroughAddressValidator implements AddressValidator {
  readonly name = 'passthrough';

  async validate(address: Address): Promise<AddressValidationResult> {
    const messages: string[] = [];
    const line = `${address.line1} ${address.line2 ?? ''}`;
    let classification: AddressValidationResult['classification'] = 'unknown';
    if (PO_BOX.test(line)) classification = 'po-box';
    else if (MILITARY_CITY.test(address.city.trim())) classification = 'military';

    const valid = Boolean(address.line1?.trim() && address.city?.trim() && address.region?.trim() && address.postalCode?.trim());
    if (!valid) messages.push('Street, city, state and postal code are required.');

    return { valid, classification, messages };
  }
}
