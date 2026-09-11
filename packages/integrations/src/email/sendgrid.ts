import type { EmailMessage, EmailProvider } from '../types';

export interface SendGridOptions {
  apiKey: string;
  /** Verified sender, e.g. no-reply@filtersfast.com (the legacy site's transactional sender). */
  from: string;
  fromName?: string;
  /** Override for tests. */
  fetch?: typeof fetch;
  endpoint?: string;
}

/**
 * SendGrid v3 Mail Send. Same payload shape the legacy `_INCappEmail_.asp` posts:
 * dynamic templates by id when `templateId` is a SendGrid id, otherwise inline HTML/text.
 */
export class SendGridEmailProvider implements EmailProvider {
  readonly name = 'sendgrid';
  private readonly endpoint: string;
  private readonly doFetch: typeof fetch;

  constructor(private readonly opts: SendGridOptions) {
    if (!opts.apiKey) throw new Error('SendGrid provider needs SENDGRID_API_KEY');
    if (!opts.from) throw new Error('SendGrid provider needs EMAIL_FROM');
    this.endpoint = opts.endpoint ?? 'https://api.sendgrid.com/v3/mail/send';
    this.doFetch = opts.fetch ?? fetch;
  }

  buildPayload(msg: EmailMessage): Record<string, unknown> {
    const personalization: Record<string, unknown> = { to: [{ email: msg.to }], subject: msg.subject };
    const body: Record<string, unknown> = {
      personalizations: [personalization],
      from: { email: this.opts.from, name: this.opts.fromName },
      reply_to: msg.replyTo ? { email: msg.replyTo } : undefined,
    };
    if (msg.templateId && /^d-[0-9a-f]{32}$/i.test(msg.templateId)) {
      // A real SendGrid dynamic template id. Our internal template names ("password-reset")
      // fall through to inline content until they are mapped to SendGrid ids.
      body.template_id = msg.templateId;
      personalization.dynamic_template_data = { subject: msg.subject, ...(msg.templateData ?? {}) };
    } else {
      const content: { type: string; value: string }[] = [];
      if (msg.text) content.push({ type: 'text/plain', value: msg.text });
      content.push({ type: 'text/html', value: msg.html });
      body.content = content;
    }
    if (msg.attachments?.length) body.attachments = msg.attachments.map((a) => ({ content: a.content, filename: a.filename, type: a.type ?? 'application/octet-stream', disposition: 'attachment' }));
    return body;
  }

  async send(msg: EmailMessage) {
    const res = await this.doFetch(this.endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.opts.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(this.buildPayload(msg)),
    });
    if (res.ok) {
      return { ok: true, messageId: res.headers.get('x-message-id') ?? undefined };
    }
    let error = `SendGrid ${res.status}`;
    try {
      const j = (await res.json()) as { errors?: { message?: string }[] };
      if (j.errors?.length) error += `: ${j.errors.map((e) => e.message).filter(Boolean).join('; ')}`;
    } catch {
      /* non-JSON error body */
    }
    console.error(`[email:sendgrid] to=${msg.to} subject="${msg.subject}" ${error}`);
    return { ok: false, error };
  }
}
