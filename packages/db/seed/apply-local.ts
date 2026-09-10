/**
 * Applies the generated seed chunks to a D1 database.
 *
 *   pnpm --filter @ff/db seed:apply            local: writes straight into wrangler's
 *                                              Miniflare SQLite file with node:sqlite
 *                                              (wrangler's local runner OOMs on big files)
 *   pnpm --filter @ff/db seed:apply --remote   remote: one `wrangler d1 execute` per chunk
 *
 * Run `seed:build` first, and `wrangler d1 migrations apply DB --local` at least once
 * so the local database file exists.
 */
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const chunksDir = join(here, 'chunks');
const storefront = resolve(here, '../../../apps/storefront');
const remote = process.argv.includes('--remote');

const files = readdirSync(chunksDir)
  .filter((f) => f.endsWith('.sql'))
  .sort();
if (!files.length) {
  console.error('No seed chunks found. Run `pnpm --filter @ff/db seed:build` first.');
  process.exit(1);
}

const started = Date.now();

if (remote) {
  for (const [i, file] of files.entries()) {
    // Relative path: the project folder contains spaces and shell:true would split an absolute one.
    const rel = relative(storefront, join(chunksDir, file)).split('\\').join('/');
    process.stdout.write(`[${i + 1}/${files.length}] ${file} ... `);
    const r = spawnSync('pnpm', ['exec', 'wrangler', 'd1', 'execute', 'DB', '--remote', `--file="${rel}"`], {
      cwd: storefront,
      shell: true,
      encoding: 'utf8',
    });
    if (r.status !== 0) {
      console.error('\n' + (r.stderr || r.stdout));
      process.exit(r.status ?? 1);
    }
    console.log('ok');
  }
} else {
  const dbFile = findLocalD1File();
  console.log(`Local D1 file: ${relative(storefront, dbFile)}`);
  const db = new DatabaseSync(dbFile);
  db.exec('PRAGMA journal_mode = WAL;');
  for (const [i, file] of files.entries()) {
    process.stdout.write(`[${i + 1}/${files.length}] ${file} ... `);
    const sql = readFileSync(join(chunksDir, file), 'utf8');
    db.exec('BEGIN;');
    try {
      db.exec(sql);
      db.exec('COMMIT;');
    } catch (e) {
      db.exec('ROLLBACK;');
      throw e;
    }
    console.log('ok');
  }
  db.close();
}

console.log(`Seed applied in ${((Date.now() - started) / 1000).toFixed(1)}s`);

/**
 * Miniflare stores each D1 database as <hash-of-database_id>.sqlite. Changing
 * database_id in wrangler.jsonc creates a new file, so pick the most recently
 * modified one (migrations touch it right before seeding).
 */
function findLocalD1File(): string {
  const dir = join(storefront, '.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
  let candidates: string[] = [];
  try {
    candidates = readdirSync(dir).filter((f) => f.endsWith('.sqlite') && f !== 'metadata.sqlite');
  } catch {
    /* handled below */
  }
  if (!candidates.length) {
    console.error(`No local D1 database found under ${dir}. Run \`pnpm --filter @ff/storefront db:migrate:local\` first.`);
    process.exit(1);
  }
  candidates.sort((a, b) => statSync(join(dir, b)).mtimeMs - statSync(join(dir, a)).mtimeMs);
  return join(dir, candidates[0]!);
}
