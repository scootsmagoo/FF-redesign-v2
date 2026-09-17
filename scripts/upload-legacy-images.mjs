// Uploads the legacy site's /images folder (copied to ./images, git-ignored) into the IMAGES R2
// bucket under `legacy/`, lower-cased: images/category-images/Foo.JPG → legacy/category-images/foo.jpg.
// IIS paths are case-insensitive and R2 keys are not, so keys are stored lower-case and the
// /images/[...key] route lower-cases anything under legacy/ before the lookup.
//
//   node scripts/upload-legacy-images.mjs            remote bucket (staging)
//   node scripts/upload-legacy-images.mjs --local    local dev bucket (apps/storefront/.wrangler)
//   --dir <folder>   source folder (default ./images)      --prefix <p>  key prefix (default legacy)
//   --only <substr>  upload matching relative paths only   --dry         list, upload nothing
//   --concurrency N  parallel uploads (default 8)           --from N      resume at file N (the progress count)
// Remote uploads call the R2 REST API (CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID, the same
// variables wrangler uses): one wrangler process per file manages about 25 files a minute.
// --local has no API, so it still shells out to wrangler.
import { spawn } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const APP = join(ROOT, 'apps', 'storefront');
const WRANGLER = join(APP, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
const BUCKET = 'filtersfast-images';
const TYPES = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', avif: 'image/avif' };

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name, fallback) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);
const dir = resolve(ROOT, opt('dir', 'images'));
const prefix = opt('prefix', 'legacy').replace(/^\/+|\/+$/g, '');
const only = opt('only', '').toLowerCase();
const concurrency = Number(opt('concurrency', '8'));

function walk(d) {
  return readdirSync(d).flatMap((name) => {
    const full = join(d, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const files = walk(dir)
  .map((full) => ({ full, key: `${prefix}/${relative(dir, full).split('\\').join('/').toLowerCase()}` }))
  .filter((f) => TYPES[f.key.split('.').pop()] && (!only || f.key.includes(only)))
  .slice(Number(opt('from', '0')));

const seen = new Map();
for (const f of files) {
  if (seen.has(f.key)) throw new Error(`Two files map to ${f.key}: ${seen.get(f.key)} and ${f.full}`);
  seen.set(f.key, f.full);
}

console.log(`${files.length} images from ${dir} → ${flag('local') ? 'local' : 'remote'} ${BUCKET}/${prefix}/`);
if (flag('dry')) {
  files.forEach((f) => console.log(f.key));
  process.exit(0);
}

const CACHE = 'public, max-age=31536000, immutable';
const { CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: account } = process.env;
if (!flag('local') && (!token || !account)) throw new Error('Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID for a remote upload');

async function putRemote(f) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${account}/r2/buckets/${BUCKET}/objects/${f.key.split('/').map(encodeURIComponent).join('/')}`;
  try {
    const res = await fetch(url, { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': TYPES[f.key.split('.').pop()], 'Cache-Control': CACHE }, body: readFileSync(f.full) });
    return { ok: res.ok, out: res.ok ? '' : `${res.status} ${(await res.text()).slice(0, 200)}` };
  } catch (e) {
    return { ok: false, out: String(e) };
  }
}

function putLocal(f) {
  return new Promise((done) => {
    const a = [WRANGLER, 'r2', 'object', 'put', `${BUCKET}/${f.key}`, '--file', f.full, '--content-type', TYPES[f.key.split('.').pop()], '--cache-control', CACHE, '--local'];
    const child = spawn(process.execPath, a, { cwd: APP, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (c) => (out += c));
    child.stderr.on('data', (c) => (out += c));
    child.on('close', (code) => done({ ok: code === 0, out }));
  });
}

const put = flag('local') ? putLocal : putRemote;
const failed = [];
let next = 0;
let finished = 0;
async function worker() {
  while (next < files.length) {
    const f = files[next++];
    let r = await put(f);
    if (!r.ok) r = await put(f); // one retry for transient API errors
    if (!r.ok) failed.push({ key: f.key, out: r.out.trim().split('\n').slice(-3).join(' | ') });
    if (++finished % 50 === 0 || finished === files.length) console.log(`${finished}/${files.length}`);
  }
}
await Promise.all(Array.from({ length: concurrency }, worker));

if (failed.length) {
  console.error(`${failed.length} failed:`);
  failed.forEach((f) => console.error(`  ${f.key}: ${f.out}`));
  process.exit(1);
}
console.log('done');
