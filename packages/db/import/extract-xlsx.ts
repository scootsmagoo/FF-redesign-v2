/**
 * Splits the legacy export workbook (scripts/legacy-export/data export.xlsx) into one JSON
 * file per legacy table under packages/db/import/legacy/ (git-ignored).
 *
 * Sheets from single-table queries (query 1, 2, 3, 5) map by sheet name. Multi-table sheets
 * carry a `_table` column; each result set starts with its own header row (first cell
 * literally "_table"), so a sheet is scanned for header rows and split into sections.
 * `query 10.txt` (tab-delimited, tDiscCode) is read the same way.
 *
 * Usage: pnpm --filter @ff/db import:extract [--xlsx <path>] [--txt <path>]
 */
import { createReadStream, mkdirSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, 'legacy');
const arg = (flag: string, fallback: string) => {
  const i = process.argv.indexOf(flag);
  return resolve(i > -1 ? process.argv[i + 1]! : fallback);
};
const XLSX_PATH = arg('--xlsx', join(here, '../../../scripts/legacy-export/data export.xlsx'));
const TXT_PATH = arg('--txt', join(here, '../../../scripts/legacy-export/query 10.txt'));

/** Sheets whose query returned a single table without a `_table` column. */
const SINGLE: Record<string, string> = {
  'query 1': 'products',
  query2: 'categories',
  'query 3': 'Categories_Products',
  'query 5': 'product_images',
};

type Row = Record<string, unknown>;

mkdirSync(OUT, { recursive: true });
for (const f of readdirSync(OUT)) if (f.endsWith('.json')) unlinkSync(join(OUT, f));

const tables = new Map<string, { columns: string[]; rows: Row[] }>();

/** Legacy table names are plain identifiers; anything else is a cell that spilled across rows (multi-line text). */
const VALID_TABLE = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;

function addSection(table: string, columns: string[], rows: unknown[][]) {
  if (!VALID_TABLE.test(table)) {
    console.warn(`  (skipped ${rows.length} spill-over rows starting "${table.slice(0, 40)}…")`);
    return;
  }
  const clean = columns.map((c) => String(c ?? '').trim()).filter((c, i, a) => c && a.indexOf(c) === i);
  const entry = tables.get(table) ?? { columns: clean, rows: [] };
  if (!tables.has(table)) tables.set(table, entry);
  for (const r of rows) {
    if (r.every((v) => v === '' || v === undefined || v === null)) continue;
    const obj: Row = {};
    columns.forEach((c, i) => {
      const key = String(c ?? '').trim();
      if (!key || key === '_table') return;
      const v = r[i];
      obj[key] = v === undefined || v === 'NULL' ? null : v;
    });
    entry.rows.push(obj);
  }
}

console.log(`Reading ${XLSX_PATH} ...`);
const wb = XLSX.readFile(XLSX_PATH, { dense: true, cellDates: false, cellNF: false, cellText: false });
for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name]!;
  const grid = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false, defval: '' });
  if (!grid.length) continue;

  const single = SINGLE[name];
  if (single) {
    addSection(single, grid[0] as string[], grid.slice(1));
    console.log(`  ${name} -> ${single}: ${grid.length - 1} rows`);
    continue;
  }

  // Multi-table sheet: split on header rows.
  let header: string[] | null = null;
  let buf: unknown[][] = [];
  let table = '';
  const flush = () => {
    if (header && table) {
      addSection(table, header, buf);
      console.log(`  ${name} -> ${table}: ${buf.length} rows`);
    }
    buf = [];
  };
  for (const row of grid) {
    const first = String(row[0] ?? '').trim();
    if (first === '_table') {
      flush();
      header = row as string[];
      table = '';
      continue;
    }
    if (!header) continue;
    if (!table) table = first;
    if (first !== table) {
      // a new table can also start without its own header row when columns match; split anyway
      flush();
      table = first;
    }
    buf.push(row);
  }
  flush();
}

// tDiscCode from the tab-delimited text file (too large for Excel).
await (async () => {
  try {
    const rl = createInterface({ input: createReadStream(TXT_PATH, 'utf8') });
    let header: string[] | null = null;
    const rows: unknown[][] = [];
    for await (const line of rl) {
      const cells = line.replace(/^﻿/, '').split('\t');
      if (!header) {
        header = cells.map((c) => c.trim());
        continue;
      }
      rows.push(cells);
    }
    if (header) {
      const table = String(rows[0]?.[0] ?? 'tDiscCode');
      tables.delete(table); // prefer the complete text export over the truncated sheet
      addSection(table, header, rows);
      console.log(`  ${TXT_PATH} -> ${table}: ${rows.length} rows`);
    }
  } catch (e) {
    console.warn(`  (skipped ${TXT_PATH}: ${(e as Error).message})`);
  }
})();

for (const [table, { columns, rows }] of tables) {
  writeFileSync(join(OUT, `${table}.json`), JSON.stringify({ table, columns, rows }), 'utf8');
}
console.log(`\nWrote ${tables.size} tables to ${OUT}:`);
for (const [table, { columns, rows }] of tables) console.log(`  ${table.padEnd(28)} ${String(rows.length).padStart(8)} rows  cols: ${columns.filter((c) => c !== '_table').slice(0, 8).join(', ')}${columns.length > 9 ? ', …' : ''}`);
