# Legacy Inventory 01 — Customer-Facing Features & Page Types

Generated September 10, 2026 from the `FiltersFast` ASP Classic repo. This is the parity checklist source for the rebuild.
Secret values seen in source are not reproduced; their locations are in `02-integrations-and-data.md` §B5.

**Stack:** Classic ASP (VBScript) on IIS, forked from **CandyPress Store 2.4** (2003), SQL Server backend, Helicon ISAPI_Rewrite for URLs. ~4,075 files, 168 root-level `.asp` pages.

---

## 0. Platform & architecture context

- **Engine:** CandyPress Store 2.4. Core plumbing: `_INCconfig_.asp` (store config loaded from `storeAdmin` table into `configArr`), `_INCappDBConn_.asp`, `_INCappFunctions_.asp` (`openDB`, `sessionCart`, `sessionCust`, `validSQL`, `validHTML`, `moneyS`).
- **Page contract:** every customer page defines `spagename`, opens DB, gets `idOrder = sessionCart()` and `idCust = sessionCust()`, then `#include`s a template from `UserMods/` which calls `cartMain()` (the page body sub).
- **Templates (`UserMods/`):** `_INCtemplate_xhtml_main.asp` (generic), `_INCtemplate_xhtml_category.asp` (PLP), `_INCtemplate_xhtml_product.asp` (PDP), `_INCtemplate_xhtml_custom.asp` (custom air filter builder), `_INCtemplate_xhtml_model.asp` (model lookup), `_INCtemplate2_checkout.asp` (checkout), `_INCtemplate_xhtmlmobile*.asp` (m-dot), `_INCtemplate_adaptive.asp`, `_INCtemplate_2.asp`, `_INCtemplate_xhtml_affiliate.asp`. Shared head partials: `_INCfavicon_.asp`, `_INCmeta_.asp`, `_INCtitle_.asp`/`_INCtitlecheck_.asp`, `_INCtools_.asp`.
- **Chrome:** `_INCheader.asp` (98 KB — active, contains both desktop and mobile headers plus device redirect logic), `_INCfooter.asp` (active), `_INCscripts.asp` (analytics/tag block). `_INCheader_4_2.asp` and `_INCfooter_2.asp` are legacy (2022) — dead.
- **Non-customer-facing (exclude from storefront scope):** `Manager/`, `automation/`, `taxjar/`, `googleApi/`, `Maxmind/`, `FedEx/`, `CyberCharge/`, `PayPal/`, `bin/`, `obj/`, `Config/`, `srchupload/`, `fbItems/`, `bpn/`, `OrderInsertionAPI*.asp`, `shpfyOrdersCreation*.asp`, `sendGridApi*.asp`, `abandonedPendingOrders.asp`, `taxjarbackreporting.asp`.

---

## 1. Homepage

**Files:** `default.asp`, `_INChomepagecontent_.asp`, `js/homepage.js`

Sections in DOM order:

1. **Promo modal** — rendered when `?contextTag=` present, via `ShowDiscount("inline")` (`_INCDiscountsAndTotals.asp`). Email shortcuts map `?eml=` codes to contextTags: `TG10`, `SG5`, `MLK10`, `AIR`, `FRIDGE`, `FF10`.
2. **Ordergroove bootstrap** — `static.ordergroove.com/<MERCHANT_ID>/main.js`.
3. **JSON-LD `WebSite` + `SearchAction`** → `/search/?query={query}`.
4. **Hero carousel** — date-gated banner slides, hardcoded in ASP: SP12 Filtered Showerhead (window from 8/17/2026 + 30 days); "SUBSCRIBE … 20% OFF first order / 10% after + FREE shipping" (until 12/31/2026) → `/filtersfast-cat.asp`; evergreen "Over 71,000 5-star reviews / America's Top Online Filtration Retailer / 365-Day Returns" → `/reviews.asp`; New Products → `/new-products-cat.asp`; Discount Filters → `/filtersfast-cat.asp`.
5. **Returning-customer reorder bar** → `/logon.asp?action=logon&reorderbtn=1`.
6. **Two filter finder tools**:
   - *Water*: part-# search form → `/search.asp?query=`; "Search by Filter Brand" select (Amana, Bosch, Electrolux, Fisher & Paykel, Frigidaire, GE, Hotpoint, IKEA, Jenn-Air, Kenmore, KitchenAid, LG, Maytag, Samsung, Sub-Zero, Whirlpool, More…); 6 brand tiles.
   - *Air*: size form → `getsizes.asp` with `size_1` (short side), `size_2` (long side), depth (1″, 2″, 4″, 5″); air brand select (Aprilaire, Bryant, Carrier, Filters Fast Air, Filtrete, Five Seasons, Generalaire, Goodman, Honeywell, Lennox, Totaline, Trion, Trane, White Rodgers, York, More…); 6 brand tiles.
7. **Home Filter Club block** — "FREE shipping on every order… save up to 10% when you subscribe" → `/auto-delivery.asp`.
8. **"Save with Filters Fast® Filters"** merchandising module → `/filtersfast-cat.asp`.
9. **Featured Categories** — 6 cards: Refrigerator Water Filters, Air Filters, Water Filters, Pool & Spa Filters, Humidifier Filters, Shop Sale (`/overstock-items-cat.asp`).
10. **`_INChomepagecontent_.asp`** — two SEO copy rows, a CTA block, and a 6-question **FAQ accordion** with matching **`FAQPage` JSON-LD** (compatibility, 365-day returns, how to find a filter, damaged items, help, Home Filter Club).
11. **Trustpilot service-review widget**.
12. **Google Ads remarketing pixel**.

Also on homepage load: `session("ogIntegration")="HomePage"`, `session("continentalUSCustomer")=IsContinentalUSIP()`, `getIdAffiliate(?idAff)`, `talkable_promo` → cookie `tkblP` (7 days), and a PayPal-return interception.

---

## 2. Product listing pages (PLP / category)

**Primary:** `prodlist4.asp` (209 KB — desktop, actively maintained). **Mobile twin:** `prodlistmobile.asp` (181 KB).
**Others:** `all-items.asp` (legacy list w/ real sorting), `listbysize2.asp` (air filters by size), `TextOptinSocial.asp` (PLP clone used for an opt-in landing), `models/model.asp` (model results list), `pool/index.html` (standalone static pool/spa size tool — abandoned).

### Routing / URL shape
All in `.htaccess` (Helicon ISAPI_Rewrite 3.1):
- `/<name>-cat.asp` → `prodlist4.asp?pagename=<name>-cat.asp`
- `/mobile/<name>-cat.asp` → `mobile/prodlistmobile.asp?pagename=…`
- `/Pool-Spa-Filters-cat*` gets its own rule
- Category lookup is by **`categories.pagname`**, not ID.

### Data model surfaced
`categories` (idCategory, categoryDesc, pagname, idParentCategory, categoryHTMLLong, categoryH1, categoryGraphic, categoryimage, categoryContentLocation, compareActive) × `categories_products` × `products`.

### Product card fields (`sub displayItems`, `UserMods/_INCffplpCard.asp`)
`idProduct, SKU, Description, DescriptionLong, privateLabel, compareTo, ListPrice, Price, SmallImageUrl, Stock, IgnoreStock, LeadTime, packMultFlag, packSizeUOM, fileName, noShipCharge, pagename, homepage, poprank, compareDefaultOption, compareOptionPriceToAdd, optionDescrip, showPriceInCart (hidePrice), idOptionGroup`, plus derived `isAvailable`.

Card sub-renderers: `getprodDesc`, `getprodDescLong`, `getprodSKU`, `getPricing(priceDispType)`, `getProdImage`, `getFreeShip`, `getStockLevel`, `getRatings`, `getViewButt`, `getAddButt`, `getProdDisc2`, `getHLine`.

### Sorting / pagination / faceting
- **Sorting is effectively disabled on `prodlist4.asp`**: `sortField = "poprank"` hardcoded. Order is `ORDER BY a.homepage asc, isAvailable desc, a.poprank, a.stock desc`.
- `all-items.asp` still honours `?sortField=` (description / price / sku).
- **Pagination**: ADO recordset paging — `PageSize = pMaxItemsPerPage` (store config), `?curPage=`.
- **No faceting on ASP PLPs.** Faceted browse exists only inside HawkSearch (`/search/`).
- Legacy search-in-PLP is dead — redirects to `/search.asp?query=`. ⚠️ That code path contains a hardcoded SQL connection string with credentials (`prodlist4.asp` ~line 233).

### Special PLP layouts (all inside `prodlist4.asp`)
| Sub | Trigger | Purpose |
|---|---|---|
| `refrigeratorLanding()` | 22 fridge-brand category IDs (523/524/527/529/530/531/533/534/540/541/544/546/641/651/632/636/643/926/992/993/1001/1007) | 3-step fridge finder: `?st=` style → `?loc=` location → `?rem=` removal; reads `refrigerator_finder` table; auto-forwards when only 1 option |
| `refrigeratorSearch()` | — | model-number search box |
| `fiveInchAirLanding()` | `?size=` | 5″ air filter landing + FAQs |
| `waterFilterLanding(flag)` | `?wtype=` | water filter type landing |
| `humidifierLanding(flag)` | `?wtype=` | humidifier landing |
| `poolandspacategory()` (via `UserMods/_INCffPoolSpaLanding.asp`) | idCategory 1035, 297, 284, 937, 296, 938 | pool/spa dimension finder |
| `UserMods/_INCffApplianceLanding.asp` | appliance parts | appliance landing |
| `GetTopLevelCategoryContent()` | idCategory 121, 64, 995, 25, 110 | top-level hub content |
| `compareCatItems()` | `compareActive` | in-category comparison |
| `getManagedCategoryFAQs()` / `UseCustomCategoryFAQExperience()` | DB-driven | category FAQ + `FAQPage` JSON-LD |
| idCategory 1160 | — | "Filters Fast® Products" hero |

### Other PLP behaviours
- Breadcrumbs with `BreadcrumbList` microdata via `getCategoryPos(IDCategory)`.
- `TrackUserNavigation("C",5,idCategory)` cookie trail.
- Hardcoded 301: idCategory 264 → `/Pur-Water-Faucet-mount-filters-cat.asp`.
- Promo overlays via `?contextTag=`, `?fb=FG5|FG10`, `?rdo=filter10off`.

### `listbysize2.asp` (air filter by size)
`?size=WxHxD`. Renders "Find your Air Filter Size" or "<size> Air Filters" (h1), plus `prodDetailNew()`, `ParseCustomLink(actualSize, mervType, getPrice)` and `GetCustomPricing(h,w,d,m)` to cross-sell the custom filter builder when no stock SKU matches.

### Size finder endpoints
`getsizes.asp` (air), `getpoolsizes.asp` (pool/spa — JSON options API with sanitization, throttling, measurement sorting/fraction parsing).

---

## 3. Product detail pages (PDP)

**Primary:** `prodViewHv2.asp` (211 KB, ~4,600 lines — active). **Legacy:** `prodview.asp`. **Mobile:** `mobile/prodviewmobilev2.asp`.
**Custom builder:** `prodviewcustom.asp` → public URL `/p-filters-fast-custom-air-filters.asp`; helper `_INCcustomFilters_.asp`.

### Routing
`.htaccess` rewrites `/p-*`, `/pg1-*`, `/*-filter*` and a broad catch-all `^/(.+?)$ → /prodviewhv2.asp?pagename=$1`.

### Includes (feature surface)
`_INCrelatedcheck_`, `_INCproductshippingcheck_`, `_INC_Transit_Time_`, `_INCproductreviews_`, `_INCDiscountsAndTotals`, `_INCCustomerModels`, `_INCCustomerNavigation`, `JSON_funct`, `_INCsubscriptions_`, `_INCAutomatedDiscounts`, `_INCaes_`.

### Buy box
- Two variants: `getAddtoCartSingle(oeComp, oeoptionFlag)` and `getAddtoCart2(...)` (side-by-side / compare layout).
- **Variants/options:** `getOptionsGroups()` reads `optionsGroupsXref` → `OptionsGroups` (optionGroupDesc, optionReq, optionType, sizingLink) → `optionsXref` → `options` (optionDescrip, priceToAdd, percToAdd), minus `OptionsProdEx` exclusions, joined to `productOptionInventory` (per-option stock) and `custom_size_xref` (actual dimensions). Rendered as select or radios; JS live-updates price; options containing `custom-` deep-link to the custom builder.
- **Source-specific pricing:** `tsourceprice` table keyed on `session("source")` (affiliate/channel pricing), with `sourceView`/`nOverride` alternate layout.
- **Quantity discounts:** `DiscProd` table — `discAmt, discPerc, discFromQty, discToQty, source`; `maxdisc` drives the "as low as" display price.
- **Pack/multi-pack:** `packMultFlag` (=3 means UOM multi-pack) + `packSizeUOM` → `packMult`; renders "N-Pack" suffix in H1 and a per-each price ("Only $X per <unitName>").
- **Compare / side-by-side:** `compareTo`, `compareToAlt`, `compareToSortOrder`, `compareDefaultOption`; backed by `productSpecs`. Auto-swaps to `compareToAlt` if the compare item is OOS.
- **Stock:** `getProdStock()` — `Stock`, `IgnoreStock`, `LeadTime`, sentinel `stock = -250` = discontinued, `-150` = special; `pHideAddStockLevel` config.
- **Subscription offer:** `AutoshipEnabled` flag per product (inherited from `idPaired` parent); `_INCsubscriptions_.asp → showHFC(style)` renders the Home Filter Club widget with a **frequency select 1–12 months (default 6)** plus a one-time option; `?addSubscription=true` → `hfcAddSubscription()`; `orderGrooveDiv()` emits the OG container.
  - **Discount ladder (`getSubDisc()`):** private-label (`Filters Fast`/`FiltersFast`/`PureH2O`) non-air = **20%** on first order while promo active (through 12/31/2026), else **10%**; all other private-label = 10%; **non-FiltersFast products = 5%**.

### Content sections
`getCategories(catOrder)`, `getProdDetail()`, `getSpecifications()` (`productSpecs`), `getProductHighlights()`, `getFilterModels()` + `getSystemModels()` (compatible model lists with client-side filter and ARIA live region), `getModels()`, `getProductFAQs()`, `getProdRelated()`, `getalsobuy()` ("customers also bought"), `getProdImage()` (gallery, `ProdImages/`), `RecommendedBanner()`, `freeShipBanner()`, `WritePdpValueProps()`, `ShouldShowReadyToShipProp()`, `WritePdpSalesRestrictionsLine()` / `GetSalesRestrictions()` (state-level restrictions), `prop65Warning()` (`products.prop65`), `getMisc()`, sizing modal from `actualSizes` (nominal vs actual, with per-SKU notes for MERV 8/11/13 idProduct 1108/1109/1381).

### Reviews & Q&A on PDP
`_INCproductreviews_.asp` — **Trustpilot** only: `GetProdReviewSummary`, `GetProdReviews` / `GetTrustPilotReviews` (paged product + imported reviews), `GetPdpStarRatingMarkup`, `WritePdpReviewSummaryLink`. **Q&A:** `outputProdQA(qaID)` → Trustpilot Product Questions widget, heading "Ask Our Product Experts". API key is hardcoded in source ⚠️.

### Structured data
- `OutputMicrodata()` — `Product` JSON-LD: `@id`, `brand`, `name` (+ N-Pack), `image`, `description`, `mpn`, `sku` (with `_<packQty>` suffix for alt-vendor pack views), `url`, `offers.Offer` (`priceValidUntil` = today ⚠️, `priceCurrency USD`, price computed from `sourceView`/`maxdisc`/`packQty`/`packSizeUOM`, `availability`), `aggregateRating` from Trustpilot plus embedded reviews.
- `getCompatLDSummary()` — `isRelatedTo` list of compatible `Product` nodes and per-brand "<X> models" nodes (the 2026 compatible-parts work).
- `OutputFAQLD()` — `FAQPage` from product FAQs.

### Custom air filter builder (`prodviewcustom.asp`)
- Fixed `idProduct = 3309`, `sku = FFCUSTAIR`, default `customSKU = CPR8.0100.0X00.0PFF`.
- Presets from querystring `?h=&w=&d=&e=` (e = MERV code: `08`, `11`, `13`); H1 becomes "H x W x D Air Filters".
- Form posts to `cart.asp` with `action=additem`, `customOrder=1`, `customDescript`, `customSKU`, option fields, `optionprice`.
- Step 1 dimensions (short side / long side / depth), Step 2 MERV.
- Business rule: **no returns on custom air filters**.
- SKU grammar (`_INCSearchRedirects.asp → CheckCustomSKU`): current `CP8.|CP11.|CP13.|CPR8.|CPR11.|CPR13.` + `ddHHxWW` + suffix `PFF|3PK|6PK`; legacy `MQP-|GQP-|EQP-` + `HxW` + `-1|-2|-4`. Fractional inches encode as `.0 .1 .2 .3 .5 .6 .7 .8`.

---

## 4. Model lookup / refrigerator finder

| Page | Role |
|---|---|
| `models/model.asp` | **Model landing page.** URL `/models/<modelnumber>` → `models/model.asp?modelnum=$1`. Shows "MODEL Results" H1, product list, brand-accessory blocks, `getModelLD()`/`OutputModelLD()` JSON-LD. Mobile twin `mobile/models/model.asp`. |
| `ModelLookup/modellookup.asp` | Alternate lookup; URL `/modellookup/<modelnumber>`. |
| `modellookuphome.asp` | A–Z model index (`?page=<letter>`), linked from footer as "Model Lookup". |
| `refrigeratorFinderTool.asp` | Emits only `refrigeratorLanding(2)` with `Access-Control-Allow-Origin: *` — an **embeddable widget** for external sites. |
| `prodlist4.asp → refrigeratorLanding()` | In-site 3-step fridge finder, table `refrigerator_finder(idBrand, idStyle, idLoc, idRemove, idProduct, active)`. |
| `custModels.asp` | **"Appliance Profile"** — saved appliance models; modal "Model Lookup"; backed by `_INCCustomerModels.asp`. |

Model data tables: **`tFridgeModelLookup`** (idModel, FridgeModelNumber) and **`tFridgeModelSearch`**. PDP accepts `?mod=<idModel>` → renders "Replacement for Model X" and calls `AddModelToCookie(idModel)`.

---

## 5. Search

**Provider today: HawkSearch (Bridgeline)** — Handlebars UI v7.0.1.

- **Client config** (`_INCheader.asp` ~line 175): `search.url = /search/`, endpoints `filtersfast.searchapi-na.hawksearch.com`, tracking, recs. Test env swaps to `*-test.hawksearch.net`.
- **Field mappings:** `product_description, product_image, product_list_price, as_low_as_price, product_name, product_url, product_sku, record_type`.
- **Autocomplete** (in header): products (image, title, rating, price, free-shipping flag, variant selector), product suggested queries, content suggested queries, categories, content, popular queries, "view all".
- **Results page:** `search/default.asp` + Handlebars UI. Faceting (`facets-list`, `selected-facets`, hierarchical checkbox facets — currently commented out), `FeaturedTop` content zone, `hawksearch-modified-query`. Custom helpers: `setStockIndicator`, `calcSavings`, `setCurrPriceLbl`, `ffPlpAttr`, `ffPlpHasBulk`, `setFFPlpStock`, etc.

**Pre-search redirect engine — `_INCSearchRedirects.asp` (2,059 lines).** Included by both `search.asp` and `search/default.asp`. Order of operations:
1. **Direct SKU match** → `products.sku` (also with hyphens stripped) or `tAltSourceProd` → 302 to product `pagename` (`?avi=<idAlt>`). Outcome `Sku Match`.
2. **Fridge model match** → `tFridgeModelSearch` with OCR-style normalization (`O→0, Q→0, B→8, S→5, I→1, L→1`, strip punctuation). Requires token length > 4, alphanumeric, and not a manufacturer name (`IsNotManufacturer` — a ~1,400-line hardcoded brand list ⚠️). → **301** to `/models/<model>`.
3. **`redirectHub` table** (`typeID=1`, keyword) → 301.
4. **Air filter size parsing** (`getAirFilterSize`) — normalizes `X`, `by`, `*`, `/`, quotes, fraction→decimal; sorts into H/W/D; snaps depth to 1/2/4/5/6. Validation: depth ≥ 7 error; depth > H or > W error; H > 30, W > 50.625, H < 6, W < 6 error. On success → `/listbysize2.asp?size=` if in `search_products`/`custom_size_xref`, else custom builder deep link.
5. **Custom SKU parse** → custom builder deep link.
6. Otherwise fall through to HawkSearch.

**Every search is logged** to `tffsearchparam(searchdate, search, searchModified, redirectUrl, auditInfo, idOrder, idCust, mobile, outcome)`.

**Dead search assets:** `ssearch.asp` (SearchSpring, 2021), `sli-parse-page.asp` (SLI), `srchupload/` feeds (stale 2025), `sfb.asp`. History: SLI Systems → SearchSpring → HawkSearch. Only HawkSearch is live.

---

## 6. Cart

**File:** `cart.asp` (149 KB) + `MobileCheckCart.asp`.
**Includes:** `_INCshipcheck_`, `_INCfeatcartcheck_`, `_INCrc4_`, `_INCrc4_OG_`, `JSON_funct`, `_INCDiscountsAndTotals`, `_INCCartExpressCheckout`, `_INCaes_`, `_INCsubscriptions_`, `_INCAutomatedDiscounts`.

### Actions
`addItem()`, `delItem()`, `reCalc()`, `add_gift_item(autoAddId)`, `removeInvalidGWP()`, `get_custom_filter_data()`, `getOptionsGroups(oidProduct)`, `EmptyCartContent()`, `getShipTime(...)`, `clearCustomerDetails()`, `quantityValid(quantity, stock, idProduct)`, `GetAutoShipPrice(...)`.

### UI blocks
- H1 "<n> Items in your Cart".
- Line items with Ordergroove hooks (`data-og-module="sc"`, `data-og-product`), option description, per-item ship time, qty input auto-submits.
- Totals rail: subtotal, shipping (green when free), handling, total, discount.
- **Promo code** input (maxlength 20) + hidden `selectedDiscount`, `selectedGWPDiscount`.
- **AAA membership field** (exactly 16 chars) with AAA Discount Rewards logo.
- **ID.me block**.
- "Shop with Confidence" trust block; "Free Shipping on orders over $99" bullet.
- `HFCProdId` hidden field for subscription upsell.
- Checkout button posts to `05_Gateway.asp`.

### Express checkout (`_INCCartExpressCheckout.asp`, 79 KB)
Three buttons, toggleable via `ShowPayPal` / `ShowGooglePay` / `ShowApplePay` (all true):
- **PayPal** (+ **Venmo**; paylater/credit funding toggled) — vault support via `wallet.paypalVaultCID`; posts to `/PaymentProcessor/Default.aspx` with `paymentType=50_PayPalExpress`.
- **Google Pay** — `GetGooglePayFinal()`.
- **Apple Pay** — `OutputApplePayCart()`, merchant IDs `merchant.filtersfast.com.applepay` (prod) / `merchant.filtersfast2.applepay` (test); gated on `MobilePaymentsActive` and `paymentCountryOrigin = "US"`.

### Discounts engine (`_INCDiscountsAndTotals.asp`, 95 KB — the single most important business-rules file)
Applied codes are stored **AES-encrypted in cookie `contextdID`** as `timestamp|guid|tag1|tag2|…`, read by `GetPromotionDiscount()`.

`DiscOrder` columns driving behaviour: `discCode, discTag, discAmt, discPerc, displayPerc, discValidFrom, discValidTo, discStatus, discOnceOnly, discFromAmt, discToAmt, discThresh, discThreshFlag, discMatchValue, discFreeShipping, discMultiByQty, requirePresenceType/requirePresenceID, exclusiveDiscount, giftWithPurchaseFlag, giftWithPurchaseGroup, bogoFlag, tieredSaleFlag, tieredThresh1-4, tieredDiscAmt1-4, autoAddWithPresenceId, promoItemFlag, promoItemDisc, discTitle, discUseCustomContent, discImageLoc, isCompoundable, addOnDiscounts`.

Rule taxonomy:
- **Order-level:** flat `discAmt` or `discPerc`, gated by subtotal between `discFromAmt` and `discToAmt` (with a $0.11 tolerance).
- **Tiered sale:** `tieredThresh1..4` → `tieredDiscAmt1..4` on cart total.
- **`promoItemFlag`:** `1` = product-driven (`promoItemDisc` = idProduct), `2` = category-driven (matches `idCategory` or `idParentCategory`, optional category threshold).
- **`promoItemDisc` negative sentinels:** `-9` humidifier filter, `-8` home air filter, `-7` FF water filter, `-6` refrigerator filter, `-5` brand-driven, `-4` keyword/idProduct-driven (`discMatchValue` list), `0` global.
- **Legacy positive cases (hardcoded):** `1` = $5 off 3M/Filtrete; `2` = 15% off Pentek; `3` = 10% off PureH2O; `4` = 10% off FiltersFast air filters; `5` = 5% off idProduct 1851/14698; `6` = 5% off idProduct 14697.
- **BOGO** and **Gift With Purchase** (group picker modal, threshold `discFromAmt`).
- **Presence rules:** `requirePresenceType = "p"` (product) or `"c"` (category).
- **Affiliate promos:** contextTag prefixed `AFF-` → `affiliateRecords.affDiscount` %.
- **Employee discount:** NAV cost + 10% (recent commits removed the flat 50% and the $100 cap); employee tag exempt from promo cap and always grants free shipping.
- **Cap:** `promoDiscTotal` capped at `promoDiscMax` for non-employee.
- **Suppression:** `sourcePriceFlag = 1` or `googleAutoDiscount` on any line → all promo + free shipping zeroed.
- **Free shipping promo** sets cookie `fShipWI = True` (7 days).
- **Single use:** `FlagSingleUseDiscount()`, `CheckSingleUseDiscountByCustomer()`.
- **Compounding:** `IsDiscCompoundable(discTag)`, `GetDelimitedDiscounts()`.
- **Persistence:** `PreserveDiscountsInCart()` / `RestoreDiscountFromCart()` / `SaveDiscountToCart()`.
- **Membership verification:** `CheckAAAMembership(memberID)` → CAA partner-connect API (key hardcoded ⚠️), valid if status A. `CheckIDMEVerification()` → `api.id.me/oauth/token` (client secret hardcoded ⚠️), auto-creates an account. `RecordMembership(partner, memID, isValid, resp, discTag)`.
- **Tax:** `taxAndTotals()`, `getCPTax()`, `DoubleCheckTotals()`; TaxJar via `TaxCalculationAPI.asp`.
- **Ordergroove discount:** `getOGDiscountTotal()`.
- `ShowDiscount(style)` renders the promo modal/inline banner sitewide.

### Automated (Google) discounts — `_INCAutomatedDiscounts.asp`
Google Shopping automated-discounts JWT flow: validate signature, parse JWT, cookie via `setGoogleJWTCookie`, offer resolution, audit `googleDiscountLogger`.

### Donations — `_INCDonations.asp`
Shown on `20_Customer.asp` and `40_ReorderSubmit.asp`.
- **Default charity: Wine To Water.** Seasonally swapped to Cystic Fibrosis (Xtreme Hike) — hardcoded window (Sept–Oct 2025, expired ⚠️).
- `donateAmount`: `0.00`, **`RU` = round up to next whole dollar**, `1.00`, `2.00`, `5.00`, `10.00`, **`CU` = custom** (min 0.00 / max 100.00).
- Sessions `donate-roundup`, `donate-custom`; JS updates grand total live.

---

## 7. Checkout flow

Progress bar shows **4 steps**: 1 Billing Information · 2 Shipping Method · 3 Review & Verify · 4 Payment.

| File | Step |
|---|---|
| `05_Gateway.asp` | Gateway. `?action=logon|logonaff|checkout|save|retrieve`. `PersistCart(idOrder)` mints a `randomKey`; `retrieve` validates idOrder+randomKey (`orderStatus` U or S). |
| `10_Logon.asp` | Auth gate. Renders `_INCloginFrontend.asp`. |
| `20_Customer.asp` (107 KB) | Billing + shipping addresses, contact, donation, marketing opt-ins. |
| `30_Ship_CC.asp` | Shipping method selection (+ optional insurance). |
| `40_SubmitOrder.asp` | Review & verify; `SubmitOrder()`, `SetAutoShip()`, `CancelOrder()`. |
| `50_PaySubmit.asp` / `50_PayAuth.asp` | Payment method selection + card entry (CyberSource Microform). |
| `50_mobilePayments.asp` | Apple/Google Pay sheet. |
| `60_ProcessPayment.asp`, `65_ProcessPayment.asp` | Gateway processing. |
| `60_PayReturn.asp` | **Order confirmation** — "Your Order Has Been Placed!", optional "Setup Account (Optional)". |
| `60_PayXPayPal.asp`, `60_PayXVisa*.asp`, `60_PayXauthNetAIM-*.asp` | Legacy handlers. |
| `40_ReorderSubmit.asp` (61 KB) + `_INCReorderFunctions_.asp` | **One-click reorder** express flow (see §8). |

### Login / guest (`_INCloginFrontend.asp`, `_INCloginBackend.asp`, `Logon.asp`, `oauth.asp`)
- **Guest checkout**: "Check Out As Guest" (`action=checkout&guest=1`).
- **Create account**: `action=checkout`.
- **Returning**: email + password (min 7 chars) → `AuthenticateUser`.
- **Social sign-in**: **Facebook** (JS SDK) and **Google** (GSI). Server side: `oauth.asp` validates against `OAuthRequests(idLogin, Email, FirstName, LastName, AuthToken, AuthValidated)`, then finds `customer` by email; tracks `signinAttempts` with lockout. No Apple Sign-In.
- **Password reset**: request / `eid` + `key` → `ValidatePasswordReset` → `SetUserPasswordCID`. Also from `TrackOrder.asp`.

### Step 1 — `20_Customer.asp` fields
Billing: `name`, `lastName`, `address` (Melissa Express Entry autocomplete), `city`, `zip`, `locState` (+ `locState2` free text when state = 99), `customerCompany`, `email` (with "customer does not have an e-mail" checkbox), `phone`, `futureSMS`, required Privacy Policy checkbox, hidden `futureMail=Y`, `newsletter=Y`, `remindin=6`.
Shipping (toggled by "ship to different address"): `shippingName`, `shippingLastName`, `shippingAddress`, `shippingCity`, `shippingZip`, `shippinglocState`/`shippinglocState2`, `shippingPhone`.
Also: saved-address radio picker, `fsalesCode` (sales rep code), `xToken` anti-CSRF GUID.
Validation helpers: `isEmailValid`, `IsNonPhysicalAddress` (PO Box / APO detection), `IsAcceptedEmailAddress`, `DetermineDropship`, state option builders.
**Address validation: SmartyStreets** — `UpdateAddressWithSmartyStreets(addr, city, state, zip, classification)`, "Verify Address" modal.

### Step 2 — `30_Ship_CC.asp` shipping options
Built by `_INCshipFunctions_.asp` from `shipRates` × `shipMethod`. Radio list; values are AES-encrypted (`rate|label`).
Observed labels: `FREE Economy Shipping (4-10 Days)`, `Economy (4-10 Days)`, `FAST - FedEx Delivery (1-2 Days)` / `(3-4 Days)` / `(4-5 Days)` (`fastFedExActive`), **International** → live **DHL** rate.
Optional **UPS / USPS insurance** dropdowns (`_INCinsurancecheck_.asp`). PO-Box-ineligible options disabled with tooltip. `_INC_Transit_Time.asp` computes delivery-by dates.
**Free-shipping rule:** threshold from `storeAdmin.pFreeShipThresh` (`configArr(82)`); **currently $99** (hardcoded fallback in three files). Header drops it to **$75 for "Email VIPs"** (`utmSource = klaviyo/email` or `sg/email`). Footer copy: free **economy** shipping on U.S. orders over $X to the **lower 48**; excludes AK, HI, PO Box, APO/FPO/DPO and international. International block advertises free shipping over $85 or flat $6.95 economy (stale).

### Payment methods
- **Primary: CyberSource** with **Microform** tokenization — card data never touches the ASP app.
- **PayPal** (+ **Venmo**), **Google Pay**, **Apple Pay**.
- Saved cards from `wallet` table (filtered by `geoCode`, `autoToken = 0`, type not PayPal).
- Authorize.Net and Litle explicitly retired ("now using CyberSource" — `65_ProcessPayment.asp` line 616) but `paymentType` still defaults to the string `AuthorizeNet`.
- Fraud: MaxMind, **Signifyd** on returns.
- Error capture: `RecordCheckoutError.asp`, `RecordPayPalError.asp`, `paymentCheck.asp`, `vaultCheck.asp`.

---

## 8. Account area

Nav is centralized in **`_INCCustomerNavigation.asp → GetAccountNavigation()`**:

| Label | File |
|---|---|
| Shopping Cart (only if qty > 0) | `cart.asp` |
| **Order History** | `custListOrders.asp` (89 KB) → detail `custViewOrders.asp` |
| **Appliance Profile** | `custModels.asp` |
| **Subscriptions** | `MyAutoDelivery.asp` |
| **Account Details** | `custEdit.asp` |
| **Payment Methods** | `custPayments.asp` (53 KB) |
| **Product Reminders** | `custReminders.asp` ("My Reminders") |
| **Privacy & Security** | `custSecurity.asp` (account email, change password, e-mail preferences) |
| Logout | `Logon.asp?action=logoff` |

- **Order history** also hosts **returns**: per-item return form, writes `returnheader` + `autorefunds`, surfaces an RMA number, pushes to **Signifyd**, offers refund-to-wallet selection. Tracking numbers inline. Non-returnable items flagged.
- **Reorder:** "Re-Order Now" → `40_ReorderSubmit.asp` + `_INCReorderFunctions_.asp` (2,500+ lines): `InitializeCart`, `createReorderItems`, `UpdateOrderAddress`, `UpdateQuantities`, `SetShippingOptions`/`UpdateShippingMethod`, `FormatDeliveryDates`, `UpdateAutoship`, `SwitchAndSave`, `add_gift_item`, `GetHandlingFeeTotal`, `GetCustomPricing`, `SubmitOrder`. A compressed one-page checkout for returning customers.
- **Saved payments** (`custPayments.asp`): `wallet` table (token RC4-encrypted, last4, exp, cardType, nickname, isDefault, isValid, isEnabled, geoCode, paypalVaultCID). Add-card popup uses CyberSource Microform; a 24-hour `customer_interaction_tokens.securityToken` guards the tokenization endpoint. Duplicate-card detection.
- **Subscriptions = Ordergroove.** `MyAutoDelivery.asp` embeds the OG "MSI" (My Subscriptions Interface) — auth via `og_auth` cookie on `.filtersfast.com`, HMAC-SHA256 signature, RC4 payload. `HasActiveSubscription()` calls `api.ordergroove.com/customer/has_subscriptions`. Guest access via `?og_user_id=`.
- `auto-delivery.asp` — public **Home Filter Club** marketing page (How It Works, Features, Subscribe at Checkout, FAQ accordion). `.htaccess` alias `/HFC`.
- `start-subscription/default.asp` — "Start HFC Subscription" entry.
- `HomeFilterClub/` — a separate legacy HFC funnel ("FILMORE™ Filter Selection Tool"). Last commit 2023-02 — legacy.

---

## 9. Reviews, referrals, affiliates, B2B, promos, charity, returns, tracking, support, static

### Reviews
- `reviews.asp` — Trustpilot service-review page (grid widget; 5-stars-only list when `?utm_medium` present).
- `_INCproductreviews_.asp` — PDP product reviews + Q&A (§3).
- Homepage Trustpilot widget.

### Referrals
- **Talkable.** `refer.asp` and `shareDashboard.asp` render a Talkable offer div, but **`refer.asp` now 301s to `/`** — the referral program is switched off. Residual plumbing: `?talkable_promo=` cookie, consumed in `60_PayReturn.asp`.

### Affiliates
- `aff/default.asp` — affiliate landing page: `<h1>{affName}</h1>`, "Products You May Like", "Popular Categories". Driven by `affiliateRecords(idAff, affName, affPagename, affDiscount)`.
- Sitewide `getIdAffiliate(?idAff)`; affiliate promos use contextTag prefix `AFF-`.

### B2B
- `business-services.asp` — "Business Services | B2B Filtration Solutions", "Ordering for Your Business Made Simple", **"Apply for Terms"** form. Alias `/business-services/`. Currently commented out of the footer.
- `b2b/b2bInventory.asp` — SKU/qty/price feed (for StockSync). `b2b/b2bAddProducts.asp` — disabled. Partner feeds, not customer UI.

### Promos / sweepstakes / giveaways
- `promo/default.asp` — **promo-code landing pages**, URL `/promo/<CODE>`. Looks up `DiscOrder` by `discCode`, supports a **"Deal of the Day"** variant, renders `discTitle` (default "Congratulations!"), custom content/image, then `SetDiscountCode(discTag)` and redirects to `/?contextTag=<tag>`.
- `sweepstakes/default.asp` — Official Rules page.
- `giveaway/default.asp` — entry form (first, last, email, reCAPTCHA), per-campaign cookie to prevent re-entry.
- `CLT.asp` (`/CLT`) and `Filter10now.asp` (`/Filter10now`) — campaign landing pages.
- `frontdoor/`, `HSA/`, `2-10/`, `american-home-shield/`, `aaa/`, `idme/` — **partner discount landing pages**: Frontdoor 10% off, AAA 15% off, ID.me military/first-responder, home-warranty partners. Common shape: hero, "Save X% Off", "1000s of Products", "Subscribe & Save", "Free Shipping", 3-step instructions, FAQ, "Popular Categories".
- `new-page-template.asp` — scaffold for these landing pages.

### Charity
- `wine-to-water/` — primary partner since 2011.
- `xtreme-hike/` — Cystic Fibrosis Foundation Xtreme Hike.
- `habitat-for-humanity/`.
- All three linked from the footer; checkout donation widget alternates between Wine To Water and Xtreme Hike.

### Returns
- `returns.asp` — public return-request form (`emailName`, `emailFrom`, `emailPhone`, `emailOrder`, `emailReason`, `emailBody`).
- `returnorders.asp`, `ReturnLabel.asp` — RMA label generation.
- Self-service returns inside `custListOrders.asp` (§8).
- **Policy:** eligible returns within **365 days**; free return labels for eligible returns (contiguous US only); refunds to original payment method; items must be new/unused with original packaging. **Non-returnable: custom air filters, masks, mask replacement filters, commercial HEPA filters, products damaged during/by installation or misuse.** Original shipping not refunded. Refused deliveries may incur a **$10 processing fee**.

### Order tracking
- `TrackOrder.asp` (28 KB) — guest order lookup by `idOrder` + `randomKey`, plus a password-request/reset flow.

### Support
- `support/default.asp` (`/support/`) — "Filters Fast Support Portal", embeds **nanorep / Bold360** support center from `support.filtersfast.com`. Special-case iframe for the damaged-item guide.
- `support/search.asp` — support search. `support.asp` (root) — older nanorep embed.
- `support-chat/` — **"Virtual Assistant"**: `default.asp` (chat UI with canned prompts: "Where is my order?", "How do I cancel my order?", "How do I cancel my Home Filter Club subscription?", "How do I update my payment information for the Home Filter Club?"), `think.asp` (52 KB), `submit-question.asp`, `record-response.asp`. (Inventory 02 reads `think.asp` as keyword scoring with no LLM call; this pass saw `_INCgeminiAPI_.asp` included. **Verify before rebuild.**)
- Live chat also triggered from header `OpenSupportInterface('True')`.
- Contact channels sitewide: **866-438-3458** (phone), **704-228-9166** (SMS), **support@filtersfast.com**.

### Static / legal
`aboutUs.asp`, `our-story.asp`, `our-mission.asp`, `our-brand.asp`, `links.asp`, `termsAndCond.asp` (anchors `#privacy-policy`, `#shipping-policy`, `#returns-ref-policy`, `#accessibilityStatement`), `caInfoSharingDisclosure.asp` (CCPA), `terms/FF-Authorized-Agent-Designation-Form.pdf`, `sysMsg.asp`, `403.asp`, `404.asp`, `500.asp`.
Header also links **`forums.filtersfast.com`** and **`blog.filtersfast.com`**.

---

## 10. Mobile (m-dot)

**`mobile/` is a full parallel site tree (96 entries) and is still actively maintained** (commits through 2026-09-04).

**Device detection** lives at the top of `_INCheader.asp` (`MobileCheck.asp` is a no-op stub still included ~50×):
```
userDeviceType = CheckUserAgentDevice()   ' _INCintFunctions.asp
Phone and not under /mobile/  -> redirect to /mobile/<script>
PC    and under /mobile/      -> redirect to /<script> + &mredctd=1
```
Tablets are not redirected. `MobileCheckCart.asp` holds the old inline UA regex and redirects `cart.asp` to `mobile/cart.asp`.
Desktop templates emit `<link rel="alternate" href="/mobile/<spagename>">`. `.htaccess` mirrors every rule for `/mobile/…`. Mobile has its own CSS/JS/images, `manifest.json`, `service-worker.js`.

**Rebuild implication:** one responsive codebase replaces both; ~80 mobile URLs need 301s to their desktop equivalents.

---

## 11. Localization / currency / international

- **Country selection:** `setLocale.asp?ISO2=XX&return=<url>` writes cookie `geoCFloc` (2-hour expiry) and `welcomeMsgLocal=3`. Accepted: **CA, AU, AT, BE, DE, FR, GR, IE, IT, NL, ES, UK**; anything else → US.
- **Geo-IP default:** `geoCFCountry()` in `_INCheader.asp` (Cloudflare geo naming).
- **Country → currency map:** US → USD; Canada → CAD (swaps logo to `ff-logo-canada-red.png`); Australia → AUD; AT/BE/FR/DE/GR/IE/IT/NL/ES → EUR; UK → GBP.
- **FX:** `currRateG` / `convertPrice` / `convertCurr` in `_INCintFunctions.asp`, reading `currencyRates(cName, cRate)`. `convRateGlobal` applied to every displayed price; `formattedCurCode` appends `(CAD)` etc.
- **Rate maintenance:** `currencyUpdate.asp` — internal-IP-only utility.
- **International UX:** free-shipping banner and Apple Pay suppressed when currency ≠ USD; international shipping quoted live via **DHL**; `carthead.intCurrency` persists the order currency; `_INClocations_.asp` validates state/country combos.
- **Language:** English only; `_INClanguage_.asp` is a string-constant table, not i18n.

---

## 12. PWA

- `manifest.json`: name "FiltersFast", icons 192/512, `start_url "/"`, `display "standalone"`, `background_color #F26822`, `theme_color #FFFFFF`, PushEngage GCM sender.
- `service-worker.js` — one line importing **PushEngage** web push. No offline caching.
- `sw.js` — malformed Edgemesh import; dead.
- Manifest is only linked from three templates (model + mobile checkout) — installability is effectively broken today.

---

## 13. SEO

### URL structure (Helicon ISAPI_Rewrite, `.htaccess`, ~400 lines)
| Pattern | Target |
|---|---|
| `/<slug>-cat.asp` | `prodlist4.asp?pagename=…` |
| `/p-<slug>.asp`, `/pg1-<slug>.asp`, `/<slug>-filter…`, catch-all `/<anything>` | `prodviewhv2.asp?pagename=…` |
| `/p-filters-fast-custom-air-filters.asp` | `prodviewcustom.asp` |
| `/models/<modelnumber>` | `models/model.asp?modelnum=…` |
| `/modellookup/<modelnumber>` | `modellookup/modellookup.asp?modelnum=…` |
| `/Video-How-*` | `video_list.asp?pagename=…` |
| `/filters/<kw>`, `/nav/<kw>` | **301** → `redirectHub.asp?kw=<kw>` |
| `/popular/<x>` | `/search/` (QSA) |
| `/sitemap.html` | `/sitemap.asp` |
| `/business-services/`, `/HFC`, `/CLT`, `/Filter10now`, `/welcomeback`, `/reserve` | friendly aliases |
| `/blog*`, `/forums*`, `/articles/ArticleImages/*` | 301 to `blog.` / `forums.` subdomains |
| root `*.pdf`, root images | 301 into `/ProdImages/PDF/`, `/ProdImages/` |

Product/category slugs are **stored in the DB** (`products.pagename`, `categories.pagname`) and include the `.asp` extension in the public URL (e.g. `/GE-Refrigerator-Water-Filters-cat.asp`, `/p-filters-fast-sp12-chrome-plated-shower-head.asp`).

### Canonicalization
- Host canonicalization → `https://www.filtersfast.com`, plus rules for `search.`, `email.`, `eml.` subdomains.
- SEO-relevant redirects issue **301**.
- Canonical/meta/robots handling in `UserMods/_INCmeta_.asp` / `_INCtitlecheck_.asp` / `UserMods/_INCtitle_.asp` (by `spagename`).
- `search.asp` sets `X-Robots-Tag: noindex, nofollow`; account/cart/checkout links `rel="nofollow"`.
- No reciprocal `rel=canonical` from mobile→desktop found — an existing SEO gap.

### `redirectHub.asp`
Keyword → destination resolver backed by `redirectHub(keyword, idProduct, directPagename, typeID)`. Order: exact keyword → `directPagename`; else joined `products.pagename`; else `products.details LIKE '%kw%'` ordered by `poprank`; else home. Always 301.

### Structured data inventory
- Homepage: `WebSite` + `SearchAction`, `FAQPage`
- PDP: `Product` (+ `Offer`, `AggregateRating`, `Review`), `isRelatedTo` compatibility graph, `FAQPage`
- PLP: `BreadcrumbList` (microdata), category `FAQPage`
- Model pages: `Product` nodes via `getModelLD()`
- Custom filter page: `Product`

### Sitemap
`sitemap.asp` — HTML sitemap (`/sitemap.html` alias), linked in the footer. `BingSiteAuth.xml`, `.well-known/pki-validation/`, Pinterest and Facebook domain-verification metas. (No XML sitemap generator found in the repo beyond `sitemap-images.images.xml`; verify where the XML sitemap comes from.)

---

## 14. Dead / legacy vs. active — quick verdict

| Status | Items |
|---|---|
| **Active** | `default.asp`, `_INChomepagecontent_.asp`, `_INCheader.asp`, `_INCfooter.asp`, `_INCscripts.asp`, `prodlist4.asp`, `prodViewHv2.asp`, `prodviewcustom.asp`, `listbysize2.asp`, `search.asp` + `search/`, `_INCSearchRedirects.asp`, `cart.asp` + all discount/express/donation/subscription includes, `05→65` checkout chain, `40_ReorderSubmit.asp`, all `cust*.asp`, `Logon.asp`/`oauth.asp`/`_INCloginFrontend.asp`, `MyAutoDelivery.asp`, `auto-delivery.asp`, `models/`, `ModelLookup/`, `modellookuphome.asp`, `refrigeratorFinderTool.asp`, `reviews.asp`, `_INCproductreviews_.asp`, `returns.asp`/`returnorders.asp`/`ReturnLabel.asp`, `TrackOrder.asp`, `support/`, `support-chat/`, `redirectHub.asp`, `sitemap.asp`, `promo/`, `giveaway/`, `sweepstakes/`, partner landings, charity pages, static pages, entire `mobile/` tree |
| **Legacy / superseded** | `prodview.asp`, `all-items.asp`, `_INCheader_4_2.asp` / `_INCfooter_2.asp`, `UserMods/_INCtemplate_xhtml_checkout.asp`, `MobileCheck.asp` (no-op stub), `60_PayX*.asp`, `_INCauthNet_.asp`, `HomeFilterClub/` (2023 FILMORE funnel), `custom/_old`, `wine-to-water/old` |
| **Dead** | `ssearch.asp`, `sli-parse-page.asp`, `srchupload/` feeds, `refer.asp` + `shareDashboard.asp` (Talkable), `b2b/b2bAddProducts.asp`, `pool/index.html`, `sw.js`, Xtreme-Hike donation window (expired Oct 2025), `currencyUpdate.asp` (internal) |
| **Not customer-facing** | `Manager/`, `automation/`, `taxjar/`, `googleApi/`, `Maxmind/`, `FedEx/`, `CyberCharge/`, `PayPal/`, `Config/`, `bin/`, `obj/`, `.vs/`, `bpn/`, `fbItems/`, `app/api/…route.ts`, `OrderInsertionAPI*.asp`, `shpfyOrdersCreation*.asp`, `sendGridApi*.asp`, `abandonedPendingOrders.asp`, `b2b/b2bInventory.asp` |

### Risk notes worth carrying into the rebuild
- Hardcoded secrets in source (Trustpilot, AAA, ID.me, PayPal, SQL connection string in `prodlist4.asp` ~line 233 and `ssearch.asp`). See inventory 02 §B5.
- `IsNotManufacturer()` is a ~1,400-line hardcoded brand list — must become a data table.
- Dozens of business rules are hardcoded date/ID switches (banner windows, `promoItemDisc` cases 1–6, idProduct 1851/14698/14697/1108/1109/1381/3309, idCategory 25/64/110/121/264/995/1000/1035/1160 and the fridge-brand ID map) — these need to be data-driven.
- `priceValidUntil` in Product JSON-LD is set to today, which invalidates the offer daily.
