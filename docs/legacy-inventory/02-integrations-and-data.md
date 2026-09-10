# Legacy Inventory 02 — Integrations & Data Layer

Generated September 10, 2026 from the `FiltersFast` ASP Classic repo. Secret *locations* are listed so they can
be rotated and moved to Wrangler secrets; no secret values are reproduced here.

**Platform base:** CandyPress Store 2.4 (© 2003) — every core file still carries the CandyPress header. Heavily forked over ~20 years. Classic ASP (VBScript) + JScript server-side blocks + PHP 7.3 sidecar (FastCGI) for payment/SOAP work. IIS with Helicon ISAPI_Rewrite 3 (`.htaccess`) plus one `<rewrite>` rule in `web.config`.

**~4,075 files:** 494 `.asp` (root), 377 `.php` (mostly vendored SDKs), plus a near-complete duplicate `/mobile/` tree (a second, older fork of the whole storefront).

---

## PART A — Third-Party Integrations

### A1. Payments

| Provider | Purpose | Files | API style | Status |
|---|---|---|---|---|
| **CyberSource** (primary) | Card auth/capture/credit; Flex Microform tokenization; Decision Manager | `_INCmicroform_.asp`, `Cyber_charge_request.php`, `Cyber_charge_request3Token.php`, `Cyber_charge_request9Token.php`, `Cybersource_request_credit.php`, `CyberCharge/Cyber_charge_class*.php`, `CyberCharge/CreditProcessors/` | Hybrid: REST (`api.cybersource.com/microform/v2/sessions`, HTTP-Signature auth) + legacy **SOAP** via PHP (`ics2wsa.ic3.com`, test `ics2wstesta.ic3.com`) | **ACTIVE** |
| **CyberSource EBC** | Automated refund posting | `60_autoRefundEBC.asp` → posts to `Cyber_charge_Refund.php`; `ebc.cybersource.com` | POST to local PHP shim | ACTIVE (batch) |
| **Authorize.net AIM** | Legacy card gateway; also the transport for mobile-wallet charges | `60_PayXauthNetAIM-max2.asp`, `-max2fm.asp`, `-max4.asp`, `50_mobilePayments.asp`, hosted-form POST in `50_PaySubmit.asp` L386 | AIM name/value POST to `secure.authorize.net/gateway/transact.dll` + one hosted `transact.dll` form | **PARTLY LEGACY.** `_INCauthNet_.asp` is literally `'DEPRECATED: No longer in use.` but `-max4` is still the target of `50_PayAuth.asp` L110 and `x_login` values are live |
| **PayPal** | Express Checkout | `PayPal/ExpressOrder.asp`, `ExpressOrderFull.asp`, `ExpressPayment.asp`, `ExpressGetOrder.php`, `ExpressSubmitPayment.php`, `PayPal/paypal-api-v2/` (BraintreeHttp SDK), `Paypal_request_credit.php`, `60_PayXPayPal.asp`, `_INCppConstants_.asp`, `_INCppCallerService_.asp`, `RecordPayPalError.asp` | NVP (v98) via WinHTTP + REST v2 via PHP SDK | ACTIVE (two generations coexist) |
| **Apple Pay** | Wallet on PDP/cart | `applepay-process.asp`, `50_mobilePayments.asp` (token base64 → CyberSource) | JS PaymentRequest → JSON POST to ASP | ACTIVE (git: "Re-implementation of ApplePay") |
| **Google Pay** | Wallet | `50_mobilePayments.asp` (`gPayLoad.paymentMethodData.tokenizationData.token`) | JS SDK + token relay | ACTIVE |
| **Samsung Pay** | Wallet | `50_mobilePayments.asp` (`samsungPayCybersource()`), `spay.samsung.com` | JS SDK → CyberSource | ACTIVE-ish |
| **Visa Checkout / Visa SRC** | Wallet | `60_PayXVisa.asp`, `60_PayXVisa2.asp` | JS SDK → `Request.Form("PST")` JSON payload | **LEGACY** (Visa Checkout sunset) |
| **Paymetric (XiIntercept)** | Referenced in CSP `xiecomm.paymetric.com` | `web.config` only | iframe | **LEGACY/residual** |
| **2Checkout, Nochex, eCheck, COD, mail-in, fax-in, call-in** | Config-driven alternate tenders | `_INCconfig_.asp` | hosted form | **DEAD CandyPress remnants** |
| **BNPL (Affirm/Klarna/Afterpay/Sezzle)** | — | none found | — | **NOT PRESENT** |
| **Amazon Pay** | — | none. Only `Config/filtersfast/amazonOrders.csv` (a marketplace order dump) | — | **NOT PRESENT** |

**Payment flow:** `50_PayAuth.asp` → `50_PaySubmit.asp` (Microform capture context) → `60_PayXauthNetAIM-max4.asp` / `60_ProcessPayment.asp` / `65_ProcessPayment.asp` → `60_PayReturn.asp` (confirmation + all conversion pixels). `65_ProcessPayment.asp` is a near-identical clone of `60_` — likely an A/B or abandoned fork.

There is an **external ASP.NET sidecar not in this repo**: `/PaymentProcessor/Tokenization.aspx?action=add` (posted to from `custPayments.asp` L381) and `/kvmapi/api/Secret` + `/kvmapi/api/Check` (Azure Key Vault proxy, see A11).

### A2. Fraud / Geo

- **Signifyd** — device fingerprint (`/js/signifyd-script-tag.js` in `50_PaySubmit.asp` L253), return-abuse API (`custListOrders.asp` L460 posts to `api.signifyd.com`), `console.signifyd.com`, plus `h64.online-metrix.net` (ThreatMetrix) in CSP. Tables `signifyd_logs`, `signifyd_response`. **ACTIVE**
- **MaxMind** — `Maxmind/CreditCardFraudDetection.class.asp`, `Maxmind/FraudIndex.asp` (included by `60_/65_ProcessPayment.asp`), and `geoip.asp` → `geoip.maxmind.com/geoip/v2.1/city/{ip}` REST + Basic auth. **ACTIVE** (v2 note: Cloudflare provides geo headers for free, which covers the geoip use)
- **Brandlock** (`*.brandlock.io`) and **edgeme.sh** in CSP — coupon/extension blocking. Client-side only.
- **reCAPTCHA v3** — `reCaptcha.asp`. **ACTIVE** (v2 note: Cloudflare Turnstile is the free equivalent)
- **Bouncer Shield** — `_INCscripts.asp` L200-211, `app.usebouncer.com`. Client-side bot/fraud. **ACTIVE**

### A3. Shipping / Carriers

| Carrier | Files | API style |
|---|---|---|
| **UPS** | `_INCshipUPS_.asp` → `https://www.ups.com/ups.app/xml/Rate`; tracking in `sendGridApiEL.asp` → `onlinetools.ups.com/ups.app/xml/Track` | Legacy UPS XML — **deprecated by UPS** |
| **USPS** | `_INCshipUSPS_.asp` (`API=Rate`), `_INCshipUSPSi_.asp` (`API=IntlRate`) → `production.shippingapis.com/ShippingAPI.dll` | USPS Web Tools XML — **retired by USPS (2026)** |
| **FedEx** | `FedEx/TrackWebServiceClient.php` + `FedEx/wsdl/TrackService_v14.wsdl` | **SOAP** (PHP SoapClient) — **retired WSDL API** |
| **Canada Post** | `_INCshipCP_.asp` → POST to a raw IP over plaintext HTTP | Legacy CP XML — **almost certainly dead** |
| **DHL** | `dhlTokenRequest.asp`; tracking links to `track.dhl-usa.com`, `webtrack.dhlglobalmail.com` | token request | likely legacy |
| Transit-time calc | `_INC_Transit_Time.asp` (business-day math against `upsHolidays` table) | internal | ACTIVE |
| Rate/method rules | `_INCshipFunctions_.asp` (52KB), `shiprates`, `shipmethod`, `productshipping` tables | internal | ACTIVE |
| Ship confirmation | `automation/shipconfirm.asp`, `shipconfirm2.asp`, `shipconfirmG.asp`, `shipfedex.asp`, `shipUpCP.asp` | inbound GET `?idorder=&tracking=` from WMS | ACTIVE |

⚠️ Every one of the four carrier rate APIs uses a **sunset endpoint**. This is a rebuild blocker regardless of platform (new UPS OAuth REST, USPS APIs v3, FedEx REST).

### A4. Tax

- **TaxJar** — `TaxCalculationAPI.asp` (JSON POST from checkout JS → server → TaxJar), `taxjar/60_autoPostTJ.asp`, `60_autoPostTJ.asp`, `taxjar/autoPostTJnav.asp`, `taxjarbackreporting.asp`. Hosts `api.taxjar.com` / `api.sandbox.taxjar.com`. Tables: `taxjarposts`, `taxjarsalestaxlogs`, `taxjarretry`, `taxjarnavrequests`, `taxjarnavrequestslines`, `marketplace_state_tax_facilitators`. **ACTIVE.** Git commit *"Remove TaxJar fall back to CP when TJ returns 0% rate"* — CandyPress's own tax tables are still the fallback. `60_autoPostTJ` = TaxJar back-reporting (also covers Walmart/Google marketplace sales).

### A5. Address Validation

- **SmartyStreets** — `_INCSmartyStreets.asp` → `us-street.api.smartystreets.com/street-address`, license `us-core-cloud`. Logs to `smarty_streets_log`. **ACTIVE**
- **Melissa Data Express Entry** — `Address/express.js`, `expressentry.melissadata.net` (in CSP). Type-ahead address autocomplete. **ACTIVE**

### A6. Email / Messaging

- **SendGrid** — the whole email stack.
  - Transactional v3 API: `_INCappEmail_.asp` L63 & L264 → `api.sendgrid.com/v3/mail/send`, dynamic templates by GUID.
  - CDOSYS SMTP fallback via `smtp.sendgrid.net:587` (`_INCappEmail_.asp` L416-423).
  - Campaign/reminder senders: `sendGridApiEL.asp` (reorder reminders + carrier tracking), `sendGridApiManual.asp`.
  - **Email validation**: `EmailValidator.asp` → `api.sendgrid.com/v3/validations/email`.
  - Logging: `sendgrid_logs` table. Dead code paths for CDONTS and `Bamboo.SMTP`.
- **Klaviyo** — dual mode. Client: `_INCscripts.asp` L196-231 (`klaviyo.js`, `klaviyo.identify`), forms in `TextOptinSocial.asp`. Server: `_INCupdStatus_.asp` L788-921 posts `Fulfillment` and `Cancellation` events to `a.klaviyo.com/api/events/`. Table `klaviyo_logs`. **ACTIVE**
- **Attentive (SMS)** — `_INCCheckoutFunctions_.asp` L662 `AttentiveSubscribe()` → `api.attentivemobile.com/1/add-subscribers`; creative trigger in `_INCfooter.asp` L22; `window.attentive_data` on PDP (`prodViewHv2.asp` L570). **ACTIVE**. `TextOptinSocial.asp` (175KB) is a text-opt-in landing mega-page, not the SMS transport.
- **Zaius / Optimizely Data Platform** — `_INCscripts.asp` L62, purchase event in `60_PayReturn.asp` L1032. **ACTIVE but likely orphaned.**
- **Monday.com** — support chat routes to a board email alias (`support-chat/submit-question.asp` L26), `forms.monday.com` iframed. **ACTIVE**
- Also in CSP but not in ASP source (tag-manager-injected): Omnisend, SmarterHQ, SafeOpt, Traverse, Voltn, Minty, wt.rqtrk.eu.

### A7. Subscriptions / Home Filter Club

- **OrderGroove** — the big one.
  - REST: `_INCsubscriptions_.asp` → `restapi.ordergroove.com/subscriptions/iu/`, `/items/iu/`, `/orders/`, `/subscriptions/` with `x-api-key` header (+ staging host).
  - Legacy: `sc.ordergroove.com` (subscription create), `api.ordergroove.com`, `static.ordergroove.com`, `om.ordergroove.com` widgets.
  - **Inbound order push**: `OrderInsertionAPI.asp` (55KB) — OrderGroove POSTs recurring-order **XML** here to create orders in the FiltersFast DB. `OrderInsertionAPIManual.asp` is the staff-triggered twin.
  - Price feed for OG: `ogPriceApi.asp`. SSO/auth hash: `ogMsiAuth.asp` (HMAC over `og_hash_key`). RC4 helpers: `_INCrc4_OG_.asp`, `get_ogRC4coded_info.asp`. JSON shims: `ordergrooveff/json.asp`, `json2.asp`, `JSON_funct.asp`.
  - Cookies: `_og_cart`, `og_autoship`, `og_cart_autoship`, `og_session_id`, `og_auth` (explicitly exempted from the HttpOnly rewrite rule in `web.config` L16).
  - Tables: `subscription`, `subscription_orders`, `ff_subscription_logs`, `ordergroove`.
  - **ACTIVE and deeply entangled.** Also a first-party subscription surface: `MyAutoDelivery.asp`, `auto-delivery.asp`, `start-subscription/`, `custReminders.asp`, `product_order_reminders`.
- **HomeFilterClub/** — a separate white-label funnel (`checkout1.asp`, `checkout2.asp`, `confirmation-club.asp`, `confirmation-onetime.asp`, `results.asp`, `filmoreScript.asp`) with its own ShareASale merchant ID.

### A8. Marketplaces & Order Ingestion (why an ASP site "creates Shopify orders")

- **Shopify** — `shpfyOrdersCreation4.asp` / `shpfyOrdersCreationManual.asp` are **inbound webhook receivers**, not outbound. They validate `HTTP_X-Shopify-Shop-Domain == "ace-pools.myshopify.com"` (L89) and convert the Shopify order into FiltersFast `carthead`/`cartrows` rows with `source = shopify`. Table `shpfywebhooks`. A sister Shopify storefront (Ace Pools) drops orders into this order system for fulfillment.
- **Walmart Marketplace** — `Config/wm_api.asp` (+ per-env copies). `marketplace.walmartapis.com/v2/orders/{po}/acknowledge`, `/shipping`, `/refund`. Signed XML. **ACTIVE**
- **Google Shopping Actions / Buy on Google** — `googleApi/googleOrdersFinal.asp`. Service-account JWT against `content/v2.1/{merchant}/orders`. Table `googleorders`. Likely **LEGACY** (Buy on Google shut down 2023) but code is intact.
- **Amazon** — only a CSV; no API. Manual.
- **Ameridial** — `ameridial_orders` table (outsourced call-center order entry).
- Admin views: `Manager/sa_marketplaces.asp`, `Manager/SA_marketplace_taxes.asp`.

### A9. Search

- **HawkSearch** (Bridgeline) — **current provider**. `search/default.asp` + `search/handlebars/hawksearch-handlebars-ui-7.0.1-dist-index.min.js`; tracking calls `trackPageLoad` (`prodViewHv2.asp` L910), `trackAddToCart` (`cart.asp` L801), `trackOrder` (`60_PayReturn.asp` L839). Hosts `essearchapi-na.hawksearch.com` (+ test hosts).
- **SLI Systems / Resultspage** — **the predecessor, still partially wired**. `sli-parse-page.asp`, `js/sli-rac.config.js`, `500.asp` L14, `gate.js` L36. **LEGACY residue.**
- **Internal search** — `search_products`, `tsearchparam` tables; `_INCSearchRedirects.asp` (87KB of keyword→URL redirects); `ssearch.asp`; feed generation `srchupload/searchgen.asp`, `Manager/searchgen.asp`, `Manager/searchgenSS1.asp` producing `categories.txt`, `categories_products.txt`, `keyword-url.txt`, `prodgen.txt`. `Manager/SA_searchlog.asp`.

### A10. Reviews & Q&A

- **Trustpilot** — the only review provider. `_INCproductreviews_.asp`: product reviews + imported reviews + summaries via `api.trustpilot.com/v1/product-reviews/business-units/{id}/...`; Q&A widget `widget.trustpilot.com/product-questions/loader.js`. `reviews.asp` page (2025). There is *also* a legacy internal `reviews` table + `Manager/SA_rev*.asp` CRUD — dual system.
- **Google Customer Reviews** — badge iframe + `gts-order` block in `60_PayReturn.asp` L1053+.

### A11. Secrets Management

`_INCFFSecurity_.asp` defines `GetKeyVaultSecret(name)` / `CheckKeyVaultAPIAuthentication()` hitting `https://www.filtersfast.com/kvmapi/api/Secret?name=…` with a static Bearer token — an in-house **Azure Key Vault proxy API** (admin UI at `Manager/sa_vault.asp`). Also a custom COM object `FFASPv1.HMAC256`. **This migration is half-done.** Most credentials are still hardcoded (see B5).

### A12. Analytics, Tag Managers, Advertising, A/B

All in `_INCscripts.asp`, `UserMods/_INCtemplate_adaptive.asp`, `_INCfooter.asp`, `60_PayReturn.asp`:

| Vendor | Where |
|---|---|
| Google Tag Manager (container id in `UserMods/_INCtemplate_adaptive.asp` L45, L127) | |
| Google Ads / gtag | same, L32-37 |
| GA4 via GTM `dataLayer` pushes (`view_item`, `add_payment_info`, `checkout_progress`) | `_INCscripts.asp` L90-115, `60_PayReturn.asp` |
| Meta/Facebook Pixel | `_INCscripts.asp` L6-34; Purchase in `60_PayReturn.asp` L1000 |
| Pinterest Tag | `_INCscripts.asp` L37-48 |
| Microsoft/Bing UET | `_INCscripts.asp` L257-289 (consent mgmt) |
| **Convert.com** (A/B testing) | `UserMods/_INCtemplate_adaptive.asp` L118 |
| Zaius/ODP | `_INCscripts.asp` L62 |
| **OpenAI commerce pixel** (`oaiq("measure","order_created",…)`, ChatGPT "Buy It" attribution) | `60_PayReturn.asp` L991-999 — newest integration in the codebase |
| AddShoppers / shop.pe | `60_PayReturn.asp` L1035-1050 |
| Microsoft Clarity | CSP only (GTM-injected) |
| ClickTale | dead refs in `/mobile` |
| Adobe Typekit `use.typekit.net/gvz2sfa.css` | `_INCheader.asp` |
| Level Access | `_INCfooter.asp` — accessibility |
| Cloudflare (`static.cloudflareinsights.com`, `ajax.cloudflare.com`) | CSP — **the site is already behind Cloudflare** |

**Consent management is hand-rolled** in `_INCscripts.asp` L250-335 (fans out to `dataLayer`, `uetq`, `fbq`). `web.config` L40 holds a ~10KB CSP that is the single best inventory of client-side vendors.

### A13. Affiliate / Partner

- **ShareASale** — pixel in `60_PayReturn.asp` L563 (main merchant) and HomeFilterClub confirmations (second merchant).
- **Awin** — `dwin1.com` script (`60_PayReturn.asp` L564).
- **LinkConnector** — referenced, likely legacy.
- Internal affiliate program: `aff/default.asp` (DB-driven landing pages from `affiliateRecords` / `affiliateProducts`), `Manager/SA_aff.asp`, `Manager/sa_affiliates.asp`, session `idAffiliate`/`commPerc`.
- Attribution: `_INCsource.asp` — UTM capture into `session("utmSource")` + `utmSource` cookie + `carthead.referralSource`; `global.asa` handles legacy `FFSource`.
- **Partner co-brand landing pages** (static ASP, no API): `2-10/`, `aaa/` (AAA member discounts, cookies `aaa_member_set`/`aaa_discount_rewards`), `american-home-shield/`, `HSA/`, `frontdoor/`, `w3/`, `b2b/`, plus charity pages `habitat-for-humanity/`, `wine-to-water/`, `xtreme-hike/`, `giveaway/`, `sweepstakes/`.
- **id.me** — `idme/default.asp` is only a landing page/banner; no live OAuth call found. `oauth.asp` is a generic token login against a local `OAuthRequests` table (passwordless), not id.me. Treat id.me as **not integrated**.

### A14. AI / Chat / Support

- **Google Gemini** — `_INCgeminiAPI_.asp`. **Used only by back-office pricing tooling**: `Manager/SA_gemini_query.asp` + `Manager/SA_gemini_models.asp`, logging to `gemini_pricing_log`. Not customer-facing.
- **Support chat** — `support-chat/default.asp`, `think.asp`, `submit-question.asp`, `record-response.asp`. `think.asp` is a **home-grown keyword/TF-scoring bot** over `support_articles`/`support_categories`/`support_categories_articles` — no LLM. Escalation emails to Monday.com + support mailbox. Logs to `support_bot_log`. Embedded as an iframe in `_INCscripts.asp` L133-194.
- **LivePerson / BoldChat** — ~36 refs, all in `/mobile` and old templates. **LEGACY.**

### A15. Misc

- **Currency** — `currencyUpdate.asp`, IP-restricted, updates a `currencyRates` table. Provider host not confirmed; read `cartMain()` in that file before rebuild. Related: `setLocale.asp`, `_INClocations_.asp`, `intCurrency`/`convRate`/`intCheckout` columns on `carthead`.
- **Filmore** — `filmoreResponse.asp` + `HomeFilterClub/filmoreScript.asp` / `fillmore.html` + `filmoreHead` table. An HVAC/filter **fitment quiz funnel** (zip → home profile → recommendation), internal.
- **Facebook catalog feed** — `fbItems/fbproducts.asp` generating `fbproducts.tsv`.
- **Bing Webmaster** — `BingSiteAuth.xml`, `LiveSearchSiteAuth.xml`.
- **Backorder notifications** — `bpn/BackorderNotificationRequest.asp`, `bpn/addFromBlog.asp`, `bpn/addFromEmail.asp`, `abandonedPendingOrders.asp`, `pendingEmail.asp`, `pendingCancel.asp`.
- **Model/fitment lookup** — `ModelLookup/`, `models/`, `modellookuphome.asp`, `refrigeratorFinderTool.asp`, `getpoolsizes.asp`, `listbysize2.asp` (a major product-discovery subsystem, all internal DB).

---

## PART B — Data Layer

### B1. Connection & Access Pattern

- **`Config/config.asp`** — single hardcoded ADO connection string (MSOLEDBSQL, staging DB server on the internal 172.24.x network, database `filtersfast`). Also sets `versionParm` (cache-buster), `storeID="filtersfast"`, `tablePrefix=""`, `dbType=1`.
- Per-environment overrides: `Config/filtersfast/config.asp` (prod), `Config/ffastest/config.asp` (staging, `www.ffastest.com`), plus `.bak2`/`.3` copies. `Config/filtersfast.pfx` — a private key committed to the repo.
- **`_INCappDBConn_.asp`** — classic ADO wrappers: `openDB()`, `closeDB()`, `openRSexecute(sql)`, `openRSopen(...)`, `closeRS(rs)`, `errorDB()`. **Zero parameterized queries.** Every statement is string concatenation guarded only by a `validSQL(value, "A"|"I"|"S")` escaping helper in `_INCappFunctions_.asp`.
- **No stored procedures.** One scalar UDF: `dbo.GetProductByGoogleOfferId`. Everything is inline SQL — ~386 distinct table identifiers across the codebase.
- `global.asa` — only `Session_OnStart`: `session.timeout=45`, source/`FFSource` cookie capture.
- **`SqlCheckInclude.asp`** — a naive blacklist WAF; rarely included.
- `JSON_funct.asp` / `json3.asp` / `ordergrooveff/json2.asp` — VBScript↔JScript JSON bridges. Newer code uses `Chilkat_9_5_0.JsonObject`.
- **COM dependencies** (none carry over): `MSXML2.ServerXMLHTTP`, `microsoft.XMLDOM`, `Chilkat_9_5_0.*`, `Scripting.Dictionary`, `Scripting.FileSystemObject`, `WScript.Network`, `CDO.Message`, `FFASPv1.HMAC256` (custom), `WinHttp.WinHttpRequest`.

### B2. Table Inventory

**Catalog / products**
| Table | Purpose | Key columns seen |
|---|---|---|
| `products` | Master product record (393 refs — the hottest table) | `idProduct`, `sku`, `description`, `pagename`, `price`, `weight`, `stock`, `ignoreStock`, `taxExempt`, `freeproduct`, `smallImageURL` |
| `categories` | Category tree | `idCategory`, `categoryDesc`, `pagname` |
| `categories_products` | Category↔product M:N | |
| `subcats` | Sub-category rollup | |
| `product_images`, `product_option_images`, `productdimensions`, `productspecs` | Media & attributes | |
| `options`, `optionsgroups`, `optionsxref`, `optionsgroupsxref`, `optionsprodex`, `optionsprices`, `productOptionInventory` | Variant/option matrix (size, count, pack) — **the most complex part of the catalog model** | `idOption`, `optionGroupId`, `idProdOpt` |
| `productgroups`, `productTypeXref`, `productTypeAttributeValue` | Product typing/faceting | |
| `relatedproductsxref` | Cross-sell | |
| `productCompSKUList` | Compatible/cross-reference SKUs (OEM ↔ aftermarket) | |
| `prodRedirect`, `catRedirect`, `redirectHub` | SEO 301s | |
| `productmanufacturers` | Brands | |
| `tProdUOM`, `tUnitName`, `actualSizes`, `custom_size_xref`, `custom_std_productID` | Sizing / custom-cut filters | |
| `product_price_changelog`, `tSourcePrice`, `tAltSourceProd`, `custom_cost`, `custom_sales_code` | Cost & pricing feeds | |

**Fitment / model lookup** (a distinguishing FiltersFast subsystem)
`refrigerator_finder`, `tFridgeModelLookup`, `tFridgeModelSearch`, `twaterfilterfinder`, `twaterfiltertype`, `twaterfiltersize`, `tHumidifierFinder`, `models`, `customer_models`, `ffsb_sku_xref`

**Customers / identity**
| Table | Purpose | Key columns |
|---|---|---|
| `customer` | Master customer | `idCust`, `email`, `password`, `status`, `newsletter`, `futuremail`, `remindIn`, `signinAttempts`, `changePwdOnLogin`, `guestAccount`, `secConvDt`, `isEmployee`, `isMilitary`, `paypalEnable`, `idEntry`, `generalComments` |
| `locations` | Address book (bill/ship) | |
| `wallet` | **Stored payment tokens** | `idWallet`, `idCust`, `token`, `last4`, `expMo`, `expYr`, `type`, `nickname`, `geoCode`, `isDefault`, `isValid`, `isEnabled`, `autoToken`, `dtCreated` |
| `customer_email_changes`, `customer_interaction_tokens`, `guest_password_requests`, `OAuthRequests` | Account lifecycle & tokens | `securityToken`, `tokenTimestamp` |
| `cp_admins`, `cp_roles`, `cp_role_permissions`, `cp_permissions`, `cp_failed_logins` | Back-office RBAC | |

**Orders**
| Table | Purpose | Key columns |
|---|---|---|
| `cartHead` | **Order header AND live cart** (same table — 277 reads / 219 updates) | `idOrder`, `idCust`, `orderStatus`, `name`, `lastName`, `email`, `phone`, `address`, `city`, `locState`, `locCountry`, `zip`, `subTotal`, `taxTotal`, `shipmentTotal`, `total`, `discCode`, `discPerc`, `discTotal`, `promoDiscCode`, `promoDiscAmt`, `paymentType`, `paymentTransactionCode`, `cardNumber`, `shipmentMethod`, `tracking`, `randomKey`, `guestCheckout`, `ogAutoship`, `ogAutoshipAmt`, `referralSource`, `utmCampaign`, `intCheckout`, `intCurrency`, `intConverted`, `convRate`, `thirdPartyOrderNumber`, `pendingEmailSent` |
| `cartRows` | Order lines | `idCartRow`, `idOrder`, `idProduct`, `sku`, `quantity`, `unitPrice`, `unitWeight`, `description`, `taxExempt`, `discAmt`, `shippingon` |
| `cartRowsOptions` | Per-line selected options | |
| `tCompleteOrders`, `merged_orders_tracking` | Completed/merged order tracking | |
| `returnHeader`, `returnRows`, `refundOrders`, `autorefunds`, `order_credits` | RMA & refunds | `idRma`, `rfAmount`, `originalTransID`, `refundTransID`, `complete`, `completeDate` |
| `ccauth`, `payAuth`, `payment_processing_logs`, `microform_logs`, `tMobilePayments`, `signifyd_response` | Payment audit | |
| `tShipHistory`, `tUspsHistory` | Shipment history | |
| `googleorders`, `shpfywebhooks`, `ameridial_orders` | Channel order ingestion | |
| `filmoreHead` | Filmore quiz funnel sessions | |

**Promotions / discounts**
`discOrder` (order-level), `discProd` (product-level, 117 refs), `tDiscCode`, `tReorderCode`, `partner_discounts`, `google_discount_log`, `deal`, `salescodes`. Runtime logic lives in `_INCDiscountsAndTotals.asp` (95KB) and `_INCAutomatedDiscounts.asp`.

**Shipping**
`shipMethod`, `shipRates`, `productShipping`, `upsHolidays`, `shipparms` (via `storeAdmin`)

**Subscriptions**
`subscription`, `subscription_orders`, `ff_subscription_logs`, `ordergroove`, `product_order_reminders`

**Content / support / config**
`storeAdmin` (⚠️ see below), `faq`, `support_articles`, `support_categories`, `support_categories_articles`, `support_faqs`, `support_bot_log`, `titles`, `news`, `mods`, `outputMicrodata`, `Country`, `States`, `currencyRates`, `marketplace_state_tax_facilitators`

**Logging** (all `INSERT`-only): `site_logging`, `useragent_logging`, `klaviyo_logs`, `sendgrid_logs`, `signifyd_logs`, `smarty_streets_log`, `microform_logs`, `taxjarsalestaxlogs`, `gemini_pricing_log`, `google_discount_log`, `product_price_changelog`, `ff_subscription_logs`, `support_bot_log`, `cp_failed_logins`, `elNotifications`, `backorder_notification`, `tosend`, `search_products`, `tSearchParam`

**⚠️ `storeAdmin` anti-pattern:** the entire store configuration is **one row**, a single `configValLong` text column containing **83 values joined by `*|*`**, split and positionally assigned in `_INCconfig_.asp` `loadConfig()` (L96-183). Any rebuild must decompose this into real config.

### B3. Session & Cookies

**Session** (in-proc ASP session, 45-min timeout, keys namespaced with `storeID`):
`idOrder` (cart id), `idCust`, `idOrderPaySubmit`, `idFil`, `shipArray`, `shipParms`, `idAffiliate`, `commPerc`, `salesPersonCode`/`salesPersonName`, `privateComments`, `adminID`/`adminRole`/`adminName`/`adminUserName`/`adminLoggedOn`.
Unprefixed: `source`, `sourceView`, `isAuthenticated`, `guestCheckout`, `newAccount`, `utmSource`/`utmCamp`, `ogIntegration`, `isFFEmployee`, `continentalUSCustomer`, `smartyStreetResults`, `ccNickname`, `supportGUID`, `lastGeneratedGUID`, `lastGeneratedEV-GUID`, `vc_oid`, and **dozens of promo flags** (`10offdeal`, `freegift5`, `fshipdeal`, `filterDisc5`, `radioDiscFree`, `facebook5`, `gwp`, …). In-proc session = no horizontal scaling.

**Cookies:** `FFSource`, `ffSourceView`, `utmSource`, `utmCamp`, `salesPersonCode`, `fid`, `oid`, `geoCFLoc`, `locState`, `language`, `favoriteModels`, `productAutoship`, `fshipWI`, `aaa_member_set`, `aaa_discount_rewards`, `contextDid`, `tkblp`, `ffupnh`, `ffucnh`, `welcomeMsgLocal`, `refreshRet`, `ffCheckTest`, `testViewFF`, `ffAirFilter`, plus OrderGroove's `_og_cart`, `og_autoship`, `og_cart_autoship`, `og_session_id`, `og_auth`. HttpOnly is force-added by an IIS outbound-rewrite rule in `web.config` L6-19, except cookies matching `og_auth.`.

### B4. Encryption / Hashing

| Module | Algorithm | Used for |
|---|---|---|
| `_INCrc4_.asp` | RC4 with a fixed key from `Config/config.asp`, hex-encoded | **Wallet tokens** (`custPayments.asp` L188) and **legacy customer passwords** |
| `_INCrc4_OG_.asp` | RC4 + Base64, keyed by `og_hash_key` | OrderGroove payload/SSO encoding; `get_ogRC4coded_info.asp` encrypts/decrypts raw card numbers |
| `_INCaes_.asp` | **AES-256 in ECB mode**, Chilkat, base64 | Newer sensitive-field encryption across checkout/support/tax pages |
| `_INCmd5_.asp` | MD5 | Legacy CandyPress hashing / 2Checkout MD5 |
| `SecureHash()` (in `_INCappFunctions_.asp`) | SHA-256 (unsalted, truncated) | **Current** customer passwords |
| `_INCFFSecurity_.asp` | HMAC-SHA256 via `FFASPv1.HMAC256` COM | CyberSource request signing, OrderGroove SSO |
| `_INCmicroform_.asp` | SHA-256 digest + HTTP Signature | CyberSource REST auth |

Password migration is in flight: `_INCloginBackend.asp` `AuthenticateUser()` tries the SHA-256 hash first, falls back to the RC4 hex hash, then calls `ConvertToSHA()` to upgrade the row and stamp `secConvDt`. **RC4-hashed passwords still exist in `customer`.** For v2: import both hash forms, verify with the legacy algorithm on first login, then re-hash with a modern KDF (Better Auth default) and drop the legacy hash.

### B5. Security Flags (locations only — rotate these before/at cutover)

1. `Config/config.asp` (and `Config/filtersfast/`, `Config/ffastest/` copies + `.bak2`/`.3` backups): plaintext SQL Server password, `rc4Key`, `og_hash_key`, and four sets of admin/staff usernames+passwords as VBScript constants.
2. `Config/filtersfast.pfx` — private-key certificate committed to the repo.
3. `FedEx/library/fedex-common.php` L97-104 — FedEx key, password, parent key/password, and account numbers.
4. `_INCppConstants_.asp` — PayPal API username, password, and signature.
5. `_INCappEmail_.asp` L422-423 — SendGrid SMTP username/password.
6. `EmailValidator.asp` L20, `sendGridApiEL.asp` L110, `sendGridApiManual.asp` L101 — SendGrid bearer tokens inline.
7. `_INCSmartyStreets.asp` L7-8 — SmartyStreets auth-id/auth-token, transmitted in the URL querystring.
8. `geoip.asp` L21 — MaxMind Basic-auth header inline.
9. `_INCproductreviews_.asp` L145/151/444/491 — Trustpilot API key repeated in querystrings.
10. `googleApi/*.json` — three Google service-account key files committed; `googleOrdersFinal.asp` L266 reads one by absolute path and an API key is inline at L334.
11. `_INCFFSecurity_.asp` L2 — the Key Vault API's own bearer token is hardcoded.
12. `_INCaes_.asp` L26 — Chilkat license string.
13. `50_mobilePayments.asp`, `60_PayXauthNetAIM-max2.asp` — live Authorize.net `x_login`; a test `x_tran_key` sits in comments.
14. `.htaccess` / `web.config` reference internal IPs and `devserver01`.
15. `get_ogRC4coded_info.asp` — a publicly-reachable HTML form that encrypts/decrypts credit card numbers with the OG key. No auth check visible. Critical.
16. `Manager/utilities_SQL.asp`, `utilities_DBwrite.asp`, `utilities_DBstruc*.asp` — arbitrary SQL execution through the admin UI.
17. `Manager/removeObscureCC.asp` — implies card data historically lived in `cartHead.cardNumber`.
18. SQL injection surface is broad: 386 tables reached exclusively via string-concatenated SQL.

---

## PART C — Admin / Back-Office / Ops

### `Manager/` — the admin app (166 files)
Same IIS site, same DB, same CandyPress lineage. Entry: `Manager/logon.asp` → `Manager/default.asp`.

**Auth model:** legacy constants in `Config/config.asp` *plus* a modern RBAC over `cp_admins`/`cp_roles`/`cp_role_permissions`/`cp_permissions`, enforced per page by `const adminLevel = N` + `GetAccessLevel("<FeatureName>")`. Failed attempts → `cp_failed_logins`.

**Functional areas:**
- Catalog: `SA_prod*`, `sa_prod_bulk`, `sa_prod_export`, `SA_cat*`, `SA_opt*`/`SA_optGrp*`, `SA_related_products`, `SA_CompSKUManager`, `SA_GetCompatibles`, `_INCproductManagement.asp`, `SA_SaveProductSnapshot`, `sa_image_management`, `SetOptionImage`, `upload*.asp`
- Orders/customers: `SA_order*`, `SA_order_credits`, `order_adjustment`, `SA_return`, `SA_cust*`, `sa_cust_merge(_preview)`, `sa_cust_lookup`, `sa_cust_models`, `sa_cust_paylogs`, `SA_idLookup`
- Payments: `SA_pay_processing`, `Manager/credits/client.asp`, `removeObscureCC`, `sa_vault`
- Shipping: `SA_ship*`, `SA_shipUPS/USPS/CP*`, `SA_shipMet*`, `SA_shipRate*`
- Marketing/content: `SA_disc*`, `SA_deal*`, `sa_salescodes`, `SA_news`, `SA_mods`, `SA_CatFAQManager`, `SA_ProdFAQManager`, `email.asp`/`email_exec.asp`, `edit_graphics`, `Edit_fund`, `Edit_donate_text`, CKEditor
- Reporting: `SA_stats`, `SA_stats_google`, `sa_daily_sales(_realtime)`, `SA_totalsales`, `SA_totalsubscription`, `sa_subscriptions`, `sa_discount_stat`, `sa_large_orders`, `top300`, `sa_purchaser_export`, `sa_marketplaces`, `SA_marketplace_taxes`, `sa_donation_dashboard`, `SA_searchlog`
- AI: `SA_gemini_query`, `SA_gemini_models`
- Danger zone: `utilities_SQL`, `utilities_DBwrite`, `utilities_DBstruc(Exec)`, `utilities_Config(Exec)`, `utilities_ServerVars`, `utilities_Email`, `utilities_Text(Exec)`

**No separate admin application.** The `/PaymentProcessor/` and `/kvmapi/` ASP.NET services are separate deployments not present in this repo.

### `automation/` — batch/scheduled jobs
`shipconfirm.asp`, `shipconfirm2.asp`, `shipconfirmG.asp`, `shipfedex.asp`, `shipUpCP.asp` — HTTP-triggered ship-confirmation endpoints (`?idorder=&tracking=`) that update `cartHead` and call `updOrderStatus`. Has its own private copies of `_INCappDBConn_.asp` and `_INCupdStatus_.asp` (drift risk).

**Other job-shaped pages** (driven by external Windows Task Scheduler on `devserver01`, see the server-migration notes: 78 enabled jobs): `60_autoPostTJ.asp`, `taxjar/60_autoPostTJ.asp`, `taxjarbackreporting.asp`, `60_autoRefundEBC.asp`, `sendGridApiEL.asp`, `abandonedPendingOrders.asp`, `pendingEmail.asp`, `pendingCancel.asp`, `currencyUpdate.asp` (IP-gated), `googleApi/googleOrdersFinal.asp`, `Config/wm_api.asp`, `fbItems/fbproducts.asp`, `srchupload/searchgen.asp`, `Manager/searchgen*.asp`, `sitemap.asp`. Several set `server.ScriptTimeout = 9600`.

### `UserMods/` — presentation layer
Page templates and localization only: `_INCtemplate_2.asp`, `_INCtemplate_adaptive.asp` (**the live one — carries GTM/gtag/Convert**), `_INCtemplate2_checkout.asp`, and the `_INCtemplate_xhtml*` / `_INCtemplate_xhtmlmobile*` families. Plus `_INClanguage_.asp` (all UI strings), `_INCmeta_.asp`, `_INCtitle_.asp`, `_INCtop_.asp`, `_INCfavicon_.asp`, `_INCffplpCard.asp`, `_INCffApplianceLanding.asp`, `_INCffPoolSpaLanding.asp`.

### `.github/` — CI status
**No CI.** Only `copilot-instructions.md`. Deployment is manual; git remote is an internal `https://devserver01/FiltersFast`.

### `app/` — stray files
Five untracked Next.js route handlers under `app/api/admin/email-campaigns/` importing a `lib/` that does not exist in this repo. They are a slice of the abandoned v1 rewrite (`filtersfast-next`, Desktop), not part of the legacy site. Ignore.

---

## Rebuild Risk Summary

| Risk | Detail |
|---|---|
| **Sunset shipping APIs** | UPS XML, USPS Web Tools, FedEx SOAP v14, Canada Post over plaintext HTTP — all four must be rewritten against current REST APIs regardless of platform choice |
| **`storeAdmin` blob config** | 83 positionally-indexed values in one delimited string |
| **`cartHead` dual-purpose** | Live cart and order header are the same row |
| **In-proc ASP Session** | ~60 session keys including cart identity, promo state, and admin identity |
| **OrderGroove entanglement** | Subscriptions touch checkout, pricing, cart cookies, an inbound XML order API, and RC4-encoded SSO |
| **Duplicate trees** | `/mobile/` is a full second storefront fork; `automation/` has forked DB and status includes; `60_` vs `65_ProcessPayment` |
| **Secrets sprawl** | Key Vault migration ~10% done; the rest is hardcoded across ~15 files (plus a `.pfx` and 3 GCP service-account JSONs in git) |
| **No CI, no tests, no parameterized SQL** | 386 tables, all via concatenated strings |
| **Undocumented external services** | `/PaymentProcessor/Tokenization.aspx` and `/kvmapi/api/*` are load-bearing and live outside this repo |

**Still to verify:** the currency-rate provider inside `currencyUpdate.asp`'s `cartMain()`.
