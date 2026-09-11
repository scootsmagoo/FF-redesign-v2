/**
 * Splits the legacy export workbook (scripts/legacy-export/data export.xlsx) into one JSON
 * file per legacy table under packages/db/import/legacy/ (git-ignored).
 *
 * Sheets from single-table queries (query 1, 2, 3, 5) map by sheet name. Multi-table sheets
 * carry a `_table` column; each result set starts with its own header row (first cell
 * literally "_table"), so a sheet is scanned for header rows and split into sections.
 * `query 10.txt` (tab-delimited, tDiscCode) is read the same way.
 *
 * Usage: pnpm --filter @ff/db import:extract [--xlsx <path>] [--txt <path>] [--merge]
 *   --merge  add/replace the tables found in this workbook and keep every other JSON file
 *            (used for the re-run workbooks that fill gaps in the first export); the big
 *            text exports are not re-read in this mode.
 */
import { createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
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
const MERGE = process.argv.includes('--merge');
/** Result sets that are diagnostics, not data (the rerun scripts list similarly named tables when one is missing). */
const SKIP_TABLES = new Set(['candidates']);

/** Sheets whose query returned a single table without a `_table` column. */
const SINGLE: Record<string, string> = {
  'query 1': 'products',
  query2: 'categories',
  'query 3': 'Categories_Products',
  'query 5': 'product_images',
};

type Row = Record<string, unknown>;

mkdirSync(OUT, { recursive: true });
if (!MERGE) for (const f of readdirSync(OUT)) if (f.endsWith('.json')) unlinkSync(join(OUT, f));

const tables = new Map<string, { columns: string[]; rows: Row[] }>();

/** Legacy table names are plain identifiers; anything else is a cell that spilled across rows (multi-line text). */
const VALID_TABLE = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;

function addSection(table: string, columns: string[], rows: unknown[][]) {
  if (SKIP_TABLES.has(table)) {
    console.warn(`  (${table}: ${rows.length} rows, diagnostic only: ${rows.map((r) => `${r[1]}.${r[2]}`).join(', ')})`);
    return;
  }
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

/**
 * Tab-delimited text exports for tables too large for Excel. A header row is used when the
 * first line looks like one; otherwise `columns` supplies the names (bcp / "Save Results As"
 * without headers). A text export always replaces the (truncated) sheet of the same table.
 */
const TEXT_EXPORTS: { file: string; table: string; columns: string[] }[] = [
  { file: TXT_PATH, table: 'tDiscCode', columns: ['_table', 'discCode', 'discTag', 'discStatus'] },
  {
    file: join(dirname(TXT_PATH), 'tFridgeModelLookup.txt'),
    table: 'tFridgeModelLookup',
    columns: ['idModel', 'idProduct', 'Manufacturer', 'FridgeModelNumber', 'Category', 'excludeFromFeed', 'noindex', 'cpAddition'],
  },
];
for (const spec of TEXT_EXPORTS) {
  if (MERGE) break;
  try {
    const rl = createInterface({ input: createReadStream(spec.file, 'utf8') });
    let header: string[] | null = null;
    const rows: unknown[][] = [];
    for await (const line of rl) {
      if (!line.trim()) continue;
      const cells = line.replace(/^﻿/, '').replace(/\r$/, '').split('\t');
      if (!header) {
        const first = cells[0]?.trim() ?? '';
        if (first === '_table' || spec.columns.includes(first)) {
          header = cells.map((c) => c.trim());
          continue;
        }
        header = spec.columns;
      }
      rows.push(cells);
    }
    if (rows.length) {
      tables.delete(spec.table);
      addSection(spec.table, header ?? spec.columns, rows);
      console.log(`  ${spec.file} -> ${spec.table}: ${rows.length} rows`);
    }
  } catch (e) {
    console.warn(`  (skipped ${spec.file}: ${(e as Error).message})`);
  }
}

/**
 * Ad-hoc text exports (`--text <file>`, repeatable): SSMS "Save Results As" (tab-delimited) or
 * "Results to File" (space-padded columns, only safe for tables whose values contain no spaces).
 * The header row names the columns; `_table` in the first column names the table.
 * Customer-keyed tables are filtered to the customers in customer.json so a 4M-row reminders
 * export stays manageable.
 */
const textFiles = process.argv.flatMap((a, i, all) => (a === '--text' && all[i + 1] ? [resolve(all[i + 1]!)] : []));
let customerIds: Set<number> | undefined;
const rowFilters: Record<string, (row: Row) => boolean> = {
  product_order_reminders: (r) => keepCustomer(r.idCust),
  customer_models: (r) => keepCustomer(r.idCust),
};
function keepCustomer(id: unknown): boolean {
  if (!customerIds) {
    customerIds = new Set<number>();
    const file = join(OUT, 'customer.json');
    if (existsSync(file)) for (const c of (JSON.parse(readFileSync(file, 'utf8')) as { rows: Row[] }).rows) customerIds.add(Number(c.idCust));
  }
  return customerIds.has(Number(id));
}
for (const file of textFiles) {
  const rl = createInterface({ input: createReadStream(file, 'utf8') });
  let header: string[] | null = null;
  let table = '';
  let split: (line: string) => string[] = (l) => l.split('\t');
  let kept = 0;
  let total = 0;
  const rows: unknown[][] = [];
  for await (const raw of rl) {
    const line = raw.replace(/^﻿/, '').replace(/\r$/, '');
    if (!line.trim()) continue;
    if (!header) {
      split = line.includes('\t') ? (l) => l.split('\t') : (l) => l.trim().split(/\s+/);
      header = split(line).map((c) => c.trim());
      continue;
    }
    if (/^-+(\s+-+)*\s*$/.test(line) || /^\(\d+ rows? affected\)/i.test(line)) continue;
    const cells = split(line).map((c) => c.trim());
    if (!table) table = cells[0] ?? '';
    total++;
    const filter = rowFilters[table];
    if (filter) {
      const obj: Row = {};
      header.forEach((h, i) => (obj[h] = cells[i]));
      if (!filter(obj)) continue;
    }
    kept++;
    rows.push(cells);
  }
  if (header && table) {
    tables.delete(table);
    addSection(table, header, rows);
    console.log(`  ${file} -> ${table}: ${kept} rows${kept !== total ? ` (of ${total}, filtered to imported customers)` : ''}`);
  }
}

for (const [table, { columns, rows }] of tables) {
  writeFileSync(join(OUT, `${table}.json`), JSON.stringify({ table, columns, rows }), 'utf8');
}
console.log(`\nWrote ${tables.size} tables to ${OUT}:`);
for (const [table, { columns, rows }] of tables) console.log(`  ${table.padEnd(28)} ${String(rows.length).padStart(8)} rows  cols: ${columns.filter((c) => c !== '_table').slice(0, 8).join(', ')}${columns.length > 9 ? ', …' : ''}`);
