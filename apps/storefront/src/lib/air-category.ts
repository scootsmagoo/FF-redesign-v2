import { legacyCat as cat } from './legacy-links';

/**
 * Editorial content of the Air Filters category page (legacy Air-Filters-Purifiers-cat.asp +
 * cat.banner.desktop.css): hero copy, the sixteen "Popular Air Filter Brands" logos, the MERV
 * guide and the FAQ. Hard-coded on the live site too.
 */
export const AIR_CATEGORY_SLUG = 'air-filters-purifiers';

export const AIR_HERO = {
  heading: 'Find Replacement Air Filters Fast & Easy!',
  copy: 'While many people worry about outdoor air quality, statistics show that they actually should be more concerned about indoor air quality (IAQ). IAQ is the measure of harmful pollutants discovered within or around your home. The EPA ranks IAQ as one of the top five public health risks.',
  image: 'https://www.filtersfast.com/images/category-images/AirFilterHeroImage.jpg',
};

/** name, legacy category, logo file (live /images folder) */
export const AIR_BRANDS: { name: string; href: string; logo: string }[] = [
  { name: 'Air Bear', href: cat('Trion-Air-Bear-cat.asp'), logo: 'airbear.jpg' },
  { name: 'Aprilaire', href: cat('Aprilaire-Space-Gard-cat.asp'), logo: 'aprilaire.jpg' },
  { name: 'Bryant', href: cat('Carrier-Bryant-cat.asp'), logo: 'bryant.jpg' },
  { name: 'Carrier', href: cat('Carrier-Bryant-cat.asp'), logo: 'carrier-2.jpg' },
  { name: 'Filters Fast® Air', href: cat('Filters-Fast-Air-cat.asp'), logo: 'FiltersFast-Air.png' },
  { name: 'Filtrete', href: cat('3m-filtrete-air-filters-cat.asp'), logo: '3M-filtrete.jpg' },
  { name: 'Five Seasons', href: cat('Five-Seasons-Air-Filters-Cat.asp'), logo: 'five-seasons.jpg' },
  { name: 'Generalaire', href: cat('GeneralAire-Replacement-Furnace-Filters-cat.asp'), logo: 'Generalaire-2.jpg' },
  { name: 'Goodman', href: cat('Goodman-Air-Filters-Cat.asp'), logo: 'Goodman-2.jpg' },
  { name: 'Honeywell', href: cat('Honeywell-AC-Filters-Cat.asp'), logo: 'Honeywell.jpg' },
  { name: 'Lennox', href: cat('Lennox-Air-Filters-cat.asp'), logo: 'Lennox.jpg' },
  { name: 'Totaline', href: cat('Totaline-Furnace-Filters-Cat.asp'), logo: 'Totaline.jpg' },
  { name: 'Trion', href: cat('Trion-Air-Bear-cat.asp'), logo: 'Trion.jpg' },
  { name: 'Trane', href: cat('Trane-Perfect-Fit-cat.asp'), logo: 'Trane.jpg' },
  { name: 'White Rodgers', href: cat('White-Rodgers-AC-Filters-Cat.asp'), logo: 'White-Rodgers.jpg' },
  { name: 'York', href: cat('York-AC-Filters-Cat.asp'), logo: 'york.jpg' },
];

export const MERV_GUIDE = {
  heading: 'A Quick Guide to MERV Ratings',
  intro: 'The Minimum Efficiency Reporting Value (MERV) is used by manufacturers to explain how efficient the air filter is at trapping airborne particles. Before you choose a MERV rating check with your HVAC manufacturer to see what your system is designed to handle. Picking the wrong filter can impact air flow and reduce equipment life.',
  levels: [
    ['MERV 8', 'Equipment Protection, Lint and Dust, Pollen, Pet Dander, Mold Spores, Dust Mites'],
    ['MERV 11', 'Equipment Protection, Lint and Dust, Pollen, Pet Dander, Mold Spores, Dust Mites, Fine Dust, Auto Emissions, Smoke'],
    ['MERV 13', 'Equipment Protection, Lint and Dust, Pollen, Pet Dander, Mold Spores, Dust Mites, Fine Dust, Auto Emissions, Smoke, Very Fine Dust, Bacteria'],
  ] as [string, string][],
  image: 'https://www.filtersfast.com/images/D-Air-FAQ.jpg',
};

export const AIR_FAQS: { q: string; a: string }[] = [
  { q: 'Can I use the same air filter for both heat and AC?', a: '<p>Yes, both AC filters and furnace filters are the same thing. We categorize filters based on their intended use to make filter shopping easier for the customer. During the summer months you are more likely to search for AC filters. While during colder winter months you are looking to buy furnace filters. A good tip for remembering when to change your filters is to replace them at the start of each new season.</p>' },
  { q: 'Which direction does the air filter go?', a: '<p>Always point the arrow on the box in the direction of airflow. If you are unsure the direction of airflow turn on the system fan. Do not remove the old filter before checking airflow as this might allow dirt or debris to escape.</p>' },
  { q: 'When to change the air filter in your house?', a: '<p>Replace your air filters every 3 months. You may need to replace your filters more frequently depending on air quality. If you are unsure about indoor air quality check the filter monthly. If you notice the filter material is greatly discolored or noticeably dirty change out the filter. Failing to replace air filters as recommended can lead to reduced system efficiency, greater energy costs, and poor air quality.</p>' },
  { q: 'Which air filter is best for allergies?', a: '<p>If you have respiratory problems caused by pollen, dust, mold, or pet dander a MERV 11 filter can help reduce the severity of ailments caused by allergies. If you are sensitive to smoke from cooking or tobacco a MERV 13 filter is recommended. For many allergy sufferers it is recommended you install filters to process both supply and return air. Before you choose a MERV rating check with your HVAC manufacturer to see what your system is designed to handle. Picking the wrong filter can impact air flow and reduce equipment life.</p>' },
  { q: 'Which air filter is best for my home?', a: '<p>Your choice in air filter should depend on needs. MERV 8 filters are perfect if you have no pets and allergies are not a serious concern. MERV 11 filters are recommended for occasional allergy sufferers and homes with pets. A MERV 13 filter should be used if allergies are a serious concern and there are tobacco smokers in the house.</p>' },
  { q: 'Where are they made?', a: '<p>Filters Fast® brand air filters are proudly made in America. While the manufacturing location of products can vary from company-to-company, Country of Origin laws require that most products manufactured outside of America bear labeling that tells consumers where the product is made. This label should be visible on the product itself or the packaging in which it arrived.</p>' },
  { q: 'Are the home air filters electrostatically charged?', a: '<p>Yes, Filters Fast®, Filtrete, Carrier, among many other air filter brands use an electrostatically charged filter media. Fiberglass air filters are far less common today and were never designed to improve air quality, rather they protect HVAC systems from large dirt and debris.</p>' },
];
