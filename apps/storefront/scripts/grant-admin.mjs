/**
 * Grants (or revokes) the admin role for a sign-in by email.
 *
 *   pnpm --filter @ff/storefront admin:grant someone@example.com            local D1
 *   pnpm --filter @ff/storefront admin:grant someone@example.com --remote   staging D1
 *   ... --revoke                                                            back to customer
 *
 * The email must already have an auth_user row (imported legacy customer with a password,
 * or an account created on the new site). Further admins can be granted from /admin/customers.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const email = args.find((a) => !a.startsWith('--'));
if (!email || !email.includes('@')) {
  console.error('usage: node scripts/grant-admin.mjs <email> [--remote] [--revoke]');
  process.exit(1);
}
const remote = args.includes('--remote');
const role = args.includes('--revoke') ? 'customer' : 'admin';
const lit = `'${email.toLowerCase().replace(/'/g, "''")}'`;

const storefront = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tmpDir = join(storefront, '.wrangler', 'tmp');
mkdirSync(tmpDir, { recursive: true });
const file = join(tmpDir, 'grant-admin.sql');
writeFileSync(
  file,
  [
    `UPDATE auth_user SET role = '${role}', updated_at = updated_at WHERE lower(email) = ${lit};`,
    `SELECT id, email, role, customer_id FROM auth_user WHERE lower(email) = ${lit};`,
    '',
  ].join('\n'),
);

// Relative path: the project folder contains spaces and shell:true would split an absolute one.
const rel = relative(storefront, file).split('\\').join('/');
const r = spawnSync('pnpm', ['exec', 'wrangler', 'd1', 'execute', 'DB', remote ? '--remote' : '--local', `--file="${rel}"`], {
  cwd: storefront,
  shell: true,
  stdio: 'inherit',
});
if (r.status !== 0) process.exit(r.status ?? 1);
console.log(`\nIf the SELECT above shows role = '${role}', ${email} ${role === 'admin' ? 'can now open /admin' : 'is a regular customer again'}${remote ? ' on staging' : ' locally'}.`);
if (r.status === 0) console.log('No row shown? That email has no sign-in yet: register on the site first, then re-run.');
