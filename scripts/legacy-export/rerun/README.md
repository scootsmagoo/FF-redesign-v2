# Re-run pack: tables missing from the first export (September 10, 2026)

One file per table so each can be run on its own in SSMS and saved with *Results → Save Results As…*
Name the saved file after the table (`search_products.csv`, `actualSizes.csv`, …) and drop it in
`packages/db/import/legacy/`. Tab-delimited UTF-8 or CSV both work.

Every query is a plain read-only `SELECT`. If a table does not exist under this name the script prints
`MISSING TABLE: …` and lists similarly named tables so the query can be corrected.

For the air-filter size pages (`/air-filters/size/20x25x1`) only the four `09*` files matter.

| File | Table | What it feeds |
|---|---|---|
| `04a-OptionsProdEx.sql` | OptionsProdEx | Per-product option exclusions (option hidden for this product). |
| `04b-OptionsPrices.sql` | OptionsPrices | Per-product option price overrides. |
| `04c-productOptionInventory.sql` | productOptionInventory | Per-product option stock and availability flags. |
| `04d-product_option_images.sql` | product_option_images | Image per product+option (swatches). |
| `06a-productTypeAttrXref.sql` | productTypeAttrXref | Which attributes apply to a product type. |
| `06b-productTypeAttributeValue.sql` | productTypeAttributeValue | Attribute values per product (spec sheet data). |
| `06c-prod_dim_codes.sql` | prod_dim_codes | Dimension code list (all columns). |
| `06d-prod_dim_values.sql` | prod_dim_values | Dimension values (all columns). |
| `06e-productDimensions.sql` | productDimensions | Product to dimension value links. |
| `06f-tUnitName.sql` | tUnitName | Pack-size unit names (each, 2-pack, case...). |
| `06g-sale_restrictions.sql` | sale_restrictions | State/country sales restrictions per product. |
| `07a-tsourceprice.sql` | tsourceprice | Channel-specific pricing (Google Shopping, marketplaces). |
| `09a-search_products.sql` | search_products | Air-filter size -> product/option matrix behind listbysize2.asp. Needed for /air-filters/size pages. |
| `09b-actualSizes.sql` | actualSizes | Nominal vs actual filter dimensions per product. |
| `09c-custom_size_xref.sql` | custom_size_xref | Custom air filter option SKU -> actual size. |
| `09d-custom_std_productID.sql` | custom_std_productID | Standard product -> custom-filter product mapping. |
| `11a-faq.sql` | faq | Site, product and category FAQs. Line breaks in answers are flattened so rows stay on one line. |
| `11b-support_categories.sql` | support_categories | Support center categories. |
| `11c-support_articles.sql` | support_articles | Support center articles (content flattened to one line). |
| `11d-support_categories_articles.sql` | support_categories_articles | Support category <-> article links. |
| `11e-support_faqs.sql` | support_faqs | Articles promoted as FAQs. |
| `11f-redirectHub.sql` | redirectHub | Keyword redirects (all types; the model-only subset was already exported as redirectHub_models). |
| `11g-mods.sql` | mods | Site modules/config flags (all columns). |
| `12a-upsHolidays.sql` | upsHolidays | Carrier holidays used for delivery estimates. |
| `12b-currencyRates.sql` | currencyRates | Currency conversion rates (currencyUpdate.asp). |
| `12c-marketplace_state_tax_facilitators.sql` | marketplace_state_tax_facilitators | States where marketplaces collect tax (all columns). |
| `13a-customer_models.sql` | customer_models | Saved appliances per customer ("Appliance Profile"). |
| `13b-product_order_reminders.sql` | product_order_reminders | Active filter-change reminders per customer. |

Not in this folder, but also worth re-running from the main pack for cleaner data: `01-products.sql`
and `02-categories.sql` (they now flatten line breaks; 117 product rows were column-shifted in the
first export).
