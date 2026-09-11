# Legacy Manager inventory — products, options, promotions, compatibility, SxS export

Survey of `FiltersFast/Manager`, September 11, 2026. See also `04-manager-content.md`, `04-manager-orders.md`, `04-manager-admin.md`.

## Menu (Product Management / Marketing)
Categories (ProductCategories) · Products (Products) · Options (ProductOptions) · Images (ProductImages) · Redirects (Redirects) · List by Size, SxS Page Export, Search Log, Related Products (Products = 1) · Promotions (Promotions). Off-menu: bulk updater, product export, top 300, feed generators, pickers, compatibility manager, snapshot, option image, Gemini.

## 1. SA_prod.asp — product list (Products > -1)
- 50/page, cookie `ProdSearch`. Phrase (≥ 2 chars) matches description, long description, SKU, UPC (punctuation stripped), details, and compatible SKUs (`productCompSkuList.skuValue`). Filters: start-with letter on description/SKU, category (incl. "No Categories"), active, featured (`homepage`), special (`hotDeal`), free shipping, reviews allowed. Sort: poprank (default), description, SKU, price, stock, id asc/desc.
- Columns: id, SKU, description, UPC, price, stock (red at/below `pHideAddStockLevel`), actual inventory, parent (`idPaired`), active, ignore-stock, Preview | Edit.
- Links: Add, Product Export, Purchaser Export, Bulk Updater, Top 300, jump-to-id form. Bulk delete disabled.

## 2. SA_prod_edit.asp — product editor (12 tabs; `_INCproductManagement.asp`)
Actions edit | add | copy (saved as add) | del (broken). Client validation: manufacturer must be from `productManufacturers`; discount grid (from/to ascending, non-overlapping, amount or percent, amount < price); MAP guard (price − max discount, Google/Bing feed prices ≥ MAP) with double confirm; free-shipping under $99 warning; unsaved-changes prompt; return to the same tab after save.

### General
active (-1/0) · description (H1, required, ≤ 250) · manufacture (required, from approved list) · SKU (required, ≤ 30, unique) · pagename (readonly on edit; required on add; must contain `p-`, `-filter` or `-replacement`; not `-cat.`; unique; normalized `.asp`) · manufacturesku (required) · upc · upcn (hidden) · productUnit (`tUnitName`, blank = "Filter") · retExclude (0 normal / 1 refund only / 2 non-returnable; mirrors parent when paired) · recommendedfrequency (required, default 6) · AutoShipEnabled (parent-managed when paired) · noShipCharge Y/N · discountedShipping Y/N · prop65 · madeInUSA · hotdeal · freeproduct · homePage (featured first) · giftwithpurchase (product id) · price (min MAP; readonly on children except ids 2278/2279) · listPrice · cgs · weight · dimFee (editable only for appliance parts, `productsApplianceIDs`) · showPriceInCart · feedoverride · includeInFeed (locked when stock = -250) · googleActionsEnabled/Price (parked) · googleMinAutoDisc (option-level when the product has options) · googleFeedPrice / bingFeedPrice (`tsourceprice` per adMedium, random 5-char source code per save, history with preview `?source=`) · OGFeedPrice (`ogPrice`) · CompareTo (SxS partner id), CompareToAlt, CompareToSortOrder (2 compared first / 1) · wpNotAff · discontinuedAlternative (+ type product/category) + discontinuedText (`[LINK_START]`/`[LINK_END]`) · tempUnavailableAlternative + text · stock (display only: stock (actual)).
- Read-only: product id, NAV item no, rank (poprank), MAP, pack size UOM (`tProdUOM`), blocking reason, drop ship (`ignoreStock=1 AND stock<>-150`, lead time), special order (`stock=-150 AND ignoreStock=1`), parent link, children list, sale restrictions (country/state). Sentinels: stock **-250 discontinued/blocked**, **-150 special order**.

### Content/SEO
metatitle · metadesc · metakey · comparisonEngineText (`ProductSearchCompDetails.Details`) · descriptionLong (≤ 250) · details (CKEditor).

### Specifications
Product type (`productTypes`) with typed attributes (`productTypeAttribute` via `productTypeAttrXref`, values in `productTypeAttributeValue`, suffix per attribute); type change resets values.

### Images
smallImageURL, imageURL, imageURL2Pack, imageURL3Pack (readonly text set via browse/upload modals, `/ProdImages/`); gallery `galImage1–4` → `product_images (imageUrl, imgSortOrder)`; absolute URLs accepted.

### Categorization
General brand category (children of the category named "Brands"), child categories (leaf categories, grouped by type; parent derived; picker excludes discontinued sub-categories under id 1188), related products (sortable, max 10, `RelatedProductsXref`; defaults 1381/15682/1896 when empty; new products get 7 defaults), dealtimecat (Google Shopping category, required).

### Options
compareDefaultOption · one option group per product (`optionsGroupsXref`) with per-option: price/list price (only when the URL contains `furnace-air-filters/`), cgs, Google/Bing feed price, Google min auto-discount (`OptionsPrices`, `tsourceprice`), custom image (`product_option_images`), exclude/include (`OptionsProdEx`). Read-only option inventory table (`productOptionInventory`: update CP stock, drop ship, special order, available/reason, blocked, inventory) with CSV download.

### Discounts
Quantity tiers `DiscProd (discFromQty, discToQty, discAmt, discPerc)`; posted as `from|to|amt|perc~…`; replicated to children (except 2278/2279); price change or tier change logged to `product_price_changelog (idProduct, prevPrice, newPrice, adminUser, discountChanges)`.

### Compatibility
Modal iframe `SA_GetCompatibles.asp?view=parts|models`: parts = editable brand/SKU rows (`productCompSkuList`; children read-only and show the parent's), models = `tFridgeModelLookup` list. Saves on close via `SA_CompSKUManager.asp` (add / remove / save / mergeparts / mergemodels to parent). "Model Request" modal adds/removes models (`SendModelRequest.asp`).

### SxS Compare
`productSpecs` row per product keyed by compare type: 0 classic, 1 refrigerator, 2 air, 3 humidifier, 4 air purifier, 6 sediment water, 8 ice makers, 9 masks, 11 fridge air, 12 straws, 13 inline, 14 carbon water, 15 pool & spa (5/7/10 retired). Fields: filterLifeMonths/To, hideMerv, flowRate (or capacity gallons), filterPercent, charcoalAir, merv, material, mediaType, micron, connectionType, efficiency, iceCount, voltage, nsf42, nsf53, lead, mercury, dust, pollen, moldSpores, petDander, antimicrobial, alleviateCold, smokeSmog, allergens, bacteria, virusCarriers, sediment, silt, scale, badtaste, odor, chlorine, wireHarness, incDirections, disposable, n95, n99, bpaFree, diameter, top, bottomDiameter, length, weight, surfaceArea. Save rejects a mismatched compare type with the compared product.

### FAQ (iframe `SA_GetProdFAQs.asp`), Dimensions (`prod_dim_codes/values` → `productDimensions`: APPLICATION, BRAND, CATEGORY, DEPTH, HEIGHT, LENGTH, MANUFACTURER, MEDIATYPE, MERVRATING, MICRON, SUBCATEGORY, WIDTH), Gemini pricing (include file missing; `SA_gemini_query.asp` calls Gemini with a hard-coded key and logs to `gemini_pricing_log`).

### Nav
List | New | Edit | Delete | Copy | Test | Model Request | Help. Snapshot (JSON of every form field, base64 values, written to `Manager\productversions\`) is commented out and its viewer missing.

## 3. SA_prod_exec.asp (Products ≥ 1; level 2 = price/list/cgs/tiers only)
- Validation list: SKU required + unique; manufacturer; manufacturer SKU; dealtimecat; description; long description ≤ 250; numeric price/list/stock/weight/dimFee; indicator values; add-only pagename rules; price ≥ largest tier amount; SxS type match.
- Add inserts stock 0, popRank 9999, 7 default related products. Edit updates ~65 columns, upserts feed prices, propagates price/list/cgs/feedoverride/ogPrice to children, logs price changes, on SKU change updates `ffsb_sku_xref` (Sellbrite) and emails jamil@, arnold@, lesliedriggers@filtersfast.com "Web Product SKU Update".
- Id-dependent writes: unit name; comparison text; gallery images; categories (diff); option prices + feed prices; option group; option excludes; quantity tiers; child spread (frequency, return policy, images); productSpecs insert/update/delete; dimensions; specification values; related products.
- Delete cascades (transaction): categories_products, optionsGroupsXref, DiscProd, reviews, productGroups, OptionsProdEx, ProductSearchCompDetails, Products. Leaves 16 satellite tables orphaned.

## 4. sa_prod_bulk.asp (Products = 1) — generate then execute raw `UPDATE products` SQL: ids one per line; find/replace across metatitle, metadesc, metakey, description (+ descriptionLong), details, comparison text; set images; set parent (`idPaired`, prevents self-pairing).

## 5. sa_prod_export.asp (Products = 1) — search term (+ details), include inactive, columns (id, description, sku, poprank, price, listPrice, MAP, cgs, stock, ignoreStock, dropShip, blockedReason, url, isActive, actualInventory, pairedStatus Parent/Child/Non-Paired); on-screen table + client CSV.

## 6. SA_prod_discounts.asp — Promotions (Promotions > -1; write = 1; locked promos only Site Administrator)
- Views: Active, Deals of the Day (`daily-deal`), Inactive, Locked. Columns: code, type (Global / Product: sku / Category / class sentinels -9 humidifier, -8 home air, -7 FF water, -6 fridge, -5 manufacturer, -4 keyword), discount (BOGO, tiered, % or $ off, each, + free shipping, + gift), single-use, multi-qty, compoundable, promo form, valid dates, valid cart total, page type (0 homepage / 1 landing / 2 product / 3 category), status (not yet active / expired / active / inactive), Preview (`?contextTag=` or `/promo/<code>`), Edit/View, Duplicate, Enable/Disable.
- Editor: General — discCode (≤ 20; `daily-deal` for DOTD), status, target (global / product / category / class), target id (+ lookup by SKU/category name), auto-add with presence, match keywords, type $ / %, amount, percent (stored ÷ 100), free shipping, hide free-ship banner, allow on forms, gift with purchase (standalone / group + ids), BOGO, tiered (4 tiers threshold + amount). Constraints — valid from/to, cart total from/to (defaults 1 / 9999.99), threshold scope cart / category, require presence (product/category id), usable every X days, multiply by qty, once-only, single-use. Content — dynamic/custom content, landing page type, title, splash image, image location, content (CKEditor), product text, redirect pagename. Stacking — compoundable + add-on promos (by tag). Internal — notes, creator, created date.
- Save: duplicate code check; **new `discTag` on every save** (breaks shared context links); `discThresh = discFromAmt`; dollar discount raises `discFromAmt`; DOTD forces to = from; duplicate DOTD increments dates. Enable/disable, delete (URL only).

## 7. SA_related_products.asp (Products = 1 menu) — related links pointing at blocked products (not TEMPUNAVBL): remove/replace single, bulk remove/replace, then renumber sortOrder.

## 8. Compatibility — `SA_GetCompatibles.asp` (parts/models views) + `SA_CompSKUManager.asp` (add / remove / save / mergeparts / mergemodels). Cross-ref SKUs `productCompSkuList (id, idProduct, skuValue, skuBrand)`; models `tFridgeModelLookup`.

## 9. SxS export (`SA_SxSExport.asp`, Products = 1)
- Rows = OEM products with `CompareTo > 0 AND CompareToSortOrder IN (1,2)` in the selected verticals (recursive category tree from hard-coded roots: water, air, refrigerator, pool & spa), optionally inactive, optionally only with children.
- 18 columns: OEM ID, OEM SKU, OEM Name, OEM URL, Compatible ID, Compatible SKU, Compatible Name, Compatible Hub ID (parent of the compatible when paired), Compatible Hub SKU, Compatible URL, Child Count, Child IDs, Child SKUs, Child Names (`; `-joined children of the hub), OEM Parts Count, Compatible Hub Parts Count (cross-ref SKU counts), Compare Sort Order, OEM Active.
- UTF-8 BOM CSV, every field quoted; on-screen table with edit links and summary; email as attachment via SendGrid to `@filtersfast.com` addresses only (`sxs_export_YYYYMMDD.csv`).
- Storefront: the SxS page is the compare view between an OEM product and its compatible (`CompareTo`, sort order decides which shows first, `compareDefaultOption`, `productSpecs` drive the comparison rows).

## 10. Options
- `SA_opt.asp` (ProductOptions > -1): all options (id, description + "See Products" = excluded products, sort, price, percent, weight, tax-exempt), bulk delete. Editor: description (≤ 50), priceToAdd, percToAdd, weightToAdd, taxExempt, sortOrder; shows groups containing it. Exec (= 1): validation, delete cascades optionsXref + OptionsProdEx (orphans prices/images/inventory).
- `SA_optGrp.asp`: groups with option and product counts; editor: description, type S dropdown / T text input (max one option), required, sort; membership add/remove with "exclude from products after add". Delete blocked while options or products are linked.
- `SetOptionImage.asp`: per product+option image insert/delete.

## 11. sa_listbysize.asp (Products = 1) — size chart rows (`search_products`: size, row, column Good/Better/Best, depth, type MERV, brand, sizeActive) joined to product/option stock; toggle active; View link.

## 12. top300.asp (Statistics) — top 350 SKUs/options sold in the last 7 days with stock and out-of-stock flags.

## 13. Feed generators (`searchgen.asp`, `searchgenSS1.asp`, unauthenticated) — tab-delimited site-search feeds to `srchupload/prodgen.txt` / `prodgenss.txt` (20 columns each; pack multipliers, non-stock flags, as-low-as price, OE list).

## 14. Pickers — `SA_GetProducts` (search ≥ 4 chars), `SA_GetOptionGroups`, `SA_GetOptionGroupOptions`, `SA_GetOptions` (excluded products), `SA_GetProdCats` (general = children of "Brands"; children = other leaf categories), `SA_idLookup` (SKU/category name → id, GUID-keyed).

## Appendix — tables
`Products` (~90 columns), `ProductSearchCompDetails`, `product_images`, `product_option_images`, `productSpecs`, `productDimensions`, `prod_dim_codes/values`, `productTypes`, `productTypeAttribute`, `productTypeAttrXref`, `productTypeXref`, `productTypeAttributeValue`, `tUnitName`, `tProdUOM`, `productsApplianceIDs`, `productManufacturers`, `product_price_changelog`, `ffsb_sku_xref`, `sale_restrictions`, `search_products`, `productCompSkuList`, `tFridgeModelLookup`, `Categories`, `Categories_Products`, `Options`, `OptionsGroups`, `optionsXref`, `optionsGroupsXref`, `OptionsProdEx`, `OptionsPrices`, `productOptionInventory`, `tsourceprice`, `DiscProd`, `RelatedProductsXref`, `DiscOrder`, `dealtime`, `gemini_pricing_log`.

## Appendix — risks not to port
Missing include; raw SQL execution in bulk updater; hard-coded SendGrid/Gemini keys and lookup GUID; unauthenticated feed scripts; view-level users able to mutate compatibility/option images/related products; `MAX(id)` identity; orphaning deletes; precedence bug in compatible remove; `discTag` regenerated each save; magic ids (2278/2279, defaults 1381/25495/15682/1896/18998/17631/2098, category 1188, "Brands").
