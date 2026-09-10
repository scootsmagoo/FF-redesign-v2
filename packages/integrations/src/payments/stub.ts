import type { PaymentProvider, PaymentRequest, PaymentResult } from '../types';

/**
 * Test-mode payment provider. Approves everything except tokens that start
 * with "decline", so checkout failure paths can be exercised without a
 * gateway. CyberSource (Microform) and PayPal implement the same interface.
 */
export class StubPaymentProvider implements PaymentProvider {
  readonly name = 'stub';

  async clientConfig(): Promise<Record<string, unknown>> {
    return { mode: 'stub', message: 'Payments are in test mode. Any card number is accepted; use token "decline" to simulate a decline.' };
  }

  async authorizeAndCapture(req: PaymentRequest): Promise<PaymentResult> {
    if (req.amountCents <= 0) return { ok: false, declineReason: 'Amount must be positive' };
    if (req.token.toLowerCase().startsWith('decline')) {
      return { ok: false, declineReason: 'Card declined (stub)' };
    }
    return {
      ok: true,
      transactionId: `stub_${req.orderNumber}_${Date.now().toString(36)}`,
      raw: { provider: 'stub', method: req.method, amountCents: req.amountCents },
    };
  }

  async refund(transactionId: string, amountCents: number): Promise<PaymentResult> {
    return { ok: true, transactionId: `${transactionId}_refund`, raw: { amountCents } };
  }
}
