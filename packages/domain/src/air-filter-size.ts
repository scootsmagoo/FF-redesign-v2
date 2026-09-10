/**
 * Air-filter size parsing, ported from _INCSearchRedirects.asp getAirFilterSize().
 *
 * Accepts things like "20x25x1", "20 x 25 x 1", "20by25by1", '16" x 20" x 4"',
 * "19 3/4 x 21 1/2 x 1", "20*25*1", "20/25/1" and returns nominal H x W x D.
 * Legacy conventions: the two larger numbers are height/width (smaller first),
 * the smallest is depth, and depth snaps to the stock depths 1/2/4/5/6.
 */

export interface AirFilterSize {
  height: number;
  width: number;
  depth: number;
  /** "20x25x1" style key used for lookups and URLs. */
  key: string;
}

export type SizeParseError =
  | 'not-a-size'
  | 'depth-too-large'
  | 'depth-exceeds-face'
  | 'height-out-of-range'
  | 'width-out-of-range';

export type SizeParseResult = { ok: true; size: AirFilterSize } | { ok: false; error: SizeParseError };

const FRACTIONS: Record<string, number> = {
  '1/16': 0.0625, '1/8': 0.125, '3/16': 0.1875, '1/4': 0.25, '5/16': 0.3125, '3/8': 0.375,
  '7/16': 0.4375, '1/2': 0.5, '9/16': 0.5625, '5/8': 0.625, '11/16': 0.6875, '3/4': 0.75,
  '13/16': 0.8125, '7/8': 0.875, '15/16': 0.9375,
};

const STOCK_DEPTHS = [1, 2, 4, 5, 6];

export function parseAirFilterSize(input: string): SizeParseResult {
  let s = input.toLowerCase().trim();
  s = s.replace(/["”“in(ch(es)?)?]/g, ' ');
  // "19 3/4" -> "19.75"
  s = s.replace(/(\d+)\s+(\d{1,2}\/\d{1,2})/g, (_, whole, frac) => {
    const f = FRACTIONS[frac];
    return f !== undefined ? String(Number(whole) + f) : `${whole} ${frac}`;
  });
  s = s.replace(/(\d{1,2}\/\d{1,2})/g, (frac) => (FRACTIONS[frac] !== undefined ? String(FRACTIONS[frac]) : frac));
  // separators: x, by, *, /
  s = s.replace(/\s*(x|×|by|\*|\/)\s*/g, 'x');
  s = s.replace(/\s+/g, '');

  const m = s.match(/^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)(?:x(\d+(?:\.\d+)?))?$/);
  if (!m) return { ok: false, error: 'not-a-size' };

  const nums = [Number(m[1]), Number(m[2]), m[3] !== undefined ? Number(m[3]) : 1];
  const sorted = [...nums].sort((a, b) => a - b);
  let [depth, height, width] = sorted as [number, number, number];

  if (depth >= 7) return { ok: false, error: 'depth-too-large' };
  if (depth > height || depth > width) return { ok: false, error: 'depth-exceeds-face' };
  if (height > 30 || height < 6) return { ok: false, error: 'height-out-of-range' };
  if (width > 50.625 || width < 6) return { ok: false, error: 'width-out-of-range' };

  depth = snapDepth(depth);

  const key = `${fmt(height)}x${fmt(width)}x${fmt(depth)}`;
  return { ok: true, size: { height, width, depth, key } };
}

/** Nearest stock depth; ties round up (a 3" slot takes a 4" filter better than a 2"). */
function snapDepth(d: number): number {
  return STOCK_DEPTHS.reduce((best, cur) => (Math.abs(cur - d) <= Math.abs(best - d) ? cur : best), STOCK_DEPTHS[0]!);
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : String(n).replace(/\.?0+$/, '');
}

/** Quick test used by the search redirect layer: does this query look like a size at all? */
export function looksLikeAirFilterSize(query: string): boolean {
  return /\d+\s*(x|×|by|\*|\/)\s*\d+/i.test(query);
}
