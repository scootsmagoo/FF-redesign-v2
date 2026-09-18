// Lists every /ProdImages file the imported catalog references, so only those need copying off
// the legacy web server (the folder also holds years of orphans). Reads the legacy export JSON in
// packages/db/import/legacy (git-ignored) and writes, next to the other export files:
//   scripts/legacy-export/prodimages-manifest.txt   one relative path per line (as stored, IIS is case-insensitive)
//   scripts/legacy-export/copy-prodimages.ps1       run ON the web server: copies the listed files into a zip-ready folder
//
//   node scripts/prodimages-manifest.mjs [--active-only]
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LEGACY = join(ROOT, 'packages', 'db', 'import', 'legacy');
const OUT = join(ROOT, 'scripts', 'legacy-export');
const ACTIVE_ONLY = process.argv.includes('--active-only');

const load = (t) => (existsSync(join(LEGACY, `${t}.json`)) ? JSON.parse(readFileSync(join(LEGACY, `${t}.json`), 'utf8')).rows : []);
const str = (v) => (v === null || v === undefined ? '' : String(v).trim());

const files = new Map(); // lower-case path → { path, sources:Set }
const external = new Set();
const rejected = new Set(); // not a file name: column-shifted export rows, two URLs run together, bare folders
function add(raw, source, sub = '') {
  let s = str(raw);
  if (!s) return;
  if (/^https?:/i.test(s)) {
    const m = s.match(/^https?:\/\/(?:www\.)?filtersfast\.com\/prodimages\/(.+)$/i);
    if (!m) return void external.add(s.replace(/^(https?:\/\/[^/]+).*/, '$1'));
    s = m[1];
  }
  s = decodeURIComponent(s.replace(/\\/g, '/').replace(/^\/+/, '').replace(/^prodimages\//i, '').replace(/[?#].*$/, ''));
  if (!s) return;
  if (!/^[^:*?"<>|]+.(jpe?g|png|gif|webp|svg|bmp|pdf)$/i.test(s)) return void rejected.add(s.slice(0, 80));
  const path = sub + s;
  const k = path.toLowerCase();
  if (!files.has(k)) files.set(k, { path, sources: new Set() });
  files.get(k).sources.add(source);
}
/** /ProdImages/... references inside HTML or free text */
function scanHtml(v, source) {
  for (const m of str(v).matchAll(/prodimages\/([^"'\s)<>?#]+)/gi)) add(m[1], source);
}

const products = load('products');
const live = new Set();
for (const p of products) {
  const active = Number(p.active ?? 1) !== 0;
  if (ACTIVE_ONLY && !active) continue;
  live.add(Number(p.idProduct));
  add(p.imageURL, 'product image');
  add(p.smallImageURL, 'product thumb');
  for (const [k, v] of Object.entries(p)) if (typeof v === 'string' && v.length > 40 && /prodimages\//i.test(v)) scanHtml(v, `products.${k}`);
}
for (const r of load('product_images')) if (live.has(Number(r.idProduct))) add(r.imageUrl, 'product gallery');
for (const r of load('product_option_images')) if (live.has(Number(r.idProduct))) add(r.optionImageUrl, 'option image');
for (const c of load('categories')) {
  add(c.categoryImage, 'category image', 'category/');
  add(c.categoryGraphic, 'category hero', 'category/');
  add(c.categoryLogo, 'category logo', 'category/');
  for (const [k, v] of Object.entries(c)) if (typeof v === 'string' && /prodimages\//i.test(v)) scanHtml(v, `categories.${k}`);
}
for (const r of load('support_categories')) add(r.categoryImage, 'support category', 'support/');
for (const t of ['support_articles', 'faq', 'refrigerator_finder', 'tWaterFilterType', 'tWaterFilterSize'])
  for (const r of load(t)) for (const [k, v] of Object.entries(r)) if (typeof v === 'string' && /prodimages\//i.test(v)) scanHtml(v, `${t}.${k}`);

const list = [...files.values()].sort((a, b) => a.path.localeCompare(b.path));
const bySource = {};
for (const f of list) for (const s of f.sources) bySource[s] = (bySource[s] ?? 0) + 1;
const byExt = {};
for (const f of list) { const e = (f.path.split('.').pop() ?? '').toLowerCase(); byExt[e.length > 5 ? '(none)' : e] = (byExt[e.length > 5 ? '(none)' : e] ?? 0) + 1; }
const byDir = {};
for (const f of list) { const d = f.path.includes('/') ? f.path.slice(0, f.path.lastIndexOf('/') + 1).toLowerCase() : '(root)'; byDir[d] = (byDir[d] ?? 0) + 1; }

writeFileSync(join(OUT, 'prodimages-manifest.txt'), list.map((f) => f.path).join('\r\n') + '\r\n');
writeFileSync(
  join(OUT, 'copy-prodimages.ps1'),
  [
    '# Run ON the legacy web server (read-only on the source). Copies the files named in',
    '# prodimages-manifest.txt out of the site\'s ProdImages folder, keeping sub-folders, then zip $Dest.',
    '#   .\\copy-prodimages.ps1 -Source "D:\\inetpub\\filtersfast\\ProdImages" -Dest "D:\\temp\\ProdImages-export"',
    'param([Parameter(Mandatory)][string]$Source, [Parameter(Mandatory)][string]$Dest, [string]$Manifest = "$PSScriptRoot\\prodimages-manifest.txt")',
    '$missing = New-Object System.Collections.Generic.List[string]; $copied = 0; $bytes = 0',
    'foreach ($rel in Get-Content -LiteralPath $Manifest -Encoding UTF8) {',
    '  if (-not $rel.Trim()) { continue }',
    '  $from = Join-Path $Source ($rel -replace "/", "\\")',
    '  if (-not (Test-Path -LiteralPath $from -PathType Leaf)) { $missing.Add($rel); continue }',
    '  $to = Join-Path $Dest ($rel -replace "/", "\\")',
    '  New-Item -ItemType Directory -Force -Path (Split-Path $to) | Out-Null',
    '  Copy-Item -LiteralPath $from -Destination $to -Force',
    '  $copied++; $bytes += (Get-Item -LiteralPath $from).Length',
    '}',
    '$missing | Set-Content -LiteralPath (Join-Path $Dest "_missing.txt") -Encoding UTF8',
    'Write-Host ("copied {0} files, {1:N0} MB; {2} listed files not found (see _missing.txt)" -f $copied, ($bytes / 1MB), $missing.Count)',
    '',
  ].join('\r\n'),
);

console.log(`${products.length} products (${ACTIVE_ONLY ? 'active only: ' + live.size : 'all'}) → ${list.length} distinct ProdImages files`);
console.log('by source', bySource);
console.log('by folder', byDir);
console.log('by extension', byExt);
if (rejected.size) console.log(`${rejected.size} values skipped (not file names), e.g.`, [...rejected].slice(0, 6));
if (external.size) console.log('external hosts referenced (not copied):', [...external].slice(0, 15));
