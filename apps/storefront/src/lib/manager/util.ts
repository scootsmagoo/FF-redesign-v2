/** Small helpers shared by the manager (back-office) modules. */

export const PAGE_SIZE = 50;

export function pageParam(url: URL, key = 'page'): number {
  const n = Number(url.searchParams.get(key) ?? '1');
  return Number.isInteger(n) && n > 0 ? n : 1;
}

export function offsetFor(page: number, pageSize = PAGE_SIZE): number {
  return (Math.max(1, page) - 1) * pageSize;
}

/** "12.34" | "12" | "" → cents (null when blank or not a number). */
export function dollarsToCents(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().replace(/[$,\s]/g, '');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

export function centsToDollars(c: number | null | undefined): string {
  return c === null || c === undefined ? '' : (c / 100).toFixed(2);
}

/** Checkbox / select truthiness for form posts. */
export function toBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  const s = String(v ?? '').trim().toLowerCase();
  return s === 'true' || s === 'on' || s === '1' || s === 'yes' || s === 'y';
}

export function toInt(v: unknown, fallback: number | null = null): number | null {
  if (v === null || v === undefined || v === '') return fallback;
  const n = Number(v);
  return Number.isInteger(n) ? n : fallback;
}

export function toNum(v: unknown, fallback: number | null = null): number | null {
  if (v === null || v === undefined || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** '' → null for optional text columns. */
export function nullIfBlank(v: unknown): string | null {
  const s = v === null || v === undefined ? '' : String(v).trim();
  return s ? s : null;
}

export function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers.map(csvEscape).join(','), ...rows.map((r) => r.map(csvEscape).join(','))].join('\r\n') + '\r\n';
}

/** Parses a pasted CSV/TSV block (first row = headers) into objects. Handles quoted commas. */
export function parseDelimited(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n').filter((l) => l.trim());
  if (!lines.length) return [];
  const delim = lines[0]!.includes('\t') ? '\t' : ',';
  const split = (line: string): string[] => {
    if (delim === '\t') return line.split('\t').map((c) => c.trim());
    const out: string[] = [];
    let cur = '';
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]!;
      if (q) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') q = false;
        else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === ',') {
        out.push(cur);
        cur = '';
      } else cur += ch;
    }
    out.push(cur);
    return out.map((c) => c.trim());
  };
  const headers = split(lines[0]!).map((h) => h.replace(/^﻿/, ''));
  return lines.slice(1).map((l) => {
    const cells = split(l);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = cells[i] ?? ''));
    return row;
  });
}

export function csvResponse(filename: string, body: string): Response {
  return new Response(body, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${filename}"`, 'Cache-Control': 'no-store' } });
}

export function fmtDate(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 16).replace('T', ' ') : '';
}
