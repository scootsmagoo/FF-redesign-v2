# Legacy Inventory 04 — Inferred SQL Server Schema

Generated September 10, 2026 from the ASP source (no DB access). Types are **inferred** from
`validSQL(x,"I"/"D"/"A"/"S")` casts, quoting style and comparisons. `(?)` = existence or spelling
uncertain. This is the basis for `scripts/legacy-export/*.sql` and for the D1 schema in `packages/db`.

Conventions:
- `validSQL(v,"I")` → integer, `"D"` → decimal/money, `"A"`/`"S"` → string.
- Boolean-ish columns are inconsistent: some are `bit`/`int` (`0/1`), some are Access-era `int`
  (`-1` = true, e.g. `products.active`, `products.hotDeal`), some are `char(1)` `'Y'/'N'`
  (`noShipCharge`, `taxExempt`, `freeproduct`).

## 1. `products`

Evidence: `Manager/SA_prod_exec.asp:551-628` (INSERT), `:659-735` (UPDATE), `Manager/SA_prod_edit.asp:200-213`, `Manager/searchgen.asp:92-110`, `prodViewHv2.asp:335-342`, `prodlist4.asp:921-937`, `cart.asp:896-898`.

| Column | Type | Meaning |
|---|---|---|
| idProduct | int identity PK | |
| sku | varchar | FiltersFast SKU (emitted as `mpn`) |
| manufacturesku | varchar | manufacturer / OEM part number |
| manufacture | varchar | brand name |
| description | varchar | short title |
| descriptionLong | varchar/text | long description |
| details | text | main body copy (HTML) |
| relatedKeys | varchar | search keywords |
| price / listPrice | money | current / MSRP |
| cgs | money | cost of goods |
| MAP (?) | money | minimum advertised price |
| ogPrice | money NULL | Ordergroove feed price |
| weight | decimal | shipping weight |
| dimFee | decimal | oversize fee |
| stock | int | on-hand; `-250` = discontinued, `-150` = special order |
| ignoreStock | bit/int | sell regardless of stock |
| actualInventory | int NULL | WMS quantity |
| leadTime | int | days |
| dropShip | bit/int | |
| delayedShipmentFlag (?) | bit | |
| blockedReason | varchar NULL | `''` = sellable, `'TEMPUNAVBL'` = temporarily unavailable, other = blocked |
| active | int | `-1` active, `0` inactive |
| hotDeal | int | `-1` = on Specials |
| homePage | int | list sort priority |
| featuredcart | int | (always 0) |
| poprank | int | popularity, lower = better, default 9999 |
| pagename | varchar | SEO URL incl. `.asp`, unique |
| fileName | varchar | legacy |
| imageURL / smallImageURL | varchar | file names under `/ProdImages/` |
| imageURL2Pack / imageURL3Pack | varchar | pack images |
| oldNewImgFlag (?) / guaranteeBadge | bit | |
| metatitle / metadesc / metakey | varchar | SEO |
| noShipCharge | char(1) Y/N | free shipping |
| discountedShipping | char(1) Y/N | |
| srcFreeShip (?) | bit | source-driven free shipping |
| taxExempt / freeproduct | char(1) Y/N | |
| giftwithpurchase | int | |
| AutoShipEnabled | bit/int | Home Filter Club eligible |
| recommendedfrequency | int | replace every N months |
| RecommendedProd / recommendOnly | int | |
| related1..3 | int | legacy related ids |
| CompareTo / compareToAlt / CompareToSortOrder | int | side-by-side comparison |
| compareDefaultOption | int | idOption used for compare/feeds |
| familyDesignation (?) | varchar | `'OEM'` / `'Compatible'` |
| privateLabel | bit/int | house brand |
| packMultFlag | int | `3` = multiply by packSizeUOM |
| packSizeUOM / packSize | int | units per pack |
| maxCartQty | int | per-order cap |
| showPriceInCart | bit/int | hide price on PDP (MAP) |
| feedoverride / includeInFeed / dealtimecat | int / Y/N / varchar | feeds |
| googleActionsEnabled / googleActionsPrice / googleMinAutoDisc | bit / money / money | |
| wpNotAff | bit | Whirlpool affiliate exclusion |
| retExclude | int | return policy code 0/1/2 |
| prop65 / madeInUSA | bit | |
| upc / upcn | varchar | GTIN |
| reviewAllow / reviewAutoActive | char(1) Y/N | |
| idPaired | int | parent product for child SKUs (0 = none) |
| discontinuedAlternative | int | replacement idProduct **or** idCategory |
| discontinuedAltType | int | `0` = product, else category |
| discontinuedText | varchar | uses `[LINK_START]/[LINK_END]` tokens |
| tempUnavailableAlternative / tempUnavailableText | int / varchar | |
| Item_No_ | varchar | NAV item number |
| fridgeFilter / ffAirFilter / ffWaterFilter / humidifierFilter / homeAirFilter | bit | product-class flags used by promo engine |

Not columns: `dateAdded`, `idCategoryDefault`, `mpn`, `gtin`, `googleOfferId` (resolved via UDF `dbo.GetProductByGoogleOfferId`), video/PDF (rows in `product_images`), sales restrictions (table `sale_restrictions`).

Side tables: `ProductSearchCompDetails(Id, Details, siteSearchDisable)`, `product_price_changelog(idProduct, prevPrice, newPrice, adminUser, discountChanges)`, `tsourceprice(idproduct, idOption, source, price, adMedium, priceDate)`, `productsApplianceIDs(idproduct)`.

## 2. Categories

`categories`: idCategory PK, idParentCategory (0 = root), categoryDesc, categoryH1, categoryHTML, categoryHTMLLong (text), categoryFeatured, sortOrder, metatitle, metadesc, metacat, categoryGraphic, categoryImage (`/ProdImages/category/`), categoryContentLocation (int), **pagname** (no "e"), categoryType (feed `cattype`), hideFromListings (bit), compareActive (bit), compareHeader (?).

`Categories_Products`: idCatProd PK, idProduct, idCategory.

`subcats` does not exist; sub-categories are `idParentCategory` self-joins. `tCategoryLogo(idCat, imageUrl)`.

## 3. Options

- `options`: idOption PK, optionDescrip, priceToAdd (money), weightToAdd, percToAdd, taxExempt (Y/N), sortOrder.
- `optionsGroups`: idOptionGroup PK, optionGroupDesc, optionReq, optionType (dropdown/radio), sortOrder, sizingLink.
- `optionsXref` (option↔group): idOptOptGroup PK, idOptionGroup, idOption.
- `optionsGroupsXref` (group↔product): idOptGrpProd PK, idProduct, idOptionGroup.
- `OptionsProdEx` (exclusions): idOptionsProdEx PK, idOption, idProduct.
- `OptionsPrices`: idProduct, idOption, optPrice, optListPrice, optCgs, optGoogleMinAutoDisc.
- `productOptionInventory`: idProduct, idOption, stock, Unavailable, Blocked, reasonCode, updateCPStock, dropShip, specialOrder.
- `product_option_images`: idProduct, idOption, optionImageUrl.

## 4. Product satellite tables

| Table | Columns |
|---|---|
| `product_images` | idProduct, imageUrl, imgSortOrder (1-4; may hold YouTube/.mp4 URLs) |
| `productDimensions` | idProduct, idVal → `prod_dim_values(idVal, code, codeVal)`, `prod_dim_codes(code, name)` |
| `productSpecs` | idProduct, idType, filterLifeMonths, filterLifeMonthsTo, nsf42, nsf53, lead, mercury, merv, hideMerv, dust, pollen, moldSpores, petDander, material, antimicrobial, alleviateCold, smokeSmog, allergens, bacteria, virusCarriers, filterPercent, charcoalAir, idFilterType, micron, sediment, silt, scale, mediaType, flowRate, voltage, wireHarness, incDirections, iceCount, n95, n99, replaceFilter, bpaFree, connectionType, badtaste, chlorine, odor, disposable, efficiency, diameter, [top], bottomDiameter, [length], [weight], surfaceArea |
| `productGroups` | prodGroupP, prodGroupC |
| `productTypes` / `productTypeXref` / `productTypeAttribute` / `productTypeAttrXref` / `productTypeAttributeValue` | typed attribute system: (productTypeID, typeName) / (idProduct, typeID) / (attributeID, attributeName, valueSuffix) / (productTypeID, attributeID) / (attributeID, idProduct, attributeValue) |
| `RelatedProductsXref` | idProduct, relatedIdProduct, sortOrder |
| `productCompSkuList` | id, idProduct, skuValue, skuBrand |
| `productManufacturers` | Manufacturer |
| `actualSizes` | idProduct, nomSize, actSize, sActive |
| `custom_size_xref` | option_sku (= idOption), actual |
| `custom_std_productID` | product_id, custom_id, [type], depth |
| `tProdUOM` | old_idProduct, old_idOption, cgsPPT, cgsItemCard, no_marketplace_sales |
| `tUnitName` | idUnit, idProduct, unitName, uActive |
| `search_products` | filterId, idProduct, idOption, size, depth, [type] (MERV), brand, sizeActive, [row], [column] (1 Good / 2 Better / 3 Best) |
| `sale_restrictions` | idProduct, blockedCountry char(2), blockedState |

## 5. Model / finder tables

| Table | Columns |
|---|---|
| `tFridgeModelLookup` | idModel, idProduct, Manufacturer, FridgeModelNumber, Category, excludeFromFeed, noindex, cpAddition, adminUser |
| `tFridgeModelSearch` | FridgeModelNumber (normalised search index; table or view, unknown) |
| `customer_models` | idCust, idModel, dateAdded |
| `refrigerator_finder` | idBrand (= idCategory), idStyle, styleDesc, idLoc, locDesc, idRemove, removeDesc, altRemovalImg, idProduct, altprod1, altprod2, active |
| `tWaterFilterFinder` | idCat, idType, len, wid, micron, idProduct, active |
| `tWaterFilterType` | idType, typeDesc, typeImg, active |
| `tWaterFilterSize` | idType, length, width, sizeImg |
| `tHumidifierFinder` | idCat, len, wid, thick, idProduct |
| `ffsb_sku_xref` | FF_SKU, SB_SKU (Sellbrite), FF_OPTION, FF_ID_PRODUCT |

There is no `models` table; `/models/{x}` resolves through `tFridgeModelLookup` / `tFridgeModelSearch` / `redirectHub`.

## 6. Discounts / promos

`DiscOrder`: idDiscOrder, discCode, discTag, discPerc, discAmt, discFromAmt, discToAmt, discStatus (A/I), discOnceOnly (Y/N), discValidFrom / discValidTo (int YYYYMMDD), discFreeShipping, discLandingPage, discThresh, discThreshFlag, displayPerc, discMatchValue, discMultiByQty, discTitle, discContent, discUseCustomContent, discProductText, discSplashImage, discImageLoc, redirectPagename, promoItemFlag, promoItemDisc, giftWithPurchaseFlag, giftWithPurchaseGroup, bogoFlag, tieredSaleFlag, tieredThresh1..4, tieredDiscAmt1..4, requirePresenceType, requirePresenceID, autoAddWithPresenceId, exclusiveDiscount, isCompoundable, addOnDiscounts, hideFreeShipBanner, allowOnForms, discMinQty (?).

`DiscProd`: idDiscProd, discAmt, discPerc, discFromQty, discToQty, idProduct, source.
`tDiscCode`: discCode, discTag, discStatus (single-use referral codes). `tReorderCode`: discCode, discStatus.
`deal`: iddeal, dealdiscription, startprice, endprice, units. `custom_sales_code`: salesId, name, salesCode, active (no `salescodes` table).
`partner_discounts`: idLog, partnerName, idOrder, membershipID, apiResponse, idDiscOrder, isValid.
`affiliateRecords`: idAff, affName, affPagename, affContent, affImage, affDiscount, active. `affiliateProducts`: idAff, itemID, recordType (0 = product).

## 7. Customers

`customer`: idCust, status ('A'), dateCreated, dateCreatedInt, password (RC4-hex or SHA-256; `secConvDt` set when converted), email, name, lastName, customerCompany, phone, address, city, zip, locState, locState2, locCountry, shipping* (Name, LastName, Phone, Address, City, Zip, LocState, LocState2, LocCountry), paymentType, addressclassification, remindin (default 6), newsletter / futureMail / futureSMS / taxExempt (Y/N), taxExemptExpiration, affiliate (N/A), commPerc, generalComments, guestAccount, signinAttempts, isMilitary, isEmployee, changePwdOnLogin.

`Locations` (countries **and** states): idLocation, locName, locCountry, locState ('' on country rows), locTax, locShipZone, locStatus. No `Country`/`States` tables.
`wallet`: idWallet, idCust, token, last4, expMo, expYr, [type], nickname, isEnabled, isValid, isDefault, autoToken, dtCreated.
`customer_interaction_tokens`: idToken, idCust, securityToken, tokenTimestamp. `OAuthRequests`: idLogin, Email, FirstName, LastName, AuthToken, AuthValidated.

## 8. Orders

`cartHead` (live cart **and** order header): idOrder, idCust, randomKey, orderDate, orderDateInt, paidDate, DateCancelled, ReasonCancelled, orderStatus ('U' cart; '1'/'2'/'7' sales; '9' refund), subTotal, taxTotal, shipmentTotal, Total, taxRate, handlingFeeTotal, InsuranceTotal, retailFeeTotal, donationAmount, adjustAmount, adjustReason, discCode, discPerc, discTotal, promoDiscCode, promoDiscAmt, ogAutoship, ogAutoshipAmt, ogSessionId, shipmentMethod, Tracking, billing fields (name, lastName, customerCompany, phone, email, address, city, locState, locCountry, zip), shipping fields, paymentType, cardType, cardNumber (masked), cardExpMonth, cardExpYear, cardName, cardVerify, avscode, cvvcode, riskscore, generalComments, storeComments, storeCommentsPriv, privateComments, auditInfo (IP), ipCountryCode, referralSource, utmCampaign, affiliatepaypal, idAffiliate, commPerc, CampaignID, salesPersonCode, reorderFlag, mobileOrder, guestCheckout, intCurrency, intCheckout, thirdpartyordernumber.

`cartRows`: idCartRow, idOrder, idProduct, sku, product_sku, customSKU, quantity, unitPrice, unitCost, unitWeight, description, taxExempt, idDiscProd, discAmt, autoshipDiscAmt, free, custom, caseQty, giftParentID, sourcePriceFlag, googleAutoDiscount, adCustomFrequency, googleLineID, oosBackorder, autoshipFlag, subFreq, subDisc, downloadCount, downloadDate.
`cartRowsOptions`: idOrder, idCartRow, idOption, optionPrice, optionDescrip, optionWeight, taxExempt.
`returnHeader`: idReturn, idOrder, idCust, returnDate, orderDate, orderDateInt, returnStatus (0 new, 3 refunded), auditInfo, discount, retTax, retTotalAmt, returnComment, salesPerson.
`returnRows`: idOrder, idReturn, idProduct, idOption, quantity, returnReason, unitPrice, refundOnly.
`refundOrders`: idOrder, rfAmount, originalTransID, refundTransID, paymentType, complete, completeDate.
`order_credits`: idCredit, idOrder, idCust, dtCredit, amtCredit, currencyCredit, methodCredit, reasonCredit, noteCredit, responseCredit, stsCredit, userCredit, transactionId, idWallet, idPaypal.
`tShipHistory`: idorder, track, ServiceType, ShipDate, Imported. `autorefunds`: idReturn, idCust, refundComplete, returnStatus.

## 9. Shipping / geography

`ShipMethod`: idShipMethod, shipDesc, status. `shipRates`: idShipRate(?), idShipMethod, locShipZone, unitType, unitsFrom, unitsTo, addAmt, addPerc. `upsHolidays`: holidayDate. `currencyRates`: cName ('CAD','AUD','EUR','GBP'), cRate, cDate. `productShipping` is a bit column on `mods`, not a table.

## 10. Content / misc

`reviews`: idReview, idProduct, revDate, revAuditInfo, revStatus ('A'), revRating, revName, revLocation, revEmail, revSubj, revDetail.
`faq`: id, qType, qDesc, idProduct, idCat, qRank, question, answer, active, typeDesc.
`support_articles`: idArticle, articleURL, articleTitle, articleContent, articleKeywords. `support_categories`: idCategory, categoryName, categoryImage, categoryURL, categorySortOrder, categoryActive, categoryVisible, categoryBot. `support_categories_articles`: idEntry, idCategory, idArticle, sortOrder. `support_faqs`: idFAQ, idArticle, OrderSort.
`newsletters`: idNews, newsDate, newsDateInt, newsSubj, newsBody. `tosend`: email, name, lastname.
`mods`: ModID, Titles, Insurance, Shipping, Discount, related, featuredcart, featwording, productshipping, callLongWait, chatActive, txtChatEnabled, phoneNumActive.
`redirectHub`: keyword, idProduct, directPagename, typeID (1 search term, 2 model). `prodRedirect`: id, oldPagename, newPagename, rStatus. `catRedirect`: oldPagename, newPagename, rStatus.
`subscription_orders`: idOrder, order_xml, order_number, error. `product_order_reminders`: idCust, idProduct, idOption, idOrder, remindIn, remindActive.
`storeAdmin`: configVar, configVal, configValLong, adminType ('C' = control record).

### `storeAdmin.configValLong` positions (split on `*|*`, must be exactly 83 values)

0 urlNonSSL · 1 urlSSL · 2 pDownloadDir · 3 pImagesDir · 4 mailComp · 5 pSMTPServer · 6 pEmailSales · 7 pEmailAdmin · 8 pCompany · 9 pCatalogOnly · 10 pMaxCartQty · 11 pMaxItemQty · 12 pMinCartAmount · 13 pMaxItemsPerPage · 14 pOrderPrefix · 15 pCurrencySign · 16 pStoreLCID · 17 pShowStockView · 18 pMailIn · 19 pPayPal · 20 payPalMemberID · 21 pCreditCard · 22 pCCType · 23 pAuthNet · 24 authNetLogin *(secret)* · 25 authNetCurrCode · 26 payMsgMailIn · 27 payMsgCreditCard · 28 payMsgPayPal · 29 payMsgOther · 30 payMsgNotReq · 31 TwoCheckOut · 32 TwoCheckOutSID · 33 payMsgTwoCheckOut · 34 pEmailFriendSec · 35 pMaxDownloadHours · 36 pMaxDownloadCount · 37 payDefault · 38 pAuthNetFrontEnd · 39 pCompanyAddr · 40 payMsgAuthNet · 41 TwoCheckoutMD5 *(secret)* · 42 pHideAddStockLevel · 43 payCustom · 44 payMsgCustom · 45 taxOnShipping · 46 allowShipAddr · 47 prodViewLayout · 48 shipDisplayType · 49 defaultCountryCode · 50 pHidePricingZero · 51 payCallIn · 52 payFaxIn · 53 payCOD · 54 payMsgCallIn · 55 payMsgFaxIn · 56 payMsgCOD · 57 listViewLayout · 58 taxBillOrShip · 59 statUpdPending · 60 handlingFeeAmt · 61 handlingFeeTax · 62 payPalCurrCode · 63 authNetTxKey *(secret)* · 64 homeViewLayout · 65 pEmailStockLevel · 66 pAuthNetType · 67 pHTMLarea · 68 pProdThumbs · 69 pNochex · 70 NochexMemberID · 71 payMsgNochex · 72 MERC_ID *(secret)* · 73 MERC_PIN *(secret)* · 74 CHECK_PAYEE · 75 ALLOW_VISA · 76 ALLOW_MASTERCARD · 77 ALLOW_DISCOVER · 78 ALLOW_AMEX · 79 pecho · 80 payMsgEcho · 81 DisableRBPA · 82 **pFreeShipThresh**.

Other `storeAdmin` rows are simple pairs: `EnablePhone`, `EnableChat`, `PhoneHighVolume`, `WeatherAlert`, `TechDifficultiesAlert` (`-1`/`0`).

## Feed generation and displayability

- `Manager/searchgen.asp` → `prodgen.txt`: `FROM Products p LEFT JOIN optionsGroupsXref … LEFT JOIN ProductSearchCompDetails pscd WHERE active = -1 AND pscd.siteSearchDisable = 0 AND d.idOptionsProdEx IS NULL`, skipping `price = 0`. Feed `Description` = `details` + all `productCompSkuList.skuValue` + all `tFridgeModelLookup.FridgeModelNumber` + ` (sku / manufacturesku)`. `Stock1` forced to 100 when `ignoreStock = 1`. `freeshipping` forced `'Y'` when price > 98.89. `aslowasprice` = base price − max `DiscProd.discAmt`.
- `categories.txt`, `categories_products.txt`, `keyword-url.txt` are **not** generated by anything in the repo (external SQL Agent/SSIS). Headers map 1:1 to `categories`, `Categories_Products`, `tFridgeModelLookup`.
- `sitemap.asp` is static HTML; there is no XML sitemap generator in the repo.
- Category listing: `active = -1 AND stock <> -250 [AND isnull(blockedReason,'') = '']`, ordered by `homepage asc, isAvailable desc, poprank, stock desc`, where `isAvailable = (ignoreStock = 1 OR stock > 0) AND stock <> -250`. Categories with `hideFromListings = 1` are skipped.
- PDP: looks up by `pagename` after checking `prodRedirect` (301). An inactive product still renders with a banner. Discontinued when `blockedReason` is non-empty and not `TEMPUNAVBL`; alternatives resolved through `idPaired` → `discontinuedAlternative` (product or category per `discontinuedAltType`).

**Safe "live, buyable product" predicate for migration:**
```sql
active = -1 AND stock <> -250 AND isnull(blockedReason,'') = '' AND freeproduct = 'N' AND price <> 0
```

### Gaps to verify against the real DB
`products.subHeader`, `familyDesignation`, `MAP`, `srcFreeShip`, `oldNewImgFlag`; `categories.compareHeader`; identity column names on `shipRates` / `Locations` / `upsHolidays` / `currencyRates`; the job that writes the three non-repo feed files.
