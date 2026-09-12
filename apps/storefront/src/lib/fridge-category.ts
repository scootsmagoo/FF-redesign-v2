import { legacyCat as cat } from './legacy-links';

/**
 * Editorial content of the Refrigerator Water Filters category page (legacy
 * Refrigerator-Water-Filters-cat.asp + cat.banner.desktop.css): hero copy, the model-number
 * help, the eleven popular brands, the NSF guide and the FAQ. Hard-coded on the live site too.
 * The A–Z "Shop All Refrigerator Brands" list comes from the category's brand children.
 */
export const FRIDGE_CATEGORY_SLUG = 'refrigerator-water-filters';

export const FRIDGE_HERO = {
  heading: 'Refrigerator Water Filters Certified for NSF Standards.',
  sub: 'Drink only the best and choose from our large selection of brand name filters guaranteed to provide long lasting value.',
  placeholder: 'Enter Filter # or Refrigerator Model',
  image: 'https://www.filtersfast.com/images/category-images/FridgeFilterHeroImage.jpg',
  helpTips: ['Check the label on the side of your refrigerator water filter for the model or serial number.', 'Check your refrigerator manufacturing label for the model number.'],
  helpImages: ['https://www.filtersfast.com/images/ff-filter-part-number-image.png', 'https://www.filtersfast.com/images/model-number-sticker.png'],
};

export const FRIDGE_POPULAR: { name: string; href: string }[] = [
  { name: 'GE Appliances', href: cat('GE-Refrigerator-Water-Filters-cat.asp') },
  { name: 'Whirlpool', href: cat('Whirlpool-Replacement-Refrigerator-Water-Filter-Cat.asp') },
  { name: 'LG', href: cat('LG-Refrigerator-Water-Filters-cat.asp') },
  { name: 'Samsung', href: cat('Samsung-Refrigerator-Water-Filters-cat.asp') },
  { name: 'Frigidaire', href: cat('Frigidaire-Refrigerator-Water-Filters-cat.asp') },
  { name: 'Kitchen Aid', href: cat('kitchenaid-Refrigerator-Water-Filters-cat.asp') },
  { name: 'Kenmore', href: cat('Kenmore-Refrigerator-Water-Filters-cat.asp') },
  { name: 'Maytag', href: cat('Maytag-Refrigerator-Water-Filters-cat.asp') },
  { name: 'Bosch', href: cat('Bosch-Replacement-Refrigerator-Water-Filter-Cat.asp') },
  { name: 'Electrolux', href: cat('Electrolux-Replacement-Refrigerator-Water-Filter-Cat.asp') },
  { name: 'Amana', href: cat('Amana-Replacement-Refrigerator-Water-Filter-Cat.asp') },
];
export const FRIDGE_IMAGE = 'https://www.filtersfast.com/images/refrigerator-stainless.jpg';

export const NSF_GUIDE = {
  heading: 'A Quick Guide to NSF Standards',
  intro: "When purchasing a refrigerator filter, you will want to ensure that the filter has been tested and certified by the NSF. There are a few different NSF certifications you will see when shopping for fridge filters. Here's a simple guide to help you know what each NSF certification means.",
  levels: [
    ['NSF 42', 'This means that the filter has been tested and certified to reduce chlorine taste and odor.'],
    ['NSF 53', 'This means that the filter has been tested and certified to reduce harmful contaminants that can cause health effects. This can mean contaminants including lead, mercury, and more.'],
  ] as [string, string][],
  image: 'https://www.filtersfast.com/images/D-Fridge-FAQ.jpg',
};

export const FRIDGE_FAQS: { q: string; a: string }[] = [
  { q: 'What is a Refrigerator Water Filter?', a: "<p>A refrigerator water filter is designed to purify the water in a fridge with a water dispenser and/or ice maker. They remove bacteria, contaminants, and other harmful impurities from the water. This means that every time you use the filtered water and ice from your fridge, you're consuming clean and safe water.</p><p>Refrigerator filters typically last up to six months before they need to be replaced. Replacing your refrigerator water filter regularly will ensure the water you get from your refrigerator is always clean. With a fridge filter, you can have peace of mind knowing you're getting filtered and healthy water with every sip.</p>" },
  { q: 'Why do you need to change your Refrigerator Water Filter?', a: "<p>Changing fridge water filters is important because it helps to reduce contaminants like chlorine, lead, rust, and other particles. Depending on your location and water source, the contaminants in your drinking water may vary.</p><p>It's important to change the water filter in your refrigerator to maintain optimal performance and keep your drinking water safe. Filters need to be changed regularly to get rid of dirt, debris, chlorine, and other impurities that can end up in your water. Keeping your filter up-to-date is the best way to guarantee clean and healthy drinking water.</p><p>We know how hard it can be to remember what filter you need and when to change it, which is why we created the <a href=\"/home-filter-club\">Home Filter Club</a>! Our refrigerator filter subscription program will send you the filter you need right when it needs to be changed.</p>" },
  { q: 'What kind of contaminants are in my drinking water?', a: '<p>Testing your drinking water is the best way to find out what kind of contaminants might be in it. Your water quality will depend on where you live and how your water is treated. The most common water sources in the United States are municipal water or well water supplies.</p><p>Depending on where your water comes from, it can include microorganisms like bacteria and parasites, minerals like arsenic and lead, organic pollutants like agricultural runoff, and industrial pollutants like pharmaceuticals. These pollutants can enter your water supply through the pipes and plumbing or may originate in surface water and may be exposed to agricultural and industrial sources. By having your water tested, you can ensure that you and your family are drinking safe and clean water.</p>' },
  { q: 'How do I find the correct water filter for my refrigerator?', a: "<p>To find the correct fridge filter replacement, you should start by checking the model number of your refrigerator. You can also search for your refrigerator water filter replacement by locating the filter part number on your existing filter.</p><p>Once you have this information, you can use the search box to find the filter you need. This will allow you to identify the correct water filter for your refrigerator including specific dimensions and details about installation. Once you have the correct filter, experts recommend replacing your filter every six months.</p><p>When selecting a replacement refrigerator filter, you will want to make sure that the filter has been tested and certified to remove the contaminants you need it to. The most common types of certifications that you'll want to look for are NSF 42 and NSF 53.</p><p>If a filter is NSF 42 certified this means that the filter will reduce aesthetic contaminants like chlorine taste and odor. An NSF 53-certified filter means that the filter will reduce contaminants that are known to cause adverse health effects like lead and mercury as well as chlorine taste and odor.</p>" },
];
