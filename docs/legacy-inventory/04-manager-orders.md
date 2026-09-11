# Legacy Manager inventory — orders, customers, returns, credits

Survey of `FiltersFast/Manager` order and customer pages, September 11, 2026. Spec for the v2 `/manager`
parity build. See also `04-manager-content.md`, `04-manager-products.md`, `04-manager-admin.md`.

## 0. Cross-cutting

- Auth: `_INCsecurity_.asp` (internal IP gate → 403; session `adminLoggedOn`) then `_INCadmins.asp` `GetAccessLevel(name)` = -1 none / 0 view / 1 full / 2 restrictive. Login joins `cp_admins ⋈ custom_sales_code ⋈ cp_roles ⋈ cp_admin_permissions ⋈ cp_permissions`; password RC4+hex (reversible); failed logins logged in `cp_failed_logins`; reset links valid 24 h; last 5 passwords blocked via `cp_pwd_history`; admin mail via SendGrid `d-2f83b29e…`.
- Permission names on these pages: `Orders, Customers, Credits, CreditAPI, Returns, Statistics, Setup, Vault, TaxExemption, Impersonate, TokenizedCheckout, Subscriptions, InboundManager, BackorderNotifications, Products, Promotions, Locations`.
- `viewAccess` is effectively always 1 for logged-in admins (header bug).

## 1. SA_order.asp — order list
- Permission `Orders > -1`. Filters (form → query → cookie): `showStatus` (ANY, U, S, 0, 1, 2, 3, 4, 7, 9), `showField` (idorder, idcust, idreturn, PaypalTXID, thirdpartyordernumber, name, email, phone, address, customerCompany), `showCondition` EQUALS | LIKE (`'phrase%'`), `showPhrase` (≤50), `incOldOrders` (dead: compares the row to itself), state/country when field = address (buggy). `?clear-search=1` resets cookies.
- `TOP 250` from `carthead` [LEFT JOIN `returnheader` for idreturn], newest first. Phone search strips punctuation and also matches `shippingPhone`; name splits into first/last; address also matches shipping.
- Auto-jump: a posted `idcust` / `idorder` phrase opens the customer / order directly.
- Columns: `CP-<idOrder>` / `CID-<idCust>`, date, name + email, billing (+ shipping when different), phone(s), paymentType, total, status, Invoice | Details. Links to bulk modifications, FedEx paid orders, large orders.

## 2. SA_order_legacy.asp — older paged list
- 20/page, `TOP 200`; extra search fields (lastName, shippingAddress, sourcePriceFlag, googleAutoDiscount, promoDiscCode, amazonid, wmtCustOrderId, ebayUserId, ebayId, sku, description); sort idOrder desc/asc, lastName, paymentType; cookie `OrderSearch`. Default without phrase: last 3 days by paid date. Action: "Find and DELETE unfinalized orders older than 1/2/6/12/24 hours" (`action=delUord`).

## 3. SA_order_edit.asp — order workbench (`action=edit|view|inv`)
- Permission: page `Orders > -1`; card block `Orders = 1`; Transfer CID / Adjust `Orders = 1`; credit iframe + chargeback body `Credits = 1`; chargeback toggle `Locations = 1` (bug); subscription links `Impersonate > -1`.
- Loads the full `carthead` row (billing, shipping, payment (card decrypted), discounts, promo, Ordergroove flags, sales code, handling, AVS/CVV/risk, comments, tax rate, first `tshiphistory.track`), plus `signifyd_response` chargeback status.
- **Editable (`action=edit` POST):** orderStatus (U,S,0,1,2,7,9,3,4) + `orderStatusMail` (Y default) + `orderStatusStockAdj` (hidden N); cancel reason (1 buyer, 2 merchant, 3 duplicate/invalid, 4 fraud) + cancel date; private comments (`storeCommentsPriv`); public comments (readonly); tracking (hidden when ship history exists); email; billing name/lastName/address/city/zip/state/country/phone; shipping same set; company; shipmentMethod (free text); paymentType (AuthorizeNet=CyberSource, PayPal, 50_PayPalExpress, Amazon.com, Ebay, Sears, Walmart, MailIn, CallIn, FaxIn, COD, CreditCard, 2CheckOut, Custom, GooglePay, ApplePay); card type/number/exp/name; discPerc, discTotal; shipmentTotal; handlingFeeTotal; taxTotal; retailFee (when > 0); w3donation; adjustReason + adjustAmount.
- **Read-only panels:** status special cases (`O` offline pending auth; `9` cancelled is locked); payment processing logs (`payment_processing_logs`, CyberSource reason codes decoded via `cybersource_errors`, `VOID` → "Fraud Prevention Auto-Void"); Signifyd decisions (link to console); tracking table (`tshiphistory`, carrier link rules: FEDEX or 12-digit → FedEx, USPS, UPS, DHL, else Google); promo discount (codes link to the promotion; `$0` → "Did not qualify!"); sales person code (+ `ameridial_orders` name); Home Filter Club flag, buy-it-again flag, mobile/desktop funnel, referral source, IP, AVS/CVV/risk, foreign currency note; line items (`cartRows` + `cartRowsOptions`, line total = qty × (options + unit − disc), source-price flags, links to product editor and PDP); returns block (`returnheader` status 1 = label view with up to 5 USPS labels, 3 = money view: return amount, convenience fee, refund = retTotalAmt − retFeeAmt, complete + date; `returnrows` items with reason/refundOnly).
- **Actions:** Transfer CID (`merged_orders_tracking` insert + `carthead.idCust` update); Chargeback (Signifyd `/v3/orders/events/chargebacks`: case number, type CHARGEBACK|RETRIEVAL, amount ≤ total, fee, reason code + description (Credit not processed / Fraud / Item not received / Not as described / Not recognized / Other), dates → `signifyd_response.chargebackStatus`, `signifyd_logs`); Credit window iframe (`credits/client.asp`); Resend Tracking (status 2, template `d-b2c00c8b…`); Resend Cancellation (status 9, re-fires cancellation email + Klaviyo without DB change); Resend paid confirmation (status 1/2, template `d-11f9635b…`); Generate USPS return label (hard-coded call-center code); CyberSource transaction search; subscription opt-in modal (products with `AutoShipEnabled`, wallet with autoToken/default, frequency per product `recommendedFrequency`, posts to `/PaymentProcessor/Activate.aspx`); View Subscriptions / Login as customer (impersonation via `SA_cust_exec.asp?action=login|subscriptions`); nav to Edit Customer, Adjust Order, Send Email.
- `action=inv`: printable invoice, Free 3 of 9 barcode of the order id, no card data.

## 4. SA_order_exec.asp
- Permission `Orders ≥ 1`. Actions edit, deluord, resendtracking, resendcancellation, chargeback, resendemail.
- edit: cancel (9) requires reason; sets DateCancelled; numeric checks; **total = subTotal − discTotal + shipmentTotal + handlingFeeTotal + taxTotal + adjustAmount + w3donation + retailFee**; `Orders = 1` updates every field (card re-encrypted), otherwise only private comments; then `updOrderStatus(idOrder, status, mail, stockAdj)`.
- deluord: deletes `cartRowsOptions`, `cartRows`, `cartHead` for `orderStatus='U'` older than N hours (no transaction). Order delete/bulk delete are dead code.

## 5. `_INCupdStatus_.asp` — `updOrderStatus` side-effect engine
1. New status 2 (shipped) and changed: Signifyd fulfillment (once per shipment) + Klaviyo "Shipping Update".
2. No change and not a resend → no-op.
3. Append `"<date time>\nOrder Status : <desc>"` to public comments (+ private text); `UPDATE cartHead` status/comments.
4. TaxJar order post when status 1, or 9 from a paid state.
5. Stock adjustment (dormant: callers pass N): decrease moving into 1/2/7, increase moving out; low-stock warning email to admin when ≤ threshold.
6. Email when mail flag Y: status 7 → Completed/Delivery Confirmation template by carrier (`completedemail[fedex|DHL]`, SendGrid `a5a547fa…`); status 9 → `statusUpdateEmailCancel` ("Your order has been Cancelled - Order Number CP-<id>") + Klaviyo "Cancelled Order" + Signifyd cancellation when total > 150; status 2 and 1 → nothing (sent elsewhere); other statuses → `statusUpdateEmail[Fedex|DHL]` ("Order Number CP-<id>", tokens `#NAME# #STAT# #ORDER# #DATE# #TOTAL# #ITEMS# #SHIP# #STORE# #SALES# #CARRIER# #TRACKINGLINK# #TRACKING# #IDCUST#`).
- Klaviyo events POST `a.klaviyo.com/api/events/`, logged to `klaviyo_logs`; Signifyd calls logged to `signifyd_logs`.

## 6. SA_order_credits.asp — credit ledger
- Permission `Credits > -1`. Paged (10/25/50/100/250) over `order_credits`; search by idOrder or idCust.
- Columns: order/customer, method (idCredit), reason, date, user, note, status (`stsCredit` 1 success / 0 pending PayPal / else failed with response), currency + amount (USD $, CAD C$, EUR €, GBP £).
- Side effect: pending PayPal rows are polled (`Paypal_request_credit.php`) and updated on view.

## 7. order_adjustment.asp — refund calculator (read-only, no permission check)
- Reduce line quantities → recompute: subtotal = Σ(unit − disc + option) × qty; promo and Home Filter Club discounts as the original percentages; shipping; tax only if the order had tax (shipping untaxed in AL AZ CA CO ID IA LA ME MD MA MO NV OK UT VA WY; rate from order or `locations.locTax` or reverse-computed); handling; donation; retail fee. Refund = max(0, original − new); all lines zero → full refund.

## 8. SA_return.asp — refund queue
- Permission `Returns > -1` (complete actions `= 1`). Tabs: Actionable (`returnheader.returnstatus = 3 AND refundComplete = 0` and not pending automation), Completed (top 100), Pending automated refund-only (`autorefunds.refundComplete = 0`).
- Row: return id, order, customer, payment type, name, PayPal TXID (parsed from private comments), sales person, **refund = retTotalAmt − retFeeAmt**, tax `retTax`, discount, date, IP, items (sku, option, qty, reason, unit price), comment, automation error. Links to CyberSource (by `authTransid`) / PayPal transaction.
- Actions: Complete one (`refundComplete = 1, refundDate = now`), Bulk complete, Cancel automated refund (`autorefunds.refundComplete = 9`).

## 9. SA_pay_processing.asp — last 100 gateway log rows (`Statistics > -1`).
## 10. removeObscureCC.asp — one-off PAN scrubbing script (`Setup = 1`), runs on GET.
## 11. sa_vault.asp — Azure Key Vault secret metadata (`Vault > -1`), read-only.

## 12. SA_cust.asp — customer list
- Permission `Customers > -1`. Filters: field (idcust, email, name, phone, customerCompany, address) + EQUALS/LIKE + phrase (≥3 chars) + status (A/I) + state/country for address; `TOP 50`. Posting an idcust opens the customer. Columns: id, "Last, First", email, billing + shipping, phone(s), created, status, edit.

## 13. SA_cust_edit.asp — customer detail (`action=edit|del|unlock`)
- Permission: page `Customers > -1`; status select `Customers = 1`; tax-exempt controls `TaxExemption = 1`; impersonation links `Impersonate > -1`.
- Shows: status, created, order count, guest-account note, sign-in attempts (Unlock link when ≥ 5 → `signinAttempts = 0`).
- Editable (`customer`): email (readonly + PrevEmail), taxExempt (Y/N) + expiration date, futureMail "Reminders" (Y/N), remindin (months), name, lastName, phone, address, city, zip, locState (from `locations`), locState2 (free text), locCountry, shipping name/lastName/phone/address/city/zip/state/state2/country, customerCompany, paymentType (MailIn, CallIn, FaxIn, COD, CreditCard, PayPal, 50_PayPalExpress, Venmo, VenmoExpress, 2CheckOut, AuthorizeNet, Custom, GooglePay, ApplePay), generalComments (append-only note: `<admin> (<date>): text`), status.
- Actions: status-only update; edit; delete (refused when orders exist); password reset (posts to storefront logon with `empCustID`); nav: Email, Email History, Payment Logs, Appliance Profile, Account Merge, Login as customer, View Subscriptions.

## 14. SA_cust_exec.asp
- Entry if `Customers = 1` or `TaxExemption = 1` or (`Impersonate > 0` and login) or `Customers = 2`.
- login / models / subscriptions: impersonation handoff to the storefront (`custListOrders.asp?act=empLogin&cLogin=<id>&goto=…`), with `CanUseTokenizedPayments = TokenizedCheckout > 0`.
- edit: required email, name, lastName, address, city, zip, country; email change blocked when another active account owns it (and *should* disable wallet tokens — never executed); `Customers = 1` may change status; `TaxExemption = 1` may change tax exemption; `Customers = 2` may only add comments; email change triggers `CustomerAPI(old, new, id)` sync.
- del: transactionally deletes the customer when no orders.

## 15. SA_cust_legacy.asp — older list (25/page, TOP 100, affiliate filter Y/N/A, sort lastName/email/dateCreated).

## 16–18. Account merge
- `SA_cust_merge.asp?recID=` (`Customers = 1`): merge by customer ids or by order ids (one per line), optional "mark source inactive" (default on), Preview (`sa_cust_merge_preview.asp`: lists the orders to move with a red warning when any has Home Filter Club/Ordergroove), Email lookup (`sa_cust_lookup.asp?email=` → ids with that email). Execution per order: insert `merged_orders_tracking (idCustTo, idCustFrom, idOrder, idAdmin)`, `UPDATE carthead SET idCust = target`, optionally `UPDATE customer SET status='I'` on the source; target set to `A`.

## 19. sa_cust_models.asp — appliance profile (`customer_models ⋈ tFridgeModelLookup`: model link, date added; Manage = impersonate).
## 20. sa_cust_paylogs.asp — customer payment logs (`payment_processing_logs` by the customer's orders or `CID-` tokenization events).
## 21. sa_cust_emails.asp — SendGrid delivered/undelivered events for the email (template name, event, message id, timestamp; bounce = red).

## 22. SA_backorder_notifications.asp (`BackorderNotifications > -1`)
- Open `backorder_notification` requests (last year, `reminderCompleted = 0`) grouped by product + option with request count; **Ready = stock > 0 OR ignoreStock**; shows stock, actualInventory, ignoreStock, blockedReason, poprank; links to product / option editors. Read-only (an external processor sends the notices).

## 23. sa_subscriptions.asp (`Subscriptions > -1`)
- Subscription orders = `carthead.ogAutoship IS NULL`. Date range (default last 7 days). Summary: per day × CyberSource reason code (100 = success, green): count and dollars, Chart.js line chart + table with Details link. Detail: order, customer, subscription id (from private comments), date, status, reason code, total. Read-only; management is by impersonation into the Ordergroove pages.

## 24. SA_inboundmgmt.asp (`InboundManager = 1`)
- Five `storeAdmin` toggles (-1 enabled / 0 disabled): `EnablePhone`, `PhoneHighVolume`, `EnableChat`, `WeatherAlert`, `TechDifficultiesAlert`.

## 25. sa_large_orders.asp (`Orders > -1`)
- Paid/shipped/complete card or PayPal orders with total ≥ N (default 600) since a date (default 7 days ago): order, customer, email, phone, paid date, status, total.

## 26–27. email.asp / email_exec.asp (`Customers ≥ 1`)
- Ad-hoc email: from (sales or admin address), to, subject, body (default "TO : name / RE : subject"), HTML flag, copy-to-sender (default on). No logging.

## 28. sa_purchaser_export.asp (`Products > -1` and `Promotions > -1`)
- SKUs (comma list), timeframe (all / last 4 years / last year / last month — all dead filters), statuses (1, 2, 7, S checked; U, 0, 9). Distinct purchasers (`cartrows ⋈ carthead`, card/PayPal payment types, excluding `@filtersfast` emails): Customer ID, first, last, email, SKU; client-side CSV download named `export_<sku>_results_<date>.csv`.

## 29. credits/client.asp — Credit API iframe (`CreditAPI = 1`)
- Eligible orders: status 1, 2, 7, 9. Modes: token (customer `wallet` rows enabled+valid → radio per token), card (number, exp, CVV, billing), PayPal payout (email or phone, subject "Credit from FiltersFast", body). Fields: amount, currency (USD, CAD, EUR, GBP, AUD), reason code, note, user. Guards: confirm when amount exceeds total − applied credits, confirm when equal to the last credit. Posts to `/Manager/CreditProcessor/Credit.aspx` (CyberSource refund / PayPal payout). Shows existing credits and totals.
- Reason codes: BAGDAMAGE, CHARGEBACK, CODB, CS ERROR, CUSTERR01–15, DAMAGED, DEFECTIVE, INCPAIR, LOST, MGREXC, NODISCOUNT, NOTCOMP, OTDERR01–04, OVERSTOCK, PKGINITNS, PUR ERROR, RESTOCK, RET-NOSET, UNDELIVER1–7, VENDERR, VENDRESHIP, WAR ERROR1–6, WEB ERROR, WEB1, WEB2, WEB3.

## Appendix A — tables
`cartHead` (full order row incl. billing/shipping, card RC4+hex, discounts, promo, ogAutoship, adjustments, comments, status, cancel reason/date, AVS/CVV/risk, referral, sales code, third-party number), `cartRows`, `cartRowsOptions`, `customer` (status, dates, names, company, phones, addresses incl. state2, paymentType, futureMail, newsletter, remindin, taxExempt(+expiration), affiliate, commPerc, generalComments, guestAccount, signinAttempts), `products` (stock, actualInventory, IgnoreStock, blockedReason, poprank, recommendedFrequency, AutoShipEnabled), `returnheader`, `returnrows`, `autorefunds`, `order_credits`, `order_credit_users`, `wallet`, `payment_processing_logs`, `cybersource_errors`, `signifyd_response`, `signifyd_logs`, `klaviyo_logs`, `tshiphistory`, `merged_orders_tracking`, `backorder_notification`, `customer_models`, `locations`, `States`, `storeAdmin`, `DiscOrder`, `ameridial_orders`, `sgDeliveredEvents`/`sgUndeliveredEvents`, `cp_*` admin tables.

## Appendix B — order status codes
| Code | Label | Behaviour |
|---|---|---|
| U | Unfinalized | cart only; purgeable |
| S | Saved | saved cart / quote |
| 0 | Pending | checkout submitted, payment unconfirmed |
| 1 | Paid | captured; TaxJar posted; creditable |
| 2 | Shipped | Signifyd fulfillment + Klaviyo shipping update; tracking email via resend |
| 3 | Invoiced | generic status email |
| 4 | Back Ordered | generic status email |
| 7 | Complete | delivery confirmation email |
| 9 | Cancelled | reason required; cancellation email + Klaviyo; Signifyd cancel when total > 150; locked |
| O | Offline pending auth | display only |
Cancel reasons: 1 buyer, 2 merchant, 3 duplicate/invalid, 4 fraud. Customer status A/I; affiliate Y/N/A. Credit status 1/0/PP_3/other. Return status 1 label, 3 refund actionable. Auto-refund 0 pending, 1/2 handled, 9 cancelled.

## Appendix C — email templates
SendGrid: 1 order confirmation `d-11f9635bc7e94ca28709ffec5e3aaaff`; 2 shipment tracking `d-b2c00c8ba8724b5d99fb48367ddf77d5`; 4 W3 donation thanks `b36399cf-…`; 7 delivery confirmation `a5a547fa-…`; 49 password reset `d-248d7bad…`; 50 password updated `d-965edd69…`; 99 backorder notice `d-61d01e07…` (obsolete); 100 generic wrapper `d-0013a4b8…`; admin account mail `d-2f83b29e…`. Legacy `storeAdmin` bodies: `statusUpdateEmail[Fedex|DHL|Cancel]`, `completedemail[fedex|DHL]`, `statusPaidEmailResend`; low-stock warning to admin.

## Appendix D — gaps to fix rather than port
No NAV export flags exist in the ASP tree; dead date filters; wallet-disable on email change never executes; credit ledger mutates on view; permission mismatches (chargeback toggle `Locations`, adjustment page unguarded, payment logs under `Statistics`); Complete-email carrier branch never fires; stock adjustment disabled; hard-coded vendor secrets; reversible RC4 card/password storage; pervasive SQL concatenation.
