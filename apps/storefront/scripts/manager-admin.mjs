/**
 * Creates a back-office (Manager) account, or resets an existing one, with a temporary
 * password that must be changed at first sign-in. Prints the temporary password once.
 *
 *   pnpm --filter @ff/storefront manager:admin adam@filtersfast.com --name "Adam"            local D1
 *   pnpm --filter @ff/storefront manager:admin adam@filtersfast.com --name "Adam" --remote   staging D1
 *   pnpm --filter @ff/storefront manager:admin someone@filtersfast.com --disable [--remote]  deactivate
 *
 * Further accounts can be managed at /manager/admins once one admin exists.
 */
import { hashPassword } from 'better-auth/crypto';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const email = args.find((a) => !a.startsWith('--'))?.toLowerCase();
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('usage: node scripts/manager-admin.mjs <email> [--name "Full Name"] [--remote] [--disable]');
  process.exit(1);
}
const remote = args.includes('--remote');
const disable = args.includes('--disable');
const nameIdx = args.indexOf('--name');
const name = nameIdx > -1 ? args[nameIdx + 1] : null;
const lit = (s) => (s === null || s === undefined ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`);

function tempPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = randomBytes(16);
  const chars = [...bytes].map((b) => alphabet[b % alphabet.length]);
  chars[0] = 'Ab'[bytes[0] % 2];
  chars[15] = String((bytes[15] % 7) + 2);
  return chars.join('');
}

let sql;
let password;
if (disable) {
  sql = `UPDATE admins SET active = 0, updated_at = current_timestamp WHERE email = ${lit(email)};\nDELETE FROM admin_sessions WHERE admin_id IN (SELECT id FROM admins WHERE email = ${lit(email)});`;
} else {
  password = tempPassword();
  const hash = await hashPassword(password);
  sql = `INSERT INTO admins (email, name, password_hash, active, must_change_password, failed_attempts, locked_until)
VALUES (${lit(email)}, ${lit(name)}, ${lit(hash)}, 1, 1, 0, NULL)
ON CONFLICT(email) DO UPDATE SET password_hash = excluded.password_hash, must_change_password = 1, active = 1, failed_attempts = 0,
  locked_until = NULL, name = coalesce(excluded.name, admins.name), updated_at = current_timestamp;
DELETE FROM admin_sessions WHERE admin_id IN (SELECT id FROM admins WHERE email = ${lit(email)});`;
}
sql += `\nSELECT id, email, name, active, must_change_password FROM admins WHERE email = ${lit(email)};\n`;

const storefront = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tmpDir = join(storefront, '.wrangler', 'tmp');
mkdirSync(tmpDir, { recursive: true });
const file = join(tmpDir, 'manager-admin.sql');
writeFileSync(file, sql);
// Relative path: the project folder contains spaces and shell:true would split an absolute one.
const rel = relative(storefront, file).split('\\').join('/');
const r = spawnSync('pnpm', ['exec', 'wrangler', 'd1', 'execute', 'DB', remote ? '--remote' : '--local', `--file="${rel}"`], {
  cwd: storefront,
  shell: true,
  encoding: 'utf8',
});
writeFileSync(file, '-- cleared\n');
if (r.status !== 0) {
  console.error(r.stderr || r.stdout);
  process.exit(r.status ?? 1);
}
const shown = (r.stdout.match(/"email"[^}]*"must_change_password"[^}]*/g) ?? []).length;
if (!shown && !r.stdout.includes(email)) console.log(r.stdout);
console.log(`${disable ? 'Deactivated' : 'Ready'}: ${email}${remote ? ' on staging' : ' locally'}.`);
if (password) {
  console.log(`Temporary password: ${password}`);
  console.log('Sign in at /manager/login; the portal will ask for a new password right away.');
}
