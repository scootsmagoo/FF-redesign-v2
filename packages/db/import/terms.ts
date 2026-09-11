/**
 * Writes apps/storefront/src/content/legal/terms.html from the legacy storeAdmin.termsAndCond value.
 *
 * Source, in order of preference:
 *   1. scripts/legacy-export/termsAndCond.txt   (text export of rerun/11h-termsAndCond.sql: the full value)
 *   2. import/legacy/storeAdmin.json            (workbook export: truncated at Excel's 32,767-char cell limit)
 *
 * Usage: pnpm --filter @ff/db exec tsx import/terms.ts
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const TXT = join(here, '../../../scripts/legacy-export/termsAndCond.txt');
const JSON_FILE = join(here, 'legacy/storeAdmin.json');
const OUT = join(here, '../../../apps/storefront/src/content/legal/terms.html');

let html: string | undefined;
let source = '';
if (existsSync(TXT)) {
  html = readFileSync(TXT, 'utf8').replace(/^﻿/, '');
  // "Results to File" prefixes the column name and may append a row count; keep the HTML only.
  const start = html.indexOf('<');
  if (start > 0) html = html.slice(start);
  html = html.replace(/\n\(\d+ rows? affected\)\s*$/i, '');
  source = TXT;
} else if (existsSync(JSON_FILE)) {
  const rows = (JSON.parse(readFileSync(JSON_FILE, 'utf8')) as { rows: { configVar: string; configValLong: string }[] }).rows;
  html = rows.find((r) => r.configVar === 'termsAndCond')?.configValLong;
  source = JSON_FILE;
}
if (!html) {
  console.error('No termsAndCond found. Export rerun/11h-termsAndCond.sql to scripts/legacy-export/termsAndCond.txt.');
  process.exit(1);
}

html = html
  .replace(/<style[\s\S]*?<\/style>/gi, '')
  .replace(/\r\n?/g, '\n')
  .replace(/\s*(<\/(?:p|li|ol|ul|h[1-6]|div|table|tr|td|th)>)\s*/g, '$1\n')
  .replace(/\s*(<(?:ol|ul|div|table|tbody|tr)[^>]*>)\s*/g, '\n$1\n')
  .replace(/&nbsp;\n/g, '')
  .replace(/\n{2,}/g, '\n')
  .trim();
writeFileSync(OUT, html + '\n');
const ids = ['privacy-policy', 'shipping-policy', 'returns-ref-policy', 'accessibilityStatement'].filter((id) => new RegExp(`(id|name)="${id}"`).test(html!));
console.log(`Wrote ${OUT} (${html.length} chars) from ${source}`);
console.log(`Policy anchors present: ${ids.length ? ids.join(', ') : 'none (text is truncated; export the .txt)'}`);
