# Re-run pack, round 2 (September 11, 2026)

The first re-run (`data-export-rerun.xlsx`) returned OptionsProdEx, OptionsPrices, productTypeAttrXref,
productTypeAttributeValue, search_products, custom_size_xref, custom_std_productID and mods. Everything
else reported `MISSING TABLE` because those tables live in the **`filtersfast` schema**, not `dbo`.
These files query `filtersfast.<table>` (falling back to `dbo`).

Run each one in SSMS, save the grid as `<table>.csv` (or tab-delimited `.txt`) into
`packages/db/import/legacy/`, or collect them into one workbook with one sheet per query as before.

| File | Table | What it feeds |
|---|---|---|
| `04c-productOptionInventory.sql` | productOptionInventory | Per-product option stock and availability flags. |
| `04d-product_option_images.sql` | product_option_images | Image per product+option (swatches). |
| `06c-prod_dim_codes.sql` | prod_dim_codes | Dimension code list (all columns). |
| `06d-prod_dim_values.sql` | prod_dim_values | Dimension values (all columns). |
| `06e-productDimensions.sql` | productDimensions | Product to dimension value links. |
| `06f-tUnitName.sql` | tUnitName | Pack-size unit names (each, 2-pack, case...). |
| `06g-sale_restrictions.sql` | sale_restrictions | State/country sales restrictions per product. |
| `07a-tsourceprice.sql` | tsourceprice | Channel-specific pricing (Google Shopping, marketplaces). |
| `09b-actualSizes.sql` | actualSizes | Nominal vs actual filter dimensions per product. |
| `11a-faq.sql` | faq | Site, product and category FAQs (answers flattened to one line). |
| `11b-support_categories.sql` | support_categories | Support center categories. |
| `11c-support_articles.sql` | support_articles | Support center articles (content flattened to one line). |
| `11d-support_categories_articles.sql` | support_categories_articles | Support category <-> article links. |
| `11e-support_faqs.sql` | support_faqs | Articles promoted as FAQs. |
| `11f-redirectHub.sql` | redirectHub | Keyword redirects (all types). |
| `12a-upsHolidays.sql` | upsHolidays | Carrier holidays used for delivery estimates. |
| `12b-currencyRates.sql` | currencyRates | Currency conversion rates (currencyUpdate.asp). Not run yet. |
| `12c-marketplace_state_tax_facilitators.sql` | marketplace_state_tax_facilitators | States where marketplaces collect tax. Not run yet. |
| `13a-customer_models.sql` | customer_models | Saved appliances per customer. Not run yet. |
| `13b-product_order_reminders.sql` | product_order_reminders | Active filter-change reminders per customer. Not run yet. |
