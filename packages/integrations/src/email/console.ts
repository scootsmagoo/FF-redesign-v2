import type { EmailMessage, EmailProvider } from '../types';

/**
 * Logs instead of sending, and keeps the last few messages in memory so a dev/staging
 * page can surface a link (e.g. password reset) that would otherwise only exist in the logs.
 * Never use this provider where real customers sign in: nothing is delivered.
 */
export class ConsoleEmailProvider implements EmailProvider {
  readonly name = 'console';
  private readonly recent: EmailMessage[] = [];

  async send(msg: EmailMessage) {
    console.log(`[email:console] to=${msg.to} subject="${msg.subject}" template=${msg.templateId ?? '-'}`);
    const url = msg.templateData?.url;
    if (typeof url === 'string') console.log(`[email:console] link=${url}`);
    if (msg.attachments?.length) console.log(`[email:console] attachments=${msg.attachments.map((a) => a.filename).join(', ')}`);
    this.recent.unshift(msg);
    if (this.recent.length > 20) this.recent.length = 20;
    return { ok: true, messageId: `console_${Date.now().toString(36)}` };
  }

  /** Most recent message sent to an address in this isolate, if any. */
  lastTo(email: string): EmailMessage | undefined {
    const e = email.toLowerCase();
    return this.recent.find((m) => m.to.toLowerCase() === e);
  }
}
