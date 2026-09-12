import { legacyCat as cat } from './legacy-links';

/**
 * Editorial content of the Water Filters category page (legacy water-filters-cat.asp +
 * cat.banner.desktop.css): hero copy, the six popular-brand logos and the three "Shop by Water
 * Filter Type" cards. The description and FAQ below the product list come from the Manager.
 */
export const WATER_CATEGORY_SLUG = 'water-filters';
const IMG = 'https://www.filtersfast.com';

export const WATER_HERO = {
  heading: 'Your #1 Source for Water Filters',
  sub: 'Search for your Water Filter by entering the filter number, type of filter, manufacturer or model number.',
  placeholder: 'Enter Filter # or Manufacturer',
  image: `${IMG}/images/category-images/ac-waterfilterstest-darkhero.jpg`,
  helpTips: ['Check your Water Filter manufacturing label for the model number.'],
  helpImages: [`${IMG}/images/ff-filter-part-number-image.png`, `${IMG}/images/model-number-sticker.png`],
};

export const WATER_BRANDS: { name: string; href: string; logo: string }[] = [
  { name: 'Pentair Pentek Water Filters', href: cat('Ametek-Pentek-US-Water-Filters-cat.asp'), logo: `${IMG}/images/pentair-pentek-logo.png` },
  { name: 'Filters Fast Water Filters', href: cat('Filters-Fast-Water-Filters-cat.asp'), logo: `${IMG}/images/FF-shield-logo.png` },
  { name: 'Pentair Everpure Water Filters', href: cat('Everpure-filters-cat.asp'), logo: `${IMG}/images/pentair-everpure-logo.png` },
  { name: 'Aqua-Pure Water Filters', href: cat('Aqua-Pure-Water-Filters-cat.asp'), logo: `${IMG}/images/aquapure-logo-2026.png` },
  { name: 'Watts Water Filters', href: cat('Watts-Flomatic-Water-Filters-cat.asp'), logo: `${IMG}/images/large-watts-logo.jpg` },
  { name: 'DuPont Water Filters', href: cat('Dupont-filters-cat.asp'), logo: `${IMG}/images/dupont-logo.png` },
];

export const WATER_TYPES: { heading: string; image: string; alt: string; links: [string, string][]; shopAll: string }[] = [
  { heading: 'Whole House', image: `${IMG}/ProdImages/FiltersFast-FF10BBPS-50-2.jpg`, alt: 'Whole house filters', shopAll: cat('Whole-House-Water-Filters-cat.asp'), links: [['Whole House', cat('Whole-House-Water-Filters-cat.asp')], ['Reverse Osmosis', cat('Reverse-Osmosis-Water-Filters-cat.asp')], ['Counter Top', cat('counter-top-filters-cat.asp')]] },
  { heading: 'Refrigerator', image: `${IMG}/ProdImages/FILTERSFAST-FF211100-REFRIGERATOR-WATER-FILTER.jpg`, alt: 'Refrigerator filters', shopAll: cat('Refrigerator-Water-Filters-cat.asp'), links: [['Refrigerator', cat('Refrigerator-Water-Filters-cat.asp')], ['Ice Makers', cat('Icemakers-cat.asp')], ['Universal / In-line', cat('In-line-Refrigerator-Water-Filters-cat.asp')]] },
  { heading: 'Pool & Spa', image: `${IMG}/images/wf-landingpage-pool-spa.png`, alt: 'Pool and spa filters', shopAll: cat('Pool-Spa-Filters-cat.asp'), links: [['Pool & Spa', cat('Pool-Spa-Filters-cat.asp')], ['Aquarium', cat('Aquarium-Filters-cat.asp')], ['Garden & Pond', cat('Rainshowr-Gardn-Gro-Garden-Filters-cat.asp')]] },
];
