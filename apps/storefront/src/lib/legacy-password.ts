/**
 * Verifies passwords stored by the legacy ASP site so customers can sign in once with
 * their old password (after which Better Auth re-hashes it with scrypt).
 *
 * Two legacy formats, both keyed with the site's old `rc4Key` (supply it as the
 * LEGACY_HASH_KEY secret; never commit it):
 *   hmac: hex(HMAC-SHA256(key, password))            — SecureHash(), password case preserved
 *   rc4:  hex(RC4(key, lowercase(password)))          — older accounts (secConvDt null)
 * Without the key, legacy hashes cannot be checked and the user must reset their password.
 */

export type LegacyHashType = 'hmac' | 'rc4';

export const LEGACY_PREFIX = 'legacy:';

export function encodeLegacyHash(type: LegacyHashType, hex: string): string {
  return `${LEGACY_PREFIX}${type}:${hex.toUpperCase()}`;
}

export function parseLegacyHash(stored: string): { type: LegacyHashType; hex: string } | null {
  if (!stored.startsWith(LEGACY_PREFIX)) return null;
  const [, type, hex] = stored.split(':');
  if ((type === 'hmac' || type === 'rc4') && hex) return { type, hex: hex.toUpperCase() };
  return null;
}

export async function verifyLegacyPassword(stored: string, password: string, key: string | undefined): Promise<boolean> {
  const parsed = parseLegacyHash(stored);
  if (!parsed || !key) return false;
  const computed = parsed.type === 'hmac' ? await hmacSha256Hex(key, password) : rc4Hex(key, password.toLowerCase());
  return timingSafeEqual(computed.toUpperCase().slice(0, 256), parsed.hex.slice(0, 256));
}

async function hmacSha256Hex(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', k, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Classic RC4 over Latin-1 bytes, matching the VBScript EnDeCrypt + Ascii2Hex pair. */
function rc4Hex(key: string, text: string): string {
  const S = Array.from({ length: 256 }, (_, i) => i);
  const k = Array.from(key, (c) => c.charCodeAt(0) & 0xff);
  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + S[i]! + k[i % k.length]!) & 0xff;
    [S[i], S[j]] = [S[j]!, S[i]!];
  }
  let i = 0;
  j = 0;
  let out = '';
  for (const ch of text) {
    i = (i + 1) & 0xff;
    j = (j + S[i]!) & 0xff;
    [S[i], S[j]] = [S[j]!, S[i]!];
    const kByte = S[(S[i]! + S[j]!) & 0xff]!;
    out += ((ch.charCodeAt(0) & 0xff) ^ kByte).toString(16).padStart(2, '0');
  }
  return out;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
