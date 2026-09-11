import { paymentLogs } from '@ff/db';
import { getDb } from './db';

/**
 * Records one gateway call (legacy payment_processing_logs). Logging must never break a
 * checkout or a refund, so failures are swallowed after a console error.
 */
export async function logPayment(entry: {
  orderNumber: string | null;
  customerId: number | null;
  email: string | null;
  kind: 'authorize_capture' | 'refund';
  provider: string;
  method: string | null;
  amountCents: number;
  currency: string;
  ok: boolean;
  transactionId: string | null;
  message: string | null;
  ipAddress: string | null;
}): Promise<void> {
  try {
    await getDb().insert(paymentLogs).values({ ...entry, message: entry.message?.slice(0, 1000) ?? null });
  } catch (e) {
    console.error(`[payment-log] ${entry.kind} ${entry.orderNumber ?? ''} failed to log: ${e instanceof Error ? e.message : String(e)}`);
  }
}
