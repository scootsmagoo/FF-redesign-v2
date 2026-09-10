import { legacyPathToCanonical, legacySlugToV2, slugify } from './urls';

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('GE Refrigerator Water Filters')).toBe('ge-refrigerator-water-filters');
    expect(slugify('Pool & Spa')).toBe('pool-and-spa');
    expect(slugify('already-clean')).toBe('already-clean');
  });
});

describe('legacySlugToV2', () => {
  it('strips .asp and normalises case', () => {
    expect(legacySlugToV2('WFCB-Frigidaire-PureSourcePlus-Water-Filter.asp')).toBe(
      'wfcb-frigidaire-puresourceplus-water-filter',
    );
  });
});

describe('legacyPathToCanonical', () => {
  it('maps category URLs', () => {
    expect(legacyPathToCanonical('/GE-Replacement-Refrigerator-Water-Filter-Cat.asp')).toBe(
      '/c/ge-replacement-refrigerator-water-filter',
    );
  });

  it('maps product URLs with and without the p- prefix', () => {
    expect(legacyPathToCanonical('/WF2CB-Frigidaire-PureSource2-Water-Filter-FC-100.asp')).toBe(
      '/p/wf2cb-frigidaire-puresource2-water-filter-fc-100',
    );
    expect(legacyPathToCanonical('/p-filters-fast-sp12-chrome-plated-shower-head.asp')).toBe(
      '/p/filters-fast-sp12-chrome-plated-shower-head',
    );
  });

  it('collapses the mobile tree', () => {
    expect(legacyPathToCanonical('/mobile/')).toBe('/');
    expect(legacyPathToCanonical('/mobile/cart.asp')).toBe('/cart');
    expect(legacyPathToCanonical('/mobile/Amana-Refrigerator-Water-Filters-cat.asp')).toBe(
      '/c/amana-refrigerator-water-filters',
    );
  });

  it('keeps model pages, normalised', () => {
    expect(legacyPathToCanonical('/models/00hww04')).toBe('/models/00HWW04');
    expect(legacyPathToCanonical('/models/-R355%20Reverse%20Osmosis%20System')).toBe(
      '/models/-R355%20REVERSE%20OSMOSIS%20SYSTEM',
    );
    expect(legacyPathToCanonical('/modellookup/ABC123')).toBe('/models/ABC123');
  });

  it('routes friendly aliases and plumbing', () => {
    expect(legacyPathToCanonical('/HFC')).toBe('/home-filter-club');
    expect(legacyPathToCanonical('/default.asp')).toBe('/');
    expect(legacyPathToCanonical('/10_Logon.asp')).toBe('/');
    expect(legacyPathToCanonical('/filters/merv%2013')).toBe('/search?q=merv%2013');
  });

  it('leaves v2 paths alone', () => {
    expect(legacyPathToCanonical('/p/foo')).toBeNull();
    expect(legacyPathToCanonical('/c/foo')).toBeNull();
    expect(legacyPathToCanonical('/')).toBeNull();
    expect(legacyPathToCanonical('/promo/SAVE10')).toBeNull();
  });
});
