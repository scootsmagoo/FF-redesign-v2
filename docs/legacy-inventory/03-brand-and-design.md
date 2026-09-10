# Legacy Inventory 03 — Brand & Design System (extracted from the ASP Classic site)

Generated September 10, 2026 from `FiltersFast` repo CSS/header/footer. Cross-check with `docs/brand/BRAND.md`
(the official brand guide), which wins on any conflict.

**Repo:** `FiltersFast` (ASP Classic / CandyPress Store 2.4 fork) · **Live domain:** `https://www.filtersfast.com` · Mobile split at `/mobile/`

---

## 1. Color Palette

### Core brand colors (by usage count in the two master stylesheets)

| Role | Hex | desktopFF.css | mobileFF.css | Notes |
|---|---|---|---|---|
| **Primary — FF Orange** | `#F26722` | 132 | 117 | THE brand color. All CTAs, add-to-cart, hover accents. |
| **Primary — FF Blue** | `#054F97` | 182 | 110 | Main nav bar bg, headings, card borders, focus rings. |
| **Deep Navy** | `#201E5A` | 19 | 18 | Newsletter signup band bg (`css/desktopFF.css:4595`) |
| White | `#FFFFFF` / `#fff` | 114 / 196 | 94 / 153 | |
| Body text | `#3F3F3F` | 33 | 16 | `body{color:#3F3F3F}` — `css/desktopFF.css:4` |
| Secondary text | `#333` / `#333333` | 66 / 18 | 46 / 13 | |
| Black | `#000` / `#000000` | 105 / 53 | 78 / 49 | |

### Orange family (variants / one-offs)
- `#F26722` — canonical (also written `#f26822`, 5× in `images/header4_5.css`)
- `#F86702` (8×), `#ED8223` (6×), `#E37907` (5×), `#EF7620` (bulk-price emphasis, `desktopFF.css:3597`), `#ED6E09` (active qty-tier border, `:3702`), `#EE511D` (legacy full-cart button, `header4_5.css`), `#F05C1F` (our-brand.asp shop button), `#F58612`/`#FDA74D` (legacy Re-Order gradient), `#F77100` (mobile only, 5×), `#D85A1B` (shower-head CTA focus, `:1992`), `#B34700` (link hover, `:999/1019/1036/1050`), `#FF6400` / `#F58714` (legacy `#ADoffer`), `#E96535` (legacy mobileCart)

### Blue family
- `#054F97` — primary; also `#014E98`, `#004E98`, `#0067CA`, `#005189` (mega-flyout left rail, `:643`), `#003399`, `#0066C0` (15× mobile), `#093763`→`#073763` (our-brand hero band), `#01284D` (cookie banner border/text, `_INCscripts.asp` inline `<style>`), `#1E4FA1`, `#5C8ADA`
- `#19BAED` — free-shipping promo bar background (`desktopFF.css:678`); older value `#1EAAE7` in `images/header4_5.css`
- `#93C9FF` (17×) + `#039` — legacy CandyPress panel headers / search-autocomplete headers (`_INCheader.asp:941,957,961`)
- `#E6EDF5` — mega-menu flyout left rail bg (`:645`)
- `rgba(5,79,151,.1)` — bulk-price pill bg on PLP card (`:5070`)
- `#001E59` (mobile only), `#DFE7F0`, `#BBC3D3`, `#D8DDE6` — soft blue-grays

### Semantic colors
| Role | Hex | Source |
|---|---|---|
| Success / in-stock | `#37B033` | `.ff-plp-stock` `desktopFF.css:5060`; `#freeshipmessage` `:3663` |
| Success (alt banner) | `#146B14` | `p.success` `:1086` |
| Error / required | `#E03838` | `.error-text` `:2651`, `:2654` |
| Error (newsletter) | `#FE1D00` | `.ti-footer__signup-input.ti-error` `:4602` |
| Error (hard red) | `#F00` / `#FF0000` | `p.error{background:#f00}` `:1085`; out-of-stock `.ff-plp-stock-oos` `:5061` |
| Error (checkout) | `#D8000C` on `#FFD2D2` | `#paymentsMethodsContainer .error` `:1190` |
| Legacy price green | `#004F00`, `#1B502B` | `.CPprodPriceT` `:3436`, `.ti_product_price` `:3224` |

### Neutrals / borders
`#CCC`(56)·`#DDD`(10, header borders)·`#E5E5E3`(PLP card border, `:5050`)·`#D3D1C7`(qty btn border)·`#EBEBEB`(icon-button bg)·`#ECECEC`(nav strip bg, `:596`)·`#2A2A2A`(footer bg, `:4632`)·`#464646`(footer input text)·`#C4C4C4`(footer secondary text)·`#FBFBFB`·`#F5F5F5`·`#F7F7F7`(breadcrumb band, `:5099`)·`#B7B7B7`·`#979797`·`#ACACAC`·`#A9A9A9`·`#AAA`(input borders)·`#808080`·`#717171`·`#1A1A1A`(PLP price text)

### Neon / oddball one-offs (legacy, do not carry over)
`#996666` (a:hover, 6×, `:29`), `#B0C4DE` + `#F0E68C` (`style.css` — dead CandyPress checkout table), `#37D42E` (`#todayOnly`), `#17B9EC` (blog text), `#0000FF` (6×), `#069` (5×)

### manifest.json (`manifest.json`)
```json
"background_color": "#F26822",   // orange (note: 822 not 722 — 1-digit drift from the CSS canonical #F26722)
"theme_color": "#FFFFFF",
"short_name": "FiltersFast", "name": "FiltersFast",
"display": "standalone", "start_url": "/", "scope": "/"
```

---

## 2. Typography

**Loader:** Adobe **Typekit** kit `gvz2sfa` — `https://use.typekit.net/gvz2sfa.css` (12 references; `_INCheader_4_2.asp:96`). Google Fonts are self-hosted/inlined via `css/fontsFF.css` (36 KB of `@font-face` pulling `fonts.gstatic.com` woff2).

**Families in `css/fontsFF.css`:**
- `museo-sans-rounded` — **primary UI/brand face** (Typekit)
- `museo-sans-condensed`, `freight-sans-compressed-pro` (Typekit)
- `oswald` — display/banner headlines
- `rubik` — promo CTA buttons
- `'Source Sans Pro'` — footer + newsletter
- `'Open Sans'`, `Lato` — secondary/legacy

**Usage frequency in `desktopFF.css`:** museo-sans-rounded stacks 78× · Source Sans Pro 14× · Open Sans 13× · Lato 18× · Oswald 7× · Verdana/Arial legacy ~25×

**Canonical stack:**
```css
font-family:"museo-sans-rounded",verdana, sans-serif, helvetica;
```

**Base (`css/desktopFF.css:4`):**
```css
body{padding:0;margin:0;font-size:12px;font-family:"museo-sans-rounded",verdana,sans-serif,helvetica;
     color:#3F3F3F;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;scroll-behavior:smooth}
```

**Headings (`:43-47`):** `h1` 24px `#000` center · `h2` 18px `#000` · `h3` 15px `#000`

**Key type tokens:**
| Element | Size / weight | Ref |
|---|---|---|
| Nav top-level | 18px / 500, capitalize, `#fff` | `:598-603` |
| Nav flyout link | 16-18px / 400, lh 30-34px | `:645, :672` |
| Promo bar (`#tiBlueShip`) | 16px, lh 30px | `:678` |
| Tagline `#banner` | 11.5px / 600 | `:720` |
| Header account links | 15px / 700, `#000` | `:161` |
| Banner headline `.discount_heading` | Oswald 38px / 700, lh 42px, `#054f97` | `:1713` |
| Banner CTA `.discount_button` | Rubik 20px, lh 22px | `:1714` |
| PDP price `#tiPricebold` | 38px / bold, `#333` | `:3686` |
| PDP mobile price pop | 28px, `#222222` | `:4012` |
| PLP heading `.ff-plp-heading` | 32px / 600, `#054F97` | `:5044` |
| PLP title | 14px / 600, lh 18.2px, 3-line clamp | `:5057` |
| PLP price current | 18px / 600, `#1A1A1A` | `:5058` |
| PLP retail (strike) | 12px / 400, `rgba(0,0,0,.5)` | `:5059` |
| Footer column header | Source Sans Pro 16px / bold `#fff` | `:4606` |
| Footer legal | Source Sans Pro 14px / normal | `:4627` |
| Newsletter header | `700 20px 'Source Sans Pro'` | `:4596` |
| Breadcrumb | Verdana 13px, links `#333` no-underline | `:2223-2225` |

---

## 3. Logo Assets, Favicons, Tagline

### Shield logo family (`/images/`)
| File | Use |
|---|---|
| `FF-shield-logo-352.png` | **Active header logo** — desktop `250×54`, mobile `220×33` (`_INCheader.asp:5, :674, :527`) |
| `FF-shield-logo-Full.png` | Full lockup — About Us "Why Filters Fast?" (`aboutUs.asp:196`) |
| `FF-shield-logo-WHITE.png` | White/inverse |
| `FF-shield-logo-Black.png` | Black |
| `FF-shield-logo-146.png` / `FF-shield-logo.png` | Alt sizes |
| `FF-shield-icon.png` | **Favicon** (48×48 PNG) |
| `FF-shield-icon.white-bg-backup.png` | Backup |
| `FF-Social-Icon.png` | Apple touch icon + MS tile |
| `ff-logo-canada-red.png` | Canada geo-swap variant (`_INCheader.asp:77`) |
| `FF-Logo-2x.png` / `.webp`, `FiltersFast-logo.png`, `Filters-Fast-Logo.png`, `FF-Intext-Logo-2x.png/.webp` | Legacy wordmarks / in-text |
| `mobile/FilterFast.png` | Legacy mobile |
| `shield.png`, `airShield-tr.png`, `waterShield-tr.png` | Shield mark + homepage tool icons |

**No SVG logo exists** — all logo assets are PNG/WebP. (Action for v2: trace the shield + wordmark to SVG from the official PNGs in `docs/brand/logos/`.)

### Favicons & touch icons (root)
`favicon.ico`, `favicon.png`, `apple-touch-icon.png`, `apple-touch-icon-precomposed.png`, and `touch-icon-{57,60,72,76,114,120,128,144,152,167,180,192,512}.png`

`UserMods/_INCfavicon_.asp` (the only linked set):
```html
<link rel="icon" type="image/png" href="/images/FF-shield-icon.png" sizes="48x48" />
<link rel="shortcut icon" type="image/png" href="/images/FF-shield-icon.png" />
<link rel="apple-touch-icon" href="/images/FF-Social-Icon.png" />
<meta name="msapplication-TileImage" content="/images/FF-Social-Icon.png" />
```

### Tagline & trust copy
- **`Filter. Purify. Protect.`** — logo `title`/`alt` (`_INCheader.asp:674`, `_INCheader_4_2.asp:106`)
- **`#1 Online filtration retailer in the US!`** — `<span id="banner">`; rendered as `<h1>` on the homepage only (`_INCheader.asp:676`)
- `America's Top Online Filtration Retailer` — hero (`default.asp`)
- `Over 71,000 5-star reviews` · `Huge Selection. Unbeatable Quality. 365-Day Returns.`
- Trust seals: `WQA-member-logo.png` (Water Quality Association), `NAFA-logo.png` (National Air Filtration Association), `2022_level-access_Icon_white.svg` (accessibility), `2025-bptw-badge.png`, `regional-awards-multi-year-badge.png` (Top Workplaces 2018-2025), `2024-healthiest-employers-badge.png`
- Value-prop icons: `365-day-return-guarantee-icon.svg`, `savings-bag-icon.svg`, `location-pin-icon.svg`, `family-owned-and-operated-icon.svg`, `purpose-fire-icon.svg`, `handshake-loyalty-icon.svg`, `inclusion-world-icon.svg`, `health-seedling-icon.svg`

---

## 4. Header & Footer Structure

### Header — `_INCheader.asp` (98 KB, the live one; `_INCheader_4_2.asp` is an older variant still linking `/images/header4_5.css`)

**Stacking order inside `<header id="HeaderContainer">` (`:648`):**

1. **`#promotional-container`** — empty div, max-width 1250px (A/B promo injection point) `:647`
2. **`#tiBlueShip` promo bar** (`:657-663`), bg `#19BAED`, white, 30px:
   > **Free Shipping** on orders over **$99** | **FREE 365-DAY RETURNS**
   Both halves are modal triggers (`ToggleFreeShippingModal()` / `ToggleReturnPolicyModal()`). Email-VIP cookie drops threshold to **$75** (`:653`). Suppressed if `hideFreeShipBanner` cookie = 1 (`:1570`).
3. **`#logoContMain`** row:
   - `#LogoContainer` — logo 250×54, padding `15px 0 10px 30px`, then tagline `#banner`
   - `#intPlaceholder` — country/currency selector, 13 locales (US · AU · AT · BE · CA · FR · DE · GR · IE · IT · NL · ES · UK), header "Ship my filters to:" (`:681-778`)
   - `.ti-trust-div` during checkout only — `Secure Checkout` / `365 Day Returns` (`:783-785`)
   - **`#headerLinks`** (right-floated, `:863-936`): `My Account` (hover mega-panel: Track Order / Re-Order Now / My Account / "New Customer? Create an account during checkout!") · `Support` (hover panel with hours & phone) · `Cart (n)`. Items separated by `1px solid #054f97` right borders, 54px tall (`css/desktopFF.css:158`).
   - **`#searchDiv`** — HawkSearch web component (`<hawksearch-search-field>`), 330px / max 28%, placeholder `Search for your filter` (legacy) / `Search by model, part #, size, or brand` (copy referenced in homepage FAQ). Submit button 38×38 bg `#f26722` with inline white SVG magnifier (`:988-1003`).
4. **`#naviLinks` / `ul#navList`** — full-width bar, `background:#054f97`, `display:table`, height 60px, white 18px/500 links; hover → white bg + `2px solid #054f97` border + orange (`#f26722`) text (`css/desktopFF.css:596-635`). Full-screen `#navOverlay` scrim `rgba(0,0,0,.5)` behind open flyouts.

**Top-level nav & children (`_INCheader.asp:1152-1449`):**

| # | Top-level | href | Flyout contents |
|---|---|---|---|
| 1 | **Refrigerator Filters** | `/Refrigerator-Water-Filters-cat.asp` | *Image:* `fridgefilters.jpg`. **Most Popular:** RPWFE, EDR3RXD1, XWFE, EDR1RXD1, LT-1000P, ULTRAWF, EDR4RXD1. **Choose by Brand** (logo tiles): Whirlpool, Maytag, GE, Samsung, Frigidaire, Kenmore, LG, KitchenAid → *View All Brands* |
| 2 | **Air Filters** | `/Air-Filters-Purifiers-cat.asp` | *Image:* `airfilters.jpg`. **Most Popular (sizes):** 20x20x1, 20x25x1, 16x25x1, 20x30x1, 16x20x1, 24x30x1, 30x32x2. **Choose by Brand:** FiltersFast Air, AprilAire, Honeywell, Trion, Lennox, Filtrete, Carrier, Bryant, Trane, Generalaire → *View All Brands* |
| 3 | **Pool & Spa Filters** *(pool season)* / **Humidifier Filters** *(off-season)* — position swaps with #4, driven by `isPoolSeason` | `/Pool-Spa-Filters-cat.asp` | *Image:* `spa-filters.jpeg`. **Choose by Pool Filter Brand:** Hayward, Pentair, Intex, Waterway, Jandy, Sta-Rite. **Choose by Spa Filter Brand:** Master Spas, Bullfrog, Pleatco, Sundance, Coleman, Hot Spring → two *View All Brands* |
| 4 | **Water Filters** | `/water-filters-cat.asp` | *Image:* `waterfilter.jpg`. **Most Popular:** Pentek, Filters Fast®, Everpure, 3M Aqua-Pure, Watts, Dupont. **Choose by Type:** Whole House, Under Sink, Counter Top, Pitcher, Reverse Osmosis, Faucet, Shower, Universal/Inline, RV/Marine → *View All* |
| 5 | **Humidifier Filters** *or* **Pool & Spa Filters** (seasonal counterpart) | `/Humidifier-Filters-cat.asp` | no flyout (when humidifier) |
| 6 | **More Products** | `#` | Tabbed `.obx-flyout`: left rail (bg `#E6EDF5`) with 3 tabs + **Sale** link → `/overstock-items-cat.asp` |

**"More Products" mega-flyout panels (`:1352-1446`):**
- **Replacement Filters** — Furnace, Coffee, Aquarium, Car Air, Air Purifier, Ice Machine Water, Range Hood, Vacuum, Refrigerator Air, Microwave
- **Filtration Systems** — *col 1:* Air Purifiers, Humidifiers, Dehumidifiers, Whole House Water Filter Systems, Under Sink Water Filter Systems · *col 2:* Reverse Osmosis Filter Systems, Countertop Water Filter Systems, Gravity Water Filter Systems, UV Water Treatment, UV Air Treatment
- **and More!** — *Featured Categories:* Appliance Parts, Sump Pumps, Pet Products, Pond Water Pumps, Air Filtration Masks, Home Wellness, Personal Care · *Home Essentials:* Ice Makers, Thermostats, Filtered Shower Heads, Water Softeners, Faucets · *(col 3):* Pitchers, Water Test Kits, Vacuum Bags, Leak Detectors, Inline Shower Filters
- **Right promo rail** 276px, caption bar `background:#054F97` white 14px/700: `Breathe Better. Drink Cleaner.` (`breathe-better.jpg`) and `Fresh Filters. Cleaner Air.` (`fresh-filters.jpg`)

**Mobile header (`_INCheader.asp:298-560`)** — off-canvas `#tiSideMenu` with same 5 groups + 3-tier "More Products" accordion, then `#tiMobileAccount` containing two promo cards (`.promo-blue`: *Save with Filters Fast® Filters* + checklist Same Great Quality / Lower Prices / Efficient Filters; `.promo-gray`: *Home Filter Club — Get FREE shipping on every order!*), Support, My Account, Live Chat, `704-228-9166`, Blog, Forums.

### Footer — `_INCfooter.asp` (live) / `_INCfooter_2.asp` (older variant)

**`.ti474_footer-header`** — 3-column CTA strip (`_INCfooter.asp:66-104`), bg `#2A2A2A`:
| Icon | Title | Body |
|---|---|---|
| `icon-reorder.svg` | Reorder Filters | Login. Confirm Order. Done |
| `icon-house.svg` | Home Filter Club | Filtration essentials delivered on a customizable schedule. |
| `icon-support.svg` | Additional Questions? | Email us / call `(866) 438-3458` / **Text us:** `(704) 228-9166` |

**`.ti-footer__main`** columns (bg `#2A2A2A`, `css/desktopFF.css:4632`):
1. **Products** — Refrigerator Water Filters · Air Filters · Water Filters · Pool Filters · Spa Filters · Humidifier Filters
2. **Company** — About Us · Reviews  ▸ **Discounts & Rewards** — Military Discount (`/idme/`)
3. **Giving Back** — Wine To Water · Cystic Fibrosis Foundation (`/xtreme-hike/`) · Habitat for Humanity
4. **Contact Us** — hours block: `Monday - Thursday / 9am-12:30pm ET / 1:30pm-5:30pm ET` · `Friday / 9am-1:30pm ET`; then FAQs · Blog · Forums
5. **Connect With Us** — social + Google Customer Reviews badge (merchant_id `80076`) + **Accessibility** (Level Access icon, `levelaccess.com/a/filtersfast`)

**Newsletter signup** (`.ti-footer__signup`, currently commented out in `_INCfooter.asp:36-66`, live in `_INCfooter_2.asp:26`): bg `#201E5A`, white; label **"Get the latest deals and more."** (700 20px Source Sans Pro), input 342×38 radius 4px, placeholder `Enter Email Address`, submit `Sign Up`. Posts to `/reCaptcha.asp` with reCAPTCHA v3 (site key in the legacy source).

**Legal bar `.ti-footer__terms-of-use`** (bg `#2A2A2A` → `rgba(0,0,0,.2)`, 14px Source Sans Pro):
```
©2005-<%=year(now())%> [Filters Fast LLC in #f26722] . All Rights Reserved
```
Links (`#C4C4C4`, pipe-separated by `border-right`): Terms of Use · Privacy Policy · Accessibility Statement · Sitemap · Model Lookup

**Payment icons** exist at `/images/{Visa,MasterCard,AmericanExpress,Discover,PayPal,amex,applepay-logo,google-pay-logo,venmo-logo}.svg` — used on checkout (`mobile/50_PaySubmit.asp`), **not in the footer**.

---

## 5. Component Styles

**Buttons**
| Component | Spec | Ref |
|---|---|---|
| **Primary CTA / Add-to-Cart (PLP)** `.ff-plp-atc` | bg `#F26722`, `border-radius:8px`, no border, `#FFF`, 13px/400, `padding:10px 8px`, min-height 35px, focus `2px solid #054F97` offset 2px | `desktopFF.css:5072` |
| **Add-to-Cart (PDP)** `button.ti-atc-btn` | `background:rgb(242,103,34)`, no border, `#fff`, 16px/500, `padding:15px 42px 14px` (square) | `:4294` |
| **Add-to-Cart (SxS)** | bg `#f26722`, 43px tall/lh, 16px, max-width 260px | `:4049` |
| **Banner CTA** `a.discount_button` | bg `#F26722`, `#fff`, `padding:12.4px 49px`, **Rubik** 20px, square | `:1714` |
| **Shower-head CTA variant** | `padding:8px 36px`, Rubik 16px/600, uppercase, `letter-spacing:.5px`, focus `#d85a1b` | `:1990-1992` |
| **Small form submit** `.submitBtn` | 82×35, bg `#f26722`, `border-radius:3px`, 16px `#fff` | `:904` |
| **Homepage brand CTA** `.filter_info-button` | Lato 600 16px, bg `#F26722`, `padding:12px 24px`, square | `:2041` |
| **Homepage brand-select** `.hpddcta` | 66×57, bg `#f26722`, 14px bold `#fff` | inline `default.asp` |
| **Secondary / neutral** `.btn` | `#e7e9ec` gradient `#f7f8fa→#e7e9ec`, `border-radius:3px`, Arial 14px, `padding:10px 20px`; hover → `#d8dde6` | `:1038-1039` |
| **Orange variant of `.btn`** | `a.primary-orderaction .btn` bg `#f26722`, `#fff`, 19px/700, `border:2px solid #f26722` | `:1041` |
| **Outline/tertiary** `.ff-plp-view-opt` | `2px solid #999`, radius 5px, `#999` on `#fff`, 13px bold; hover inverts to `#fff on #999` | `:5075` |
| **Qty stepper** `.ff-plp-qty-btn` | 28×28, radius 6px, `1px solid #D3D1C7`, `#FFF`/`#1A1A1A`, 18px | `:5068` |
| **Icon buttons (header)** | 32×32, bg `#EBEBEB`, radius 5px, `border-bottom:2px solid #aaa` | `images/header4_5.css` |

*No global button token exists — radii vary 0 / 3px / 5px / 8px / 10px across generations. Standardize on 8px.*

**Cards**
- **Homepage category card** `.cat-card` — `flex 1 1 calc(33.333% - 20px)`, max 250×175, `2px solid #054F97`, radius 5px, centered icon + label `#054F97` 20px/600 (`:285-287`); 2-up under 767px
- **PLP product card** `.ff-plp-card` — column flex, `border-radius:14px`, `1px solid #E5E5E3`, bg `#FFF`, padding 17px, full-height (`:5050`). Media box 179px, radius 10px. Title 3-line clamped (`min-height:54.6px`). Grid: 2 → 3 → 4 cols, gap `60px 24px`, max-width 1050px (`:5046-5048`)
- Legacy tile (`prodlist4.asp:2684`): `.imageLink > img.itemImage` + `.itemDescription` + `.itemPrice` (Verdana 18px centered) + image-button `add-to-cart-btn-lg.png` + `More Info` link

**Price conventions (PDP `prodViewHv2.asp:1895-1901`)**
```html
<div id="listPriceVisible">
  <span>Retail: <del id="retailPrice">$XX.XX /ea</del></span><br />
  <span id="savingsPct">You Save: NN%</span>
</div>
```
- Label is `Retail:` normally, `Original:` when `sourceView=1`
- Savings is a **rounded whole percent**: `(listPrice−displayPrice)/listPrice × 100`
- Bulk tiers `#tiGenSavings`: `Buy 1 for $X ea.` / `Buy 3 - 5 for $X ea.` / `Buy 6+ for $X ea.` — active tier `.tiActiveOrange` = `2px solid #ED6E09` + bold `#333` (`:3702`)
- "As low as" `#asLowAs span.alaPrice` — `#ef7620` 24px bold (`:3597`)
- PLP: `.ff-plp-price-current` `#1A1A1A` 18px/600 beside `.ff-plp-price-retail` `rgba(0,0,0,.5)` 12px `line-through`

**Badges / value props** (`prodViewHv2.asp:2664-2679`, `.ti-value-props`) — icon + text rows:
- `In stock!` / `Ready to Ship!` — `Checkmark-2x.png`, green `#37B033`
- `Free Shipping over $99` — `truck-solid.png`
- `FREE 365 Day Returns` — `free-returns.png`
- `Made In USA` — `made-in-usa-icon.png` (conditional on `madeInUsa=1`)
- Stock strings also: `Ships by Tomorrow <date>` · `Ships by Monday <date>` · `Ships in N to N+1 business days.` · `Special Order. Ships in N to N+1 business days.` · `Out of stock`
- Side-by-side savings flag: `.ti-col-title[data-ti-save]:before` — pill bg `#f76f28` white 16px radius 5px with a CSS triangle pointer (`:4025-4026`)
- Free-shipping graphic in search autocomplete: `/images/free-shipping-search-graphic.jpg`, shown when `product_price >= 99` (`_INCheader.asp:274-283`)
- Satisfaction badge: `#guaranteeBadge` / `#guaranteeBadge2` (95px)

**Rating stars** — `<hawksearch-rating rating="{{rating}}">` web component (`_INCheader.asp:1057`); legacy `.ratingImg` inline-block. Third-party: **Trustpilot** widget (business unit id in source, template `53aa8912dec7e10d38f59f36`, 140px) + **Google Customer Reviews** badge.

**Forms / inputs** — `#sli_search_1` 33px, `1px solid #aaa` + `border-bottom:2px solid #aaa`, radius 4px; legacy peach fill `background:#feefe7` + `1px solid #f06830` in `header4_5.css`. Error state: red border `#e03838` + absolutely-positioned `.error-text` 15px below.

**Breadcrumbs** (`:2223-2227`) — `#breadCrumbs`, `padding:35px 35px 0`, Verdana 13px; links `#333` no-underline, current 12px normal weight; `nav > ol > li{display:contents}`. Pool/spa PLP wraps it in a `#F7F7F7` band (`:5099`).

**Alerts / banners**
- Promo bar at top = `#tiBlueShip` (see Header)
- **Cookie banner** (`_INCscripts.asp`, inline `<style>`) — fixed bottom-center, `3px solid #01284d`, white bg, text `#01284d` 18px/700; buttons `Necessary Only` / `Accept` (128px, 3px border) + X; keyboard focus ring `3px solid #f26722` offset 2px. Wires GTM consent + `uetq` + `fbq`
- `p.error` white-on-`#f00` · `p.success` white-on-`#146b14` (`:1084-1086`)

**Modals** — `#black_overlay` (fixed, `background:black; opacity:.5; z-index:10000`, `:87`). `.overlay-modal` — 45% width, `top:5vh`, `height:60vh` (max 500px), scroll-y, `#FFF` on `2px solid #CCC` (`:298`). Titles 16px bold `#000`; sub-headings `.ti-orange`. Instances: Free Shipping Policy, Returns & Refunds Policy (365-day), Support/hours panel, checkout trust modal, `intModal()` welcome, exit-intent.

**Chat widget** (`_INCscripts.asp`) — fixed bottom-right, iframe `25vw × 80vh`, `2px solid #f26722`, radius 5px; close chip bg `#f26722`. Icon `/images/support-icon.png` + label `Need Help?`.

---

## 6. Brand Voice & Copy

**Taglines**
- `Filter. Purify. Protect.` (logo lockup)
- `#1 Online filtration retailer in the US!` (H1 on homepage)
- `America's Top Online Filtration Retailer`
- `Trusted Replacement Filters from…`
- `Huge Selection. Unbeatable Quality. 365-Day Returns.`
- `Over 71,000 5-star reviews`
- `Breathe Better. Drink Cleaner.` / `Fresh Filters. Cleaner Air.`
- `Savings without sacrificing quality.` · `Fresh, New Filtration Finds at Feel-Good Prices`
- `CLEANER WATER. BETTER SHOWERS.` (SP12 showerhead launch)
- `RETURNING CUSTOMER? Sign in, Confirm order. Done.` / `RE-ORDER NOW`

**Value props**
- **Free Shipping on orders over $99** (VIP tier $75) — hard-coded `>= 99` in search autocomplete + PDP copy
- **FREE 365-DAY RETURNS** / *365-Day Satisfaction Guarantee* — the single most-repeated promise
- **Made In USA** (Filters Fast® air/furnace filters)
- **Home Filter Club** — *"Get FREE shipping on every order!"* + *"save up to 10% off when you subscribe. Choose your delivery frequency, and we'll do the rest."*
- Subscribe promo: `Take ~~10%~~ OFF your first order` → **20% OFF** + *"10% for every order after + FREE shipping on every order."*
- **Save with Filters Fast® Filters** — Same Great Quality / Lower Prices / Efficient Filters
- About-us badge row: `365-Day Return Guarantee` · `FREE Shipping on Orders $99+` · `Based In Charlotte, NC` · `Family-Owned and Operated`
- `10,000+ filtration products` · `Top Workplace for eight consecutive years (2018-2025)` · WQA & NAFA members

**Mission** (`our-mission.asp:60`, `aboutUs.asp:156`):
> "To provide our customers with the best filtration shopping experience — a comprehensive catalog that is easy to navigate, the tools and education to make the right choice, and the best customer experience and support to help along the way."

**Values** (`aboutUs.asp:160-190`): **Purpose · Loyalty · Inclusion · Health**

**Founder story** (`aboutUs.asp:124-140`): Ray Scardigno, 2003 problem → launched **Filters Fast in 2004** in Charlotte, NC. Pull-quote is used verbatim as a testimonial block.

**Charity / mission messaging** — *Our Commitment to Community*: **Wine To Water**, **Cystic Fibrosis Foundation** (Xtreme Hike), **Habitat for Humanity of the Charlotte Region**. Assets `wtw-lettermark-white.png`, `CFF-logo-white.png`, `habitat-for-humanity-charlotte-region-logo.svg`. There is also a `3x-wtw-match-hero-v1.jpg` donation-match hero.

**Tone** — warm, plain-spoken, second-person, exclamation-friendly, reassuring on returns. FAQ answers open with *"Yes!"*, *"Of course!"*, *"Firstly, we're sorry to learn…"*. Uses `Filters Fast®` with registered mark whenever referring to the house brand.

---

## 7. Imagery Conventions

- **Product images:** `/prodimages/<smallImageUrl-from-DB>` (`prodlist4.asp:2684`) — DB-driven filename, **no SKU-derived pattern**, no CDN
- **Marketing/UI images:** `/images/…` — served from origin. Legacy `http://cdnroot.filtersfast.com/images/…` references survive in a few files but are not the active path
- **Naming conventions observed:**
  - Retina sprites/logos: `FF-<Brand>-Logo-2x.png` + `.webp` twin (Hayward, Pentair, Colmena, Unicel, Intext)
  - Campaign heroes: `FF-<Campaign>-Home-Banner.jpg` (BlackFriday, CyberMonday, CyberWeek)
  - Device-prefixed: `D-` = desktop, `m-` = mobile (`D-HeroFF.jpg`, `m-one-stop-shop.png` vs `one-stop-shop.png`)
  - Dated design-system exports: `FiltersFast_2025_FF-A-Category-ApplianceParts-Oct2025_<Name>.svg`, `FiltersFast_2026_FF-A-PoolAndSpa-Redesign-April2026_<name>.svg`
  - Sprites: `FF-HeaderRedesignTest-sprite.png`, `FF-Product-Page-Redesign-Sprite.png`, `FF-SinglePageCheckout-Sprite.png`
- **Homepage hero carousel:** **1250 × 234** — confirmed both by asset (`discount-filters-desktop.jpg` = 1250×234) and CSS `.single-item.section_container{max-height:234px}` (`:1712`). Backgrounds set inline as `background-image` with `background-size:cover` (`:717`)
- Wide-viewport swaps at `min-width:1300px` to `-larger.jpg` variants (`our-brand.asp`)
- Category thumbs `max-width:128px`; mega-nav brand logos width 96-127px, flyout promo 276×178 (`aspect-ratio:276/178`)
- Homepage editorial images 470px wide with `<picture>` + `<source media="(max-width:767px)">` mobile swap; `loading="lazy"` throughout
- Formats: JPG/PNG dominant, WebP only as `.webp` twins of brand logos, SVG for icon sets

---

## 8. Breakpoints & Responsive Approach

**Two fully separate stylesheets + separate URL space** (`UserMods/_INCtemplate_xhtml_main.asp:50-60`):
```html
<link rel="stylesheet" href="/css/fontsFF.css">
<!-- then EITHER -->
<link rel="stylesheet" href="/css/mobileFF.css">   <!-- useMobile -->
<link rel="stylesheet" href="/css/desktopFF.css">  <!-- else -->
```
`<body class="desktop|mobile <pagename-slug>">`. Server-side UA detection via `MobileCheck.asp`; mobile pages live under `/mobile/` with `<link rel="alternate">` cross-pointers. `desktopFF.css` = 484 KB, `mobileFF.css` = 348 KB — heavily duplicated.

**Breakpoints actually used (desktopFF.css)** — no formal scale; most frequent first:
`min-width:1025px` (14×) · `min-width:767px` (11×) · `768–1025px` (10×) · `max-width:1024px` (10×) · `min-width:768px` (5×) · `max-width:767px` (8×) · `min-width:1300px` (3×) · `min-width:1500px` (2×) · plus one-offs at 1255, 1250, 1231, 1225, 1203, 1175, 1144, 1026, 1000, 980, 950, 930, 838, 802, 800, 768, 737, 600, 520, 475, 420 px

**Effective canonical set: 767 / 1024-1025 / 1300.** Container `max-width:1250px; min-width:760px` (`#HeaderContainer`, `#MainContentContainer`).

**Also present:** `@media (prefers-reduced-motion: reduce)` (5×), `body:has(...)` selectors in the nav overlay (modern CSS in an otherwise legacy sheet).

**Libraries**
| Lib | Version / notes |
|---|---|
| jQuery | **3.5.1** (`/js/jquery-3.5.1.min.js`, preloaded) — legacy **1.9.0** also present |
| jQuery UI | `/js/jquery-ui.js` |
| **Bootstrap** | **Not loaded.** Bootstrap-*style* `col-md-*` / `col-sm-*` classes are used in the mega-nav but are hand-defined flex rules in `desktopFF.css:521-535`. (The only "bootstrap" URL is Trustpilot's own `tp.widget.bootstrap.min.js`.) |
| **FontAwesome** | **Not used.** Icons are inline SVG, PNG sprites, or `/images/*.svg` |
| Carousels | **Slick** (`/js/slick.min.js`) — homepage; **Splide** (`/js/splide/`) — About Us sliders |
| Search | **HawkSearch** web components + Handlebars templates (migrating off SLI/`resultspage.com`) |
| Other | Prototype.js (legacy), `megamenu.js`, `colorbox`, `inert.js`, `screenReader.js`, Semantic UI + Fontello (isolated in `/HomeFilterClub/`) |
| Third-party | GTM · FB Pixel · Pinterest · Zaius/Optimizely · Klaviyo (prod + test keys) · OrderGroove · Attentive · PushEngage · TaxJar · Signifyd · reCAPTCHA v3 · Bouncer (IDs live in `_INCscripts.asp` / `_INCheader.asp`) |

---

## 9. Social Handles & Contact

| Channel | Value |
|---|---|
| **Phone (sales/support)** | **866-438-3458** — `tel:8664383458`, displayed `(866) 438-3458` |
| **SMS / text** | **704-228-9166** — `sms:7042289166`, displayed `(704) 228-9166` |
| **Email** | `support@filtersfast.com` |
| **Hours** | Mon–Thu `9am-12:30pm ET` + `1:30pm-5:30pm ET`; Fri `9am-1:30pm ET`. *(Header support modal shows a `1:30pm-6pm ET` variant in the non-high-volume branch — `_INCheader.asp:890`.)* |
| **Location** | Charlotte, North Carolina (`Based In Charlotte, NC` badge). No street address rendered anywhere in the UI. |
| Instagram | `https://www.instagram.com/filtersfastllc/` |
| X / Twitter | `https://x.com/FiltersFast` (older `_INCfooter_2.asp` still uses `twitter.com/FiltersFast`) |
| Facebook | `https://www.facebook.com/pages/Filters-Fast/75640266659` |
| YouTube | `https://www.youtube.com/user/FiltersFast` |
| Blog | `https://blog.filtersfast.com/blog/` |
| Forums | `https://forums.filtersfast.com/forums/` |
| Social icons | `/images/social-{facebook,instagram,twitter,youtube}.svg` (+ legacy sprite `FF-FooterTestV2-SocialIcons.png`) |

Holiday-closure notices are hard-coded date checks in the support modal (`_INCheader.asp:915-932`) — MLK, Memorial, July 4, Labor Day, Thanksgiving, Christmas/New Year. (v2: drive from a KV/DB config table.)

---

## Recommended token set for the rebuild

```
--brand-orange:    #F26722   /* primary CTA, add-to-cart, accents */
--brand-orange-dk: #D85A1B   /* hover/active */
--brand-blue:      #054F97   /* nav bar, headings, focus, card borders */
--brand-blue-dk:   #005189   /* flyout rail text */
--brand-blue-tint: #E6EDF5   /* flyout rail bg */
--brand-navy:      #201E5A   /* newsletter band */
--promo-cyan:      #19BAED   /* free-shipping bar */
--ink:             #3F3F3F   /* body text */
--ink-strong:      #1A1A1A   /* prices */
--surface:         #FFFFFF
--surface-alt:     #F7F7F7
--footer-bg:       #2A2A2A
--footer-muted:    #C4C4C4
--border:          #E5E5E3
--success:         #37B033
--danger:          #E03838
--radius:          8px  (cards 14px, media 10px)
--font-ui:         "museo-sans-rounded", Verdana, sans-serif
--font-display:    "Oswald", sans-serif
--font-cta:        "Rubik", sans-serif
--font-footer:     "Source Sans Pro", sans-serif
--bp:              767px / 1024px / 1300px ; container max 1250px
```

**Notable drift to resolve:** `manifest.json` says `#F26822`, CSS says `#F26722`, `header4_5.css` says `#f26822` — pick `#F26722` (matches the brand guide). Button radii span 0/3/5/8/10/14px. Three generations of header CSS coexist (`header.css` → `header4_5.css` → inline in `desktopFF.css`); only the last is live.
