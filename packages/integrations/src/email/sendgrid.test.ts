import { SendGridEmailProvider } from './sendgrid';
import { ConsoleEmailProvider } from './console';
import { createProviders } from '../index';

function fakeFetch(status: number, body: unknown = {}, headers: Record<string, string> = {}) {
  const calls: { url: string; init: RequestInit }[] = [];
  const f = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(JSON.stringify(body), { status, headers });
  }) as unknown as typeof fetch;
  return { f, calls };
}

describe('SendGridEmailProvider', () => {
  const msg = { to: 'Someone@Example.com', subject: 'Reset', html: '<p>hi</p>', text: 'hi', templateId: 'password-reset', templateData: { url: 'https://x/y' } };

  it('posts inline content with a bearer token and reports the message id', async () => {
    const { f, calls } = fakeFetch(202, {}, { 'x-message-id': 'abc123' });
    const p = new SendGridEmailProvider({ apiKey: 'SG.test', from: 'no-reply@filtersfast.com', fromName: 'FiltersFast.com', fetch: f });
    const r = await p.send(msg);
    expect(r).toEqual({ ok: true, messageId: 'abc123' });
    expect(calls[0]?.url).toBe('https://api.sendgrid.com/v3/mail/send');
    expect((calls[0]?.init.headers as Record<string, string>).Authorization).toBe('Bearer SG.test');
    const body = JSON.parse(String(calls[0]?.init.body)) as Record<string, any>;
    expect(body.from).toEqual({ email: 'no-reply@filtersfast.com', name: 'FiltersFast.com' });
    expect(body.personalizations[0].to).toEqual([{ email: 'Someone@Example.com' }]);
    expect(body.template_id).toBeUndefined();
    expect(body.content).toEqual([
      { type: 'text/plain', value: 'hi' },
      { type: 'text/html', value: '<p>hi</p>' },
    ]);
  });

  it('uses a SendGrid dynamic template when the id looks like one', () => {
    const p = new SendGridEmailProvider({ apiKey: 'k', from: 'a@b.c' });
    const body = p.buildPayload({ ...msg, templateId: 'd-0123456789abcdef0123456789abcdef' }) as Record<string, any>;
    expect(body.template_id).toBe('d-0123456789abcdef0123456789abcdef');
    expect(body.personalizations[0].dynamic_template_data).toEqual({ subject: 'Reset', url: 'https://x/y' });
    expect(body.content).toBeUndefined();
  });

  it('surfaces SendGrid errors without throwing', async () => {
    const { f } = fakeFetch(401, { errors: [{ message: 'The provided authorization grant is invalid' }] });
    const p = new SendGridEmailProvider({ apiKey: 'bad', from: 'a@b.c', fetch: f });
    const r = await p.send(msg);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/401.*authorization grant/);
  });

  it('refuses to start without a key', () => {
    expect(() => new SendGridEmailProvider({ apiKey: '', from: 'a@b.c' })).toThrow(/SENDGRID_API_KEY/);
    expect(() => createProviders({ EMAIL_PROVIDER: 'sendgrid' })).toThrow(/SENDGRID_API_KEY/);
    expect(createProviders({ EMAIL_PROVIDER: 'sendgrid', SENDGRID_API_KEY: 'k' }).email.name).toBe('sendgrid');
  });
});

describe('ConsoleEmailProvider', () => {
  it('remembers the last message per recipient so dev pages can show reset links', async () => {
    const p = new ConsoleEmailProvider();
    await p.send({ to: 'a@b.c', subject: 'one', html: '' });
    await p.send({ to: 'A@b.c', subject: 'two', html: '', templateData: { url: 'https://reset' } });
    expect(p.lastTo('a@B.C')?.subject).toBe('two');
    expect(p.lastTo('nobody@b.c')).toBeUndefined();
  });
});
