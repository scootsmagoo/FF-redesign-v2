# Legacy Manager inventory — admin, promotions, shipping, locations, reports, utilities

Survey of `FiltersFast/Manager`, September 11, 2026. See also `04-manager-content.md`, `04-manager-orders.md`, `04-manager-products.md`.

## 0. Cross-cutting
- `Config/config.asp`: connection string, `rc4Key`, `og_hash_key`, `storeID`, `demoMode`.
- `_INCsecurity_.asp`: hard-coded internal IP allow-list (9 entries) → 403; session `adminLoggedOn` ∈ {0,1}.
- `_INCadmins.asp`: `ValidateAdminCredentials()` (RC4+hex password compare, reset link mode valid 24 h), session permission string `Name:Level|…`, `GetAccessLevel(name)` → -1 none / 0 read-only / 1 full / 2 restricted (255 = UI "unassigned"), `SetNewPassword` (blocks last 5, `cp_pwd_history`), `PasswordIsComplex` (lower + upper + digit + symbol, ≥ 8), 16-char random temp passwords, `SendAdminMail` via SendGrid template `d-2f83b29e…` with the reset link.
- `validSQL` only in newer pages; CandyPress-era pages concatenate raw form input.
- Dates: orders `orderDateInt` `YYYYMMDDHHMMSS`; discounts `discValidFrom/To` `YYYYMMDD`.

## 1. Roles and permissions
- `sa_admins.asp` (Admins > -1; actions at 1): list `cp_admins ⋈ cp_roles` scoped by the viewer's role (Site Administrator sees all; CE Level 2 sees CE Level 1/2 + Ameridial/Ameridial Level 2; others only their own role). Columns realName/userName, role, last logon, enabled. Links: Create User, Manage Roles, Failed Logins.
- `sa_admin_edit.asp` (Admins = 1): realName, userName (email, readonly on edit, unique), role (scoped), sales person code (required, from `custom_sales_code` active), enabled, and per-permission level selects (`perm-<id>`: 255 unassigned, 0 read-only, 1 full, 2 restricted). Rules: Read-Only hidden for Redirects, CreditAPI, InboundManager, TaxExemption, TokenizedCheckout; Restricted only for Customers, Orders, Setup, Products; InboundManager full control only assignable by Site Administrator. Choosing a role pre-fills the selects from `cp_role_permissions`. Create → temp password + email; Reset password → new temp + email (link valid 24 h). Shows next password due (90 days).
- `sa_admin_roles.asp` / `sa_admin_role_edit.asp` (Admins = 1 and role Site Administrator): role name + per-permission level grid from `cp_permissions (idPermission, permissionGroup, permissionName, permissionDesc, permissionSort)`.
- `sa_admin_logins.asp`: last 100 `cp_failed_logins` (email, method, timestamp).
- `sa_update_admin_password.asp`: forced change (≥ 8, complex, not one of last 5) when 90 days elapsed; `sa_welcome.asp` enforces the expiry and shows the user's permission matrix grouped by `permissionGroup`, next password date, sales code.
- `logon.asp`: email + password; `returnUrl` redirect; reset-link login.
- `default.asp`: server info + orders pending/paid counts (24 h).
- **Permission names (31):** Products, Setup, Customers, Orders, Promotions, Shipping, Statistics, Admins, Credits, ProductOptions, ProductImages, ProductCategories, Locations, Reviews, Returns, Mods, Discounts, Deals, Affiliates, TaxExemption (no read-only), Newsletter, Support, InboundManager (no read-only), Impersonate, Vault, Subscriptions, Redirects (no read-only), Marketplaces, Donations, BackorderNotifications, TokenizedCheckout (no read-only), CreditAPI (no read-only).
- Menu gating (`_INCheader_.asp`): Site Administration (Setup & Utilities, Mods, Statistics, Stats Google [adminID 2/5], Payment Logs, Daily Sales, Users, Text Configurations [Setup > 0], Sales Codes [Setup = 1]); Order Management (Orders, Orders Legacy, Subscriptions, Marketplaces, Refund Returns, Order Credits, Donations, Locations & Tax, Shipping); Customer Management (Customers, Customers Legacy, Reviews, Backorder Requests, Inbound Manager, Support Portal); Product Management (Categories, Products, Options, Images, Redirects, List by Size / SxS Page Export / Search Log / Related Products [Products = 1]); Marketing (Promotions, Affiliates, Newsletters; Discounts and Deals links commented out).

## 2. Discounts (`SA_disc*`, legacy order-level codes on `DiscOrder`)
- List (Discounts > -1): status (A/I/U), once-only, code phrase, sort by code/valid-from, 25/page, cookie. Columns code, from/to amount, percent, amount, status, once, valid dates.
- Editor/exec (form = 1; exec only > -1, a gap): `discCode` (≤20, no spaces/quotes, unique), `discFromAmt`/`discToAmt` (≥ 0, to ≥ from), exactly one of `discPerc` (0 < p ≤ 100) / `discAmt` (> 0, ≤ to), status A/I/U, once-only Y/N (flips to U after use), valid from/to (`YYYYMMDD`, to ≥ from). Applies to order total before tax/shipping after product discounts. Bulk delete.
- The current promotions editor (`SA_prod_discounts.asp`, products inventory §6) supersedes it and uses many more `DiscOrder` columns.

## 3. Deals (`SA_deal*`, table `deal`): description, start/end price band, free units. "Buy over $X get N free". Minimal validation. Orphaned in the menu.

## 4. Sales codes (`sa_salescodes.asp`, Setup = 1): `custom_sales_code (salesId, name, salesCode, active)`; add (name + code prompt, upper-cased), soft delete. Consumers: admins, session, orders `salesPersonCode`. "Define the code in NAV first."

## 5. Affiliates
- `sa_affiliates.asp` (Affiliates ≥ 0, edit = 1): `affiliateRecords (idAff, affName, affPagename (slug, readonly after create), affContent (CKEditor), affImage (/ProdImages/category/), affDiscount %, active)` + `affiliateProducts (idAff, recordType 0 product / 1 category, itemID)` via pickers. Test link `/aff/<slug>`.
- `SA_aff.asp` (legacy report): per-affiliate orders (paid/shipped/complete) in a date range with commission = (subTotal − discTotal) × commPerc.

## 6. Shipping configuration (Shipping: view > -1, exec = 1)
- Overview page (docs only): Store rates (zones × methods × weight/price bands), Online rates (carrier APIs), Custom (user exit).
- Methods `ShipMethod (idShipMethod, shipDesc, status A/I)`: list, add/edit (unique description), delete cascades to rates.
- Rates `ShipRates (idShip, idShipMethod, locShipZone, unitType P price / W weight, unitsFrom, unitsTo (to > from), addAmt, addPerc)`: list filtered by method/zone/type, 50/page; at least one of amount/percent; **when both are set the higher wins**; price bands use gross total before discounts/tax.
- UPS / USPS / Canada Post settings as `storeAdmin adminType='S'` rows: `UPSactive, UPSAccessID, UPSUserID, UPSPassword, UPSfromCntry, UPSfromZip, UPSshipCode (service or all), UPSpickupType, UPSpackType, UPSweightUnit, UPSallRates`; `USPSactive, USPSUserID, USPSPassword, USPSfromZip, USPSservice (CSV of Express/First Class/Priority/Parcel), USPSintNtl, USPSsize, USPSmachinable`; `CPactive, CPmerchantID, CPfromZip, CPsizeL/W/H`.

## 7. Locations and tax (Locations: view > -1, exec = 1)
- `Locations (idLocation, locCountry, locState (blank = country row), locName, locTax %, locShipZone, locStatus A/I)`. List countries (filter by name/country initial, tax > 0 / = 0, zone; sort; 50/page) with their states in a dropdown. Editor: country form + add-state form + state list (edit/delete). Rules: country code unique; state code unique within a country; state tax/zone override the country's; a zone with no rates suppresses the location at checkout; renaming a country code cascades to its states; deleting a country deletes its states.
- `SA_marketplace_taxes.asp` (Setup = 1): `marketplace_state_tax_facilitators (idEntry, marketplace amazon|ebay|sears|walmart, locState, dateAdded)` add/remove; presence = marketplace collects tax there.

## 8. Reports
- `SA_stats.asp` (Statistics > -1): general reports over paid/shipped/complete orders — top products by quantity / amount, top customers by orders / value, top countries by value, lowest inventory (top 50); orders-over-time bar chart by count or total, status (U, S, 0, 12 = paid+shipped+complete, 1, 2, 7, 9, 91 = cancelled-paid), period 1–14/21/30, interval day/week/month/quarter/year (paid statuses use paidDate); plus 14-day grids: inserted subscription orders (count, revenue, discounts, requests, rate, AOV), Amazon, Walmart, eBay orders per day.
- `SA_stats_google.asp`: Google auto-discount / CPC profit grids (appliance vs non-appliance) over 21 days: qty sold, revenue, profit (cost-of-goods waterfall option → paired parent → product).
- `SA_totalsales.asp` (Statistics = 1): net-of-tax total and order count by month/year (excluding 9, S, 0, U). `SA_totalsubscription.asp`: same for subscription orders (gross).
- `sa_daily_sales.asp` (+ `_realtime` 60 s polling): report type FiltersFast / Marketplace / Ordergroove, date, 24 toggleable columns (order, customer, timestamp, site, source, promotion, currency, payment, salesperson, riskscore, AVS/CVV, subtotal, shipping, handling, taxes, fees, donation, discount, HFC, total, valid, reorder, exempt, subscription); summary totals; CSV export; **Valid = subtotal + tax + fees + shipping + handling + donation − discount equals total**.
- `sa_donation_dashboard.asp` (Donations nav, Credits check): funds VEN0698 Wine to Water, VEN1488 Habitat for Humanity, VEN0416 Cystic Fibrosis; date range (≤ 90 days by day, ≤ 366 by month), line chart per fund, detail table (order, customer, date, fund, amount).
- `sa_marketplaces.asp` (Marketplaces): trend (≤ 90 days) by marketplace (Amazon, eBay, Walmart) count or totals, details (≤ 8 days) with SellBrite id link.
- `sa_discount_stat.asp` (Promotions > -1): promo usage (orders, discounted dollars) bar chart + table with preview links; per-code detail line chart (discounts vs subtotals) + order table with discount rate; internal-only and exclude-inactive filters (inverted bug); CSV export.

## 9. Utilities (Setup)
- `utilities.asp` hub: Store Configuration, Text Configuration, DB write test, DB structure check (+ apply DDL), Email test, CP graphics, fundraiser, donate text, upload files, send email, server variables. Raw SQL console disabled.
- `utilities_Config.asp` (~80 `storeAdmin adminType='C'` keys): URLs/folders (`urlNonSSL`, `urlSSL`, `pDownloadDir`, `pImagesDir`), email (`mailComp`, `pSMTPServer`, `pEmailSales`, `pEmailAdmin`), company (`pCompany`, `pCompanyAddr`), general (`pCatalogOnly`, layouts, `pMaxItemsPerPage`, `taxBillOrShip`, `pHidePricingZero`, `pMaxCartQty`, `pMaxItemQty`, `pMinCartAmount`, `pOrderPrefix`, `pCurrencySign`, `pStoreLCID`, `defaultCountryCode`, download limits, `pHTMLarea`, **`pFreeShipThresh`**), stock (`pShowStockView`, `statUpdPending`, `pHideAddStockLevel`, `pEmailStockLevel`), shipping (`shipDisplayType`, `allowShipAddr`, `taxOnShipping`, `handlingFeeAmt`, `handlingFeeTax`), offline payments + messages, PayPal, Nochex, Echo, 2CheckOut, Authorize.Net (`pAuthNet`, `authNetLogin`, `authNetTxKey`, `DisableRBPA`), custom payments, default payment. Validation per field; `controlRec` blob.
- `utilities_Text.asp` (`storeAdmin adminType='T'`): `termsAndCond` (CKEditor), `cartMsg`, `saveOrderEmail`, `statusUpdateEmail`, `passRequestEmail`, `emailToFriend`, `paySuccessMsg`, `payErrorMsg` with `#TAG#` tokens.
- `utilities_DBstruc.asp`: CandyPress 2.4 schema check for 25 tables with generated repair DDL (executed verbatim by the exec page).

## Appendix — tables
`cp_admins, cp_roles, cp_permissions, cp_role_permissions, cp_admin_permissions, cp_pwd_history, cp_failed_logins, custom_sales_code, storeAdmin (C/S/T), DiscOrder, DiscProd, deal, affiliateRecords, affiliateProducts, ShipMethod, ShipRates, Locations, States, marketplace_state_tax_facilitators, cartHead, cartRows, CartRowsOptions, products, optionsPrices, productsApplianceIDs, ffsb_orders_processed`.

## Appendix — defects not to port
Discount exec weaker than its form; donation dashboard permission mismatch; marketplace taxes under Setup; affiliate report under Mods; new-affiliate assignments written with id 0; hard-coded role ids; SQL leaked on failed login; reversible RC4 passwords and reset links carrying the password; reflected XSS on logon; GET mutations without CSRF; arbitrary DDL endpoint; inverted "exclude inactive" filter; SQL concatenation everywhere; inconsistent date helpers.
