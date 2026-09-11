/**
 * Writes apps/storefront/src/content/legal/terms.html from the legacy storeAdmin.termsAndCond value.
 *
 * Source, in order of preference:
 *   1. scripts/legacy-export/termsAndCond.txt   SSMS "Results to File" output of rerun/11h-termsAndCond.sql.
 *        Accepts the chunked form (columns `part`, `termsAndCond`, one 30,000-char row per part) and the
 *        older single-column form. SSMS wraps long values every 32,759 characters and caps a value at
 *        65,535; wrapped lines are re-joined, and a capped export is reported.
 *   2. import/legacy/storeAdmin.json            workbook export, truncated at Excel's 32,767-char cell limit.
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
const SSMS_WRAP = 32759;
const SSMS_CAP = 65535;

function fromResultsFile(text: string): { html: string; note: string } {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  // Chunked form: header "part  termsAndCond", dashes, then "<n>  <html>" rows.
  const partRows = lines.filter((l) => /^\s*\d+\s+\S/.test(l) && !/^\s*\d+\s+rows?\b/i.test(l));
  if (/^\s*part\s+termsAndCond/i.test(lines[0] ?? '') && partRows.length) {
    const parts = partRows.map((l) => l.match(/^\s*(\d+)\s+(.*)$/)!).map((m) => ({ n: Number(m[1]), body: m[2]! }));
    parts.sort((a, b) => a.n - b.n);
    const html = parts.map((p) => p.body).join('').replace(/\s+$/, '');
    return { html, note: `${parts.length} parts` };
  }
  // Single-column form: column name, then the value, wrapped every SSMS_WRAP chars.
  const body = lines.slice(lines[0]?.trim().toLowerCase() === 'termsandcond' ? 1 : 0).filter((l) => !/^\(\d+ rows? affected\)\s*$/i.test(l));
  let html = '';
  for (let i = 0; i < body.length; i++) {
    const line = body[i]!;
    html += line;
    if (line.length !== SSMS_WRAP) html += '\n'; // a full-width line was wrapped by SSMS, not a real break
  }
  html = html.trim();
  const capped = html.length >= SSMS_CAP - 2;
  return { html, note: capped ? `single value, CAPPED at ${html.length} chars: re-export with the chunked query` : `single value, ${html.length} chars` };
}

let html: string | undefined;
let note = '';
if (existsSync(TXT)) {
  ({ html, note } = fromResultsFile(readFileSync(TXT, 'utf8')));
  note = `${TXT} (${note})`;
} else if (existsSync(JSON_FILE)) {
  const rows = (JSON.parse(readFileSync(JSON_FILE, 'utf8')) as { rows: { configVar: string; configValLong: string }[] }).rows;
  html = rows.find((r) => r.configVar === 'termsAndCond')?.configValLong;
  note = `${JSON_FILE} (workbook cell, truncated at 32,767)`;
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
const wanted = ['privacy-policy', 'shipping-policy', 'returns-ref-policy', 'accessibilityStatement'];
const found = wanted.filter((id) => new RegExp(`(id|name)=["']?${id}`).test(html!));
console.log(`Wrote ${OUT} (${html.length} chars) from ${note}`);
console.log(`Policy anchors: ${found.length ? found.join(', ') : 'none'}${found.length < wanted.length ? ` — missing ${wanted.filter((w) => !found.includes(w)).join(', ')}` : ''}`);
