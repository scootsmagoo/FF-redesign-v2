/**
 * Appliance model and part-number normalisation, shared by the importer, the search
 * short-circuits and the manager. Mirrors the legacy OCR-style matching: punctuation stripped,
 * upper-cased, look-alike characters folded (O/Q→0, B→8, S→5, I/L→1) so "wf-2cb" and "WF2CB"
 * resolve to the same key.
 */
export function normalizeModelNumber(m: string): string {
  return m
    .toUpperCase()
    .replace(/[-\s/\\_$!#%*+@^&=.()'"]/g, '')
    .replace(/O|Q/g, '0')
    .replace(/B/g, '8')
    .replace(/S/g, '5')
    .replace(/I|L/g, '1');
}

/** Cross-reference part numbers use the same key. */
export const normalizePartNumber = normalizeModelNumber;

/**
 * Parses the legacy "Compatible Models Change" textarea: one model per line as
 * `Manufacturer, Model Number, Category` (category optional). Blank lines are skipped;
 * a line with only a model number keeps the supplied default manufacturer.
 */
export function parseModelLines(text: string, defaults: { manufacturer?: string; category?: string } = {}): { manufacturer: string; modelNumber: string; category: string | null }[] {
  const out: { manufacturer: string; modelNumber: string; category: string | null }[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const parts = line.split(/\s*[,\t|]\s*/).map((p) => p.trim());
    let manufacturer = defaults.manufacturer ?? '';
    let modelNumber = '';
    let category = defaults.category ?? null;
    if (parts.length >= 2) {
      manufacturer = parts[0] || manufacturer;
      modelNumber = parts[1] ?? '';
      if (parts[2]) category = parts[2];
    } else {
      modelNumber = parts[0] ?? '';
    }
    if (modelNumber) out.push({ manufacturer, modelNumber, category });
  }
  return out;
}

/** Parses cross-reference lines `Brand, PART-NUMBER` (brand optional). */
export function parsePartLines(text: string, defaultBrand = ''): { brand: string; sku: string }[] {
  return parseModelLines(text, { manufacturer: defaultBrand }).map((m) => ({ brand: m.manufacturer, sku: m.modelNumber }));
}
