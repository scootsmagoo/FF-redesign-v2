import type { EmailMessage, EmailProvider } from '../types';

/** Logs instead of sending. SendGrid implements the same interface. */
export class ConsoleEmailProvider implements EmailProvider {
  readonly name = 'console';

  async send(msg: EmailMessage) {
    console.log(`[email:console] to=${msg.to} subject="${msg.subject}" template=${msg.templateId ?? '-'}`);
    return { ok: true, messageId: `console_${Date.now().toString(36)}` };
  }
}
