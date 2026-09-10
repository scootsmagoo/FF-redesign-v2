# Roadmap and Working Notes

The single place to look for "what's next". Update it whenever a slice lands or a decision changes.
Last updated: September 10, 2026.

## Status

Live on staging: https://filtersfast-storefront.adam-021.workers.dev

| Area | State |
|---|---|
| Catalog pages (home, category, product, model, search, 404) | Done, seeded from legacy feed exports (12.8k products, 1k categories, 43k models) |
| Legacy URL redirects (`.asp`, `/mobile/*`, aliases) and search short-circuits (SKU, size, model) | Done (pattern rules in `@ff/domain/urls`; DB redirect table not yet populated) |
| Cart (session + D1, Subscribe + Save, free-shipping threshold) | Done |
| Checkout (addresses → shipping → review/donation → payment → confirmation) | Done on stub providers |
| Provider interfaces (payment, tax, shipping, email, address) | Done, stubs only |
| Cloudflare: Worker, D1, KV, R2 provisioned; deploy script | Done |
| Tests | 30 unit tests (`pnpm test`), `astro check` clean |

## Backlog, in priority order

Work top-down. Each item is meant to be one commit-sized slice.

### P1 — needed before the site is usable by a customer
1. **Product options on the PDP** (size / pack / MERV selects) with per-option price and stock. Schema exists (`option_groups`, `options`, `product_options`); data arrives from export file 04. Until then, build the UI against a small hand-made fixture.
2. **Pack-size and quantity-tier pricing display** ("Buy 3–5 for $X ea", per-each price for multi-packs). Domain helpers exist in `pricing.ts`; wire `quantity_tiers` into PDP and cart.
3. **Promo codes**: port the `DiscOrder` rule taxonomy (inventory 01 §6) into `@ff/domain/promotions.ts` with tests, a `promotions` table, cart/checkout code entry, `/promo/{CODE}` landing. Stackability, single-use, free-shipping codes, GWP/BOGO last.
4. **Accounts**: Better Auth on D1 (email/password, Google, Facebook), legacy-hash verification on first login, `/account` with orders, addresses, appliances, subscriptions link. Guest order tracking at `/track-order` (number + email).
5. **Real category tree and mega-menu**: parent ids come from export 02; then header flyouts from data, breadcrumbs with full ancestry, sub-category tiles.
6. **XML sitemaps** (products, categories, models, index) and `robots.txt` finalisation.

### P2 — parity with the legacy site
7. Model pages with product mapping (export 08), compatible-SKU cross refs (07), product specs and images gallery (05/06), related/also-bought.
8. Refrigerator finder (brand → style → location → removal), air-filter size landing (`/air-filters/size/{key}`), custom air filter builder (SKU grammar in inventory 01 §3).
9. Reviews: import legacy `reviews` and render; Trustpilot sync behind a `ReviewsProvider` once a key exists.
10. Static/legal pages, Home Filter Club marketing page, charity pages, partner landing pages (AAA, ID.me, Frontdoor…), business services form.
11. Email templates (order confirmation, shipping, password reset) via the email provider; SendGrid implementation.
12. Images to R2 + Cloudflare Images (needs the `ProdImages` zip); replace hot-links.
13. Inbound endpoints (architecture doc §4a): Ordergroove order insertion, Shopify webhook, WMS ship-confirm, price feed.

### P3 — vendors (each blocked on credentials)
14. CyberSource Microform payment provider; PayPal; Apple/Google Pay.
15. TaxJar provider. 16. UPS / USPS / FedEx REST rate providers. 17. SmartyStreets validator + Melissa autocomplete.
18. HawkSearch search provider (server-side results) replacing the LIKE fallback. 19. Klaviyo/Attentive events. 20. Signifyd.

### P4 — launch
21. Playwright e2e suite on staging; GitHub Actions CI (test, check, deploy on main).
22. Cloudflare Access on staging; custom hostname; Workers Paid plan; observability alerts.
23. Redirect table populated from `prodRedirect` / `catRedirect` / `redirectHub` / keyword list; 301 audit against the legacy sitemap.
24. Cutover checklist: DNS, Apple Pay domain verification, Typekit domain, secrets rotation (inventory 02 §B5).

## Blocked on Adam

- SQL export pack (`docs/DATA-EXPORT.md`) → unblocks P1 #1, #5 and most of P2.
- `ProdImages` + `images` folder zips → P2 #12.
- Vendor API keys → P3. Workers Paid plan before importing customers/orders (D1 free tier is 500 MB).
- Open questions Q5, Q9, Q11, Q12, Q13, Q17, Q18, Q19 in `docs/QUESTIONS.md`.

## Conventions

- Money is integer cents everywhere. Legacy IDs are reused as primary keys.
- Business rules live in `packages/domain` as pure functions with tests; I/O lives in `apps/storefront/src/lib`.
- Every vendor sits behind an interface in `packages/integrations` with a stub; providers are chosen by `*_PROVIDER` vars in `wrangler.jsonc` (secrets go in Wrangler secrets / `.dev.vars`, never in the repo).
- Pages are server-rendered Astro; forms post to Astro Actions and work without JavaScript. React islands are added only where interaction demands it.
- Brand: `docs/brand/BRAND.md`. Never say "Auto delivery"; the program is Home Filter Club / Subscribe + Save.
- Commit after each slice; push to `main`; deploy with `pnpm --filter @ff/storefront cf:deploy`.

## Gotchas learned (read before debugging)

- **Astro 7 action forms** post to `?_action=<name>` (not `_astroAction`). Cross-origin POSTs get 403: curl needs `-H "Origin: <site>"`.
- **`pnpm deploy` is a reserved pnpm command**; the script is `cf:deploy`.
- **Local D1 file is keyed by `database_id`.** Changing the id in `wrangler.jsonc` creates a fresh empty database: rerun `db:migrate:local` then `seed:apply`. The seed applier picks the newest `.sqlite` under `.wrangler/state/v3/d1/`.
- **Seeding**: local uses `node:sqlite` directly (wrangler's local runner OOMs on big files); remote uses `wrangler d1 execute` per 1.5 MB chunk with statements capped at 32 KB / 100 rows (larger ones hit `SQLITE_TOOBIG` / `SQLITE_NOMEM`).
- **Deploy propagation**: the first requests after `wrangler deploy` can hit the previous version for ~10 s; retry before assuming a bug.
- **Cloudflare auth** comes from `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` user env vars (token "ff-redesign-wrangler", expires Sept 2027). Restart the editor after `setx`.
- Product images hot-link `https://www.filtersfast.com/ProdImages/...` until R2 is populated.
- The legacy `prodgen.txt` feed's `Description` column is body copy plus appended compatible SKUs and model numbers, so `description_html` is noisy until export 01 replaces it.
- No Python or `pdftoppm` on this machine; use Node for one-off scripts.
