# Manager parity plan

Goal: one-to-one functionality with the legacy `/Manager` back office (CandyPress fork), rebuilt on
v2 (`/manager`, Astro + D1). The legacy surface is documented page by page in
`docs/legacy-inventory/04-manager-*.md` (content, orders, products, admin). This file tracks what
maps where and what is done. Started September 11, 2026.

## Conventions for the rebuild

- **Permissions** keep the legacy area names and levels (-1 none, 0 read-only, 1 full, 2 restricted).
  Roles (`admin_roles`) carry defaults, `admins.permissions` overrides per account, an account with no
  role and no overrides is a Site Administrator. Middleware gates every `/manager/*` path for read
  (`PAGE_AREAS` in `src/lib/manager/permissions.ts`); every action calls `requireArea(ctx, area, 1)`.
- **No GET mutations, no raw SQL, no reversible ciphers.** Everything posts to an Astro Action.
- **Money in cents, dates ISO.** Legacy sentinels kept where the storefront depends on them
  (stock -250 discontinued, -150 special order; ids 2278/2279 exempt from parent price propagation).
- Legacy defects listed in the inventories are fixed, not ported (see each inventory's last appendix).

## Page map

| Legacy | v2 | Status |
|---|---|---|
| logon, sa_welcome, sa_update_admin_password, default | `/manager/login`, `/manager/account` (permissions matrix, 90-day rotation, last-5 history), `/manager` | Done |
| sa_admins, sa_admin_edit, sa_admin_logins | `/manager/admins`, `/manager/admins/{id}` (role, sales code, overrides, reset, deactivate), `/manager/admins/failed-logins` | Done |
| sa_admin_roles, sa_admin_role_edit | `/manager/roles`, `/manager/roles/{id}` | Done |
| sa_salescodes | `/manager/sales-codes` | Done |
| SA_prod (list), SA_prod_edit + _INCproductManagement, SA_prod_exec | `/manager/products`, `/manager/products/{id}` (tabs: general, content, specs, images, categories, options, tiers, compatibility, SxS, FAQ, restrictions, history) | In progress |
| sa_prod_bulk | `/manager/products/bulk` (find/replace, image, parent; preview then apply, no raw SQL) | Planned |
| sa_prod_export, sa_purchaser_export | `/manager/products/export`, `/manager/reports/purchasers` | Planned |
| SA_related_products | `/manager/related-products` | Planned |
| SA_GetCompatibles, SA_CompSKUManager, SendModelRequest | inside the product editor (compatibility tab) + `/manager/models` | Planned |
| SA_SxSExport | `/manager/sxs-export` (18-column CSV, on-screen table, email) + storefront `/compare/{oem}` page | Planned |
| sa_listbysize | `/manager/sizes` | Planned |
| top300, SA_stats, SA_stats_google, SA_totalsales, SA_totalsubscription, sa_daily_sales, sa_marketplaces, sa_donation_dashboard, sa_discount_stat, SA_searchlog, sa_large_orders, SA_pay_processing | `/manager/reports/*`, `/manager/search-log` | Planned |
| SA_cat, SA_cat_edit, SA_cat_exec, UpdateCategoryProducts, SA_GetCatFAQs | `/manager/categories`, `/manager/categories/{id}` (fields, products, FAQs) | Planned |
| SA_GetProdFAQs, SA_*FAQManager | `/manager/faqs` + product/category editors | Planned |
| SA_opt*, SA_optGrp*, SetOptionImage | `/manager/options`, `/manager/options/groups/{id}`, `/manager/options/{id}` | Planned |
| sa_image_management, upload, FileManager | `/manager/images` (R2 folders: products, categories, options, brands, content) + `/images/*` route | Planned (storage done) |
| SA_redirects + search keyword redirects | `/manager/redirects` | Planned |
| SA_rev* | `/manager/reviews` | Planned |
| sa_support | `/manager/support` (categories, articles, FAQ flag) | Planned |
| SA_mods, SA_inboundmgmt | `/manager/features` (site_settings `features`) | Planned |
| utilities_Config, utilities_Text, SA_ship*, SA_loc*, SA_marketplace_taxes | `/manager/settings`, `/manager/emails` (templates), `/manager/shipping`, `/manager/locations` | Planned |
| SA_prod_discounts, SA_disc*, SA_deal* | `/manager/promotions`, `/manager/promotions/{id}` | Planned |
| sa_affiliates, SA_aff | `/manager/affiliates` | Planned |
| SA_news* | `/manager/newsletters` (segment, preview, CSV, batched send) | Planned |
| SA_order*, order_adjustment, SA_return, SA_order_credits, credits/client, email | `/manager/orders/{number}` (edit, cancel with reason, notes, credits/refunds via provider, adjustment calculator, returns), `/manager/returns`, `/manager/credits` | Planned |
| SA_cust*, sa_cust_merge*, sa_cust_models, sa_cust_paylogs, sa_cust_emails | `/manager/customers/{id}` (edit, notes, status, tax exempt, merge, appliances, email history) | Planned |
| SA_backorder_notifications | `/manager/backorders` | Planned |
| sa_subscriptions | `/manager/subscriptions` | Planned |
| sa_vault, utilities_DBstruc/DBwrite/Email/ServerVars/SQL | `/manager/settings` health panel (bindings, providers, email test) | Planned |
| edit_graphics, Edit_fund, Edit_donate_text, theme | `/manager/settings` (scheduled graphics + donate text as settings); theme via prefers-color-scheme | Planned |
| searchgen*, feed generators | Cron-generated feeds to R2 (architecture doc §4a) | Later |
| SA_gemini_* | Not ported (hard-coded key; revisit as an AI pricing helper behind a secret) | Deferred |
