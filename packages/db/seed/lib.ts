/** Shared helpers for generating chunked D1 seed SQL (used by seed/build-seed.ts and import/build-import.ts). */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** D1 caps a statement at 100 KB and its SQLite has a small memory budget: keep batches small. */
const MAX_STMT_BYTES = 32_000;
const MAX_STMT_ROWS = 100;
/** wrangler's remote runner takes one file per call; keep files modest so a failure is cheap to retry. */
const CHUNK_BYTES = 1_500_000;

/** SQL literal. Empty strings stay empty (NOT NULL text columns rely on that); callers pass null for NULL. */
export function q(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'boolean') return v ? '1' : '0';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
  return `'${String(v).replace(/'/g, "''")}'`;
}

export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function toCents(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number.parseFloat(String(v).replace(/[$,]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

export function toInt(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number.parseInt(String(v), 10);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number.parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

/** Legacy booleans come as 1/0, -1/0, 'Y'/'N', true/false. */
export function toBool(v: unknown): boolean {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'number') return v !== 0;
  const s = String(v).trim().toUpperCase();
  return s === 'Y' || s === 'TRUE' || s === '1' || s === '-1';
}

export function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' || s === 'NULL' ? null : s;
}

/** Excel serial date (from the workbook export) or ISO/SQL string → ISO-8601. */
export function toIso(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') {
    if (v < 20000 || v > 80000) return null;
    return new Date(Math.round((v - 25569) * 86400 * 1000)).toISOString();
  }
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Legacy OCR-style model normalisation (O/Q→0, B→8, S→5, I/L→1, punctuation stripped). */
export function normalizeModel(m: string): string {
  return m
    .toUpperCase()
    .replace(/[-\s/\\_$!#%*+@^&=.()'"]/g, '')
    .replace(/O|Q/g, '0')
    .replace(/B/g, '8')
    .replace(/S/g, '5')
    .replace(/I|L/g, '1');
}

export class SqlWriter {
  private statements: string[] = [];

  constructor(private readonly outDir: string) {}

  raw(sql: string) {
    this.statements.push(sql);
  }

  insert(table: string, columns: string[], rows: (string | number | boolean | null | undefined)[][], mode: 'REPLACE' | 'IGNORE' = 'REPLACE') {
    const head = `INSERT OR ${mode} INTO ${table} (${columns.join(',')}) VALUES\n`;
    let chunk: string[] = [];
    let size = head.length;
    const flush = () => {
      if (chunk.length) this.statements.push(head + chunk.join(',\n') + ';');
      chunk = [];
      size = head.length;
    };
    for (const r of rows) {
      const v = `(${r.map(q).join(',')})`;
      if (size + v.length + 2 > MAX_STMT_BYTES || chunk.length >= MAX_STMT_ROWS) flush();
      chunk.push(v);
      size += v.length + 2;
    }
    flush();
  }

  /** Writes seed-NNN.sql chunk files and returns how many were written. */
  write(): number {
    rmSync(this.outDir, { recursive: true, force: true });
    mkdirSync(this.outDir, { recursive: true });
    let chunk: string[] = [];
    let bytes = 0;
    let files = 0;
    const flush = () => {
      if (!chunk.length) return;
      writeFileSync(join(this.outDir, `seed-${String(files++).padStart(3, '0')}.sql`), chunk.join('\n\n') + '\n', 'utf8');
      chunk = [];
      bytes = 0;
    };
    for (const stmt of this.statements) {
      if (bytes + stmt.length > CHUNK_BYTES) flush();
      chunk.push(stmt);
      bytes += stmt.length;
    }
    flush();
    return files;
  }
}
