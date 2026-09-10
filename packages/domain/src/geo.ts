/** US states and territories (code → name). Territories are not "contiguous" for shipping rules. */
export const US_STATES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut',
  DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois',
  IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana',
  NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York',
  NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania',
  RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah',
  VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  PR: 'Puerto Rico', GU: 'Guam', VI: 'U.S. Virgin Islands', AS: 'American Samoa', MP: 'Northern Mariana Islands',
  AA: 'Armed Forces Americas', AE: 'Armed Forces Europe', AP: 'Armed Forces Pacific',
};

export const CA_PROVINCES: Record<string, string> = {
  AB: 'Alberta', BC: 'British Columbia', MB: 'Manitoba', NB: 'New Brunswick', NL: 'Newfoundland and Labrador',
  NS: 'Nova Scotia', NT: 'Northwest Territories', NU: 'Nunavut', ON: 'Ontario', PE: 'Prince Edward Island',
  QC: 'Quebec', SK: 'Saskatchewan', YT: 'Yukon',
};

/** Countries the store ships to today (legacy header selector). */
export const SHIP_COUNTRIES: Record<string, string> = {
  US: 'United States', CA: 'Canada', AU: 'Australia', GB: 'United Kingdom', IE: 'Ireland', FR: 'France',
  DE: 'Germany', ES: 'Spain', IT: 'Italy', NL: 'Netherlands', BE: 'Belgium', AT: 'Austria', GR: 'Greece',
};

const NON_CONTIGUOUS = new Set(['AK', 'HI', 'PR', 'GU', 'VI', 'AS', 'MP', 'AA', 'AE', 'AP']);

export function isContiguousUS(country: string, region: string): boolean {
  return country === 'US' && !NON_CONTIGUOUS.has(region.toUpperCase());
}

export function regionsFor(country: string): Record<string, string> | null {
  if (country === 'US') return US_STATES;
  if (country === 'CA') return CA_PROVINCES;
  return null;
}

export function isValidPostalCode(country: string, code: string): boolean {
  const c = code.trim();
  if (country === 'US') return /^\d{5}(-\d{4})?$/.test(c);
  if (country === 'CA') return /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/.test(c);
  return c.length >= 3;
}
