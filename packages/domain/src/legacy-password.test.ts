import { encodeLegacyHash, legacyHashFor, parseLegacyHash, rc4Hex, verifyLegacyPassword } from './legacy-password';

const KEY = 'unit-test-key';

describe('legacy passwords', () => {
  it('parses the importer label (sha256) and the older alias (hmac) as the same scheme', () => {
    expect(parseLegacyHash('legacy:sha256:abcd')).toEqual({ type: 'hmac', hex: 'ABCD' });
    expect(parseLegacyHash('legacy:hmac:abcd')).toEqual({ type: 'hmac', hex: 'ABCD' });
    expect(parseLegacyHash('legacy:rc4:abcd')).toEqual({ type: 'rc4', hex: 'ABCD' });
    expect(parseLegacyHash('legacy:md5:abcd')).toBeNull();
    expect(parseLegacyHash('legacy:sha256:')).toBeNull();
    expect(parseLegacyHash('$scrypt$...')).toBeNull();
  });

  it('verifies an HMAC-SHA256 hash (case-sensitive password)', async () => {
    const stored = await legacyHashFor('sha256', KEY, 'Passw0rd!');
    expect(stored.startsWith('legacy:sha256:')).toBe(true);
    expect(stored.length).toBe('legacy:sha256:'.length + 64);
    expect(await verifyLegacyPassword(stored, 'Passw0rd!', KEY)).toBe(true);
    expect(await verifyLegacyPassword(stored, 'passw0rd!', KEY)).toBe(false);
    expect(await verifyLegacyPassword(stored, 'Passw0rd!', 'wrong-key')).toBe(false);
    expect(await verifyLegacyPassword(stored, 'Passw0rd!', undefined)).toBe(false);
  });

  it('matches a known HMAC-SHA256 vector', async () => {
    // HMAC-SHA256(key="key", "The quick brown fox jumps over the lazy dog")
    const stored = encodeLegacyHash('sha256', 'f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8');
    expect(await verifyLegacyPassword(stored, 'The quick brown fox jumps over the lazy dog', 'key')).toBe(true);
  });

  it('verifies an RC4 hash (password lower-cased, like the legacy site)', async () => {
    const stored = await legacyHashFor('rc4', KEY, 'MyOldPass');
    expect(await verifyLegacyPassword(stored, 'myoldpass', KEY)).toBe(true);
    expect(await verifyLegacyPassword(stored, 'MYOLDPASS', KEY)).toBe(true);
    expect(await verifyLegacyPassword(stored, 'myoldpass1', KEY)).toBe(false);
  });

  it('matches the standard RC4 test vectors', () => {
    expect(rc4Hex('Key', 'Plaintext').toUpperCase()).toBe('BBF316E8D940AF0AD3');
    expect(rc4Hex('Wiki', 'pedia').toUpperCase()).toBe('1021BF0420');
    expect(rc4Hex('Secret', 'Attack at dawn').toUpperCase()).toBe('45A01F645FC35B383552544B9BF5');
  });
});
