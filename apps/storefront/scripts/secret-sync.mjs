/**
 * Copies one value from the git-ignored `.dev.vars` to a Wrangler secret on the deployed Worker,
 * so local and staging never drift on LEGACY_HASH_KEY, SENDGRID_API_KEY, BETTER_AUTH_SECRET, ...
 *
 *   pnpm --filter @ff/storefront secret:sync LEGACY_HASH_KEY
 *
 * The value never touches the shell command line or the repo.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const name = process.argv[2];
if (!name || !/^[A-Z][A-Z0-9_]*$/.test(name)) {
  console.error('usage: node scripts/secret-sync.mjs <SECRET_NAME>');
  process.exit(1);
}
const storefront = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const lines = readFileSync(resolve(storefront, '.dev.vars'), 'utf8').split(/\r?\n/);
const line = lines.find((l) => l.startsWith(`${name}=`));
if (!line) {
  console.error(`${name} is not set in .dev.vars`);
  process.exit(1);
}
let value = line.slice(name.length + 1).trim();
if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
if (!value) {
  console.error(`${name} is empty in .dev.vars`);
  process.exit(1);
}

const r = spawnSync('pnpm', ['exec', 'wrangler', 'secret', 'put', name], { cwd: storefront, shell: true, input: value, encoding: 'utf8' });
process.stdout.write(r.stdout ?? '');
process.stderr.write(r.stderr ?? '');
if (r.status !== 0) process.exit(r.status ?? 1);
console.log(`${name} (${value.length} chars) synced from .dev.vars to the Worker.`);
