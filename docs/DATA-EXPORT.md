# Legacy Data Export Pack

I don't have access to the SQL Server database, so this folder gives you ready-to-run queries.
Run them against the **production** `filtersfast` database (or a recent restore) and drop the
output files into `packages/db/import/legacy/` (git-ignored). The import scripts in `packages/db/import/`
consume them and load D1.

The column names come from the ASP source, not from the live schema (see
`docs/legacy-inventory/04-legacy-schema.md`), so some will be wrong. **Run `00-schema.sql` first**
and send me its output (table and column list, no data). I will correct every other query against
the real schema in one pass, which beats fixing them one `Invalid column name` at a time. If you'd
rather push through, delete the offending column from the SELECT and note it in the file name,
e.g. `products.missing-MAP.tsv`.

## Status of the first export (September 10, 2026)

Received as `scripts/legacy-export/data export.xlsx` + `query 10.txt` (git-ignored). Loaded into the
dev database with `pnpm --filter @ff/db import:extract && pnpm --filter @ff/db import:local`.
Still needed:

1. ~~`tFridgeModelLookup` as a text file~~ Received (`tFridgeModelLookup.txt`, 1.85M rows, no header) and loaded: 317k models, 1.78M model→product links.
2. **Run the per-table queries in `scripts/legacy-export/rerun/`** (28 files, one table each, README
   inside). Save every result grid as `<table>.csv` into `packages/db/import/legacy/`. Tables:
   `04*` OptionsProdEx, OptionsPrices, productOptionInventory, product_option_images ·
   `06*` productTypeAttrXref, productTypeAttributeValue, prod_dim_codes, prod_dim_values,
   productDimensions, tUnitName, sale_restrictions · `07*` tsourceprice ·
   `09*` search_products, actualSizes, custom_size_xref, custom_std_productID (the size pages) ·
   `11*` faq, support_categories, support_articles, support_categories_articles, support_faqs,
   redirectHub, mods · `12*` upsHolidays, currencyRates, marketplace_state_tax_facilitators ·
   `13*` customer_models, product_order_reminders. A `MISSING TABLE` message means the name differs
   on the server; the script then lists similarly named tables.
3. **Re-run `01-products.sql` and `02-categories.sql`.** They now strip line breaks from text
   columns; 117 product rows in the first export were column-shifted by multi-line HTML and were
   skipped (ids are printed by `import:build`).

## How to run

Everything is in `scripts/legacy-export/`. Two options:

**Option A — one PowerShell script (recommended).** Uses `sqlcmd` or `bcp`, which ship with SQL
Server Management Studio. Edit the server/database at the top of the script; use a read-only login.

```powershell
cd "scripts\legacy-export"
.\Export-Legacy.ps1 -Server "YOUR_SERVER" -Database "filtersfast" -Out "..\..\packages\db\import\legacy"
```

**Option B — SSMS by hand.** Open each `.sql` file, run it, and use *Results → Save Results As… → CSV
(UTF-8)*. Name the file after the query (e.g. `01-products.sql` → `products.csv`).

Every query is a plain `SELECT` with no writes and no temp tables. Output is tab-delimited UTF-8
(`bcp -w`), which survives the HTML, quotes and commas in product copy; the importer accepts CSV too.

## What each export feeds

| File | Rows expected | Powers |
|---|---|---|
| `01-products.sql` | ~13k | PDP/PLP content, pricing, stock flags, pack sizes, meta tags, compare/replacement links, flags (Prop 65, Made in USA, HFC eligibility, class flags) |
| `02-categories.sql` | ~1k | Category tree (parent ids are **not** in the feed export I have), H1/HTML content, meta tags, hide/compare flags |
| `03-category-products.sql` | ~20k | Category membership |
| `04-options.sql` (4 result sets) | small | Option groups, options, group↔product, exclusions, per-option prices and inventory |
| `05-product-images.sql` | ~15k | Gallery images, videos, PDFs (`product_images` rows) |
| `06-product-specs.sql` | ~13k | Specifications table on PDP |
| `07-related.sql` (3 result sets) | | Related/also-bought, compatible SKU cross-references, product groups |
| `08-models.sql` (2 result sets) | ~85k | Appliance model → product mapping (the model pages), refrigerator finder steps |
| `09-finders.sql` | small | Water/humidifier finder tables, stock air-filter sizes, actual sizes, custom size cross-refs |
| `10-discounts.sql` (4 result sets) | small | Promo codes (`DiscOrder`), quantity tiers (`DiscProd`), single-use codes, affiliates |
| `11-content.sql` (5 result sets) | | FAQs, support articles/categories, legacy reviews, redirects, `storeAdmin` control row |
| `12-shipping.sql` | small | Ship methods, rate tables, locations (countries/states), holidays, currency rates |
| `13-customers.sql` | large | Customer profiles **with legacy password hashes** (needed for first-login migration) and saved addresses. No card data. |
| `14-orders.sql` (3 result sets) | large | Order history for "My Orders" (last 3 years by default; edit the date), lines, options, shipments |
| `15-wallet.sql` | | Saved payment **tokens** (gateway references only, never PANs). Optional; only if we keep CyberSource so tokens stay valid. |

Files 13–15 contain personal data. Transfer them privately (not via GitHub), and I will keep them
out of the repo.

## Images

Product images are served from `/ProdImages/` on the current web server, and the DB only stores
file names. Please also zip the `ProdImages` folder (including `ProdImages/PDF/`) and the
`/images/` marketing folder. They go to R2 with a one-off upload script. Until then the dev site
hot-links `https://www.filtersfast.com/ProdImages/...`.

## Things I could not find in the code and would like confirmed

- Whether `categories.txt` / `keyword-url.txt` are produced by a SQL Agent job (they are not
  generated by anything in the repo). If so, that job's query is the best source for model pages.
- The `tFridgeModelSearch` object: table or view? `08-models.sql` treats it as a view over
  `tFridgeModelLookup` and only exports the latter.
- Any tables behind the two ASP.NET sidecars (`/PaymentProcessor/`, `/kvmapi/`).
