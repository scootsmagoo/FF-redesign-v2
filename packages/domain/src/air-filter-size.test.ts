import { looksLikeAirFilterSize, parseAirFilterSize } from './air-filter-size';

describe('parseAirFilterSize', () => {
  const ok = (q: string) => {
    const r = parseAirFilterSize(q);
    if (!r.ok) throw new Error(`expected ok for ${q}, got ${r.error}`);
    return r.size.key;
  };

  it('parses common shapes', () => {
    expect(ok('20x25x1')).toBe('20x25x1');
    expect(ok('20 X 25 X 1')).toBe('20x25x1');
    expect(ok('25x20x1')).toBe('20x25x1');
    expect(ok('20 by 25 by 1')).toBe('20x25x1');
    expect(ok('16"x20"x4"')).toBe('16x20x4');
    expect(ok('20*25*2')).toBe('20x25x2');
    expect(ok('20/25/1')).toBe('20x25x1');
  });

  it('handles fractions and missing depth', () => {
    expect(ok('19 3/4 x 21 1/2 x 1')).toBe('19.75x21.5x1');
    expect(ok('20x25')).toBe('20x25x1');
  });

  it('snaps depth to stock depths', () => {
    expect(ok('20x25x3')).toBe('20x25x4');
    expect(ok('20x25x0.75')).toBe('20x25x1');
  });

  it('rejects out-of-range input', () => {
    expect(parseAirFilterSize('20x25x8')).toEqual({ ok: false, error: 'depth-too-large' });
    expect(parseAirFilterSize('40x50x1')).toEqual({ ok: false, error: 'height-out-of-range' });
    expect(parseAirFilterSize('5x5x1')).toEqual({ ok: false, error: 'height-out-of-range' });
    expect(parseAirFilterSize('20x25x22')).toEqual({ ok: false, error: 'depth-too-large' });
    expect(parseAirFilterSize('edr3rxd1')).toEqual({ ok: false, error: 'not-a-size' });
  });

  it('detects size-like queries', () => {
    expect(looksLikeAirFilterSize('20x25x1 merv 13')).toBe(true);
    expect(looksLikeAirFilterSize('whirlpool filter 3')).toBe(false);
  });
});
