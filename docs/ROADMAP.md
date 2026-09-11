# Roadmap and Working Notes

The single place to look for "what's next". Update it whenever a slice lands or a decision changes.
Last updated: September 10, 2026.

## Status

Live on staging: https://filtersfast-storefront.adam-021.workers.dev

| Area | State |
|---|---|
| Legacy data import (`packages/db/import`) | Done for the first export: 25k products with full content, 1.8k categories with parents, options, specs, images, 46k related links, 65k cross-ref part numbers, 182k models / 1M model links, promotions, tiers, redirects, reviews, settings, shipping tables, staging customers + orders. Gaps listed in `docs/DATA-EXPORT.md` |
| Catalog pages (home, category with sub-categories + roll-up + breadcrumbs, product with options/tiers/specs/cross-refs/models/reviews/related/discontinued notice, model, search, categories index, air-filter size (stopgap), 404) | Done on the imported data |
| Header mega-menu (desktop flyouts + mobile drawer, legacy curation resolved against D1) | Done |
| XML sitemaps (index, pages, categories, products, models) + host-aware `robots.txt` | Done |
| Paired child SKUs inherit parent data on the PDP | Done |
| Legacy URL redirects (`redirects` table first, then pattern rules) and search short-circuits (SKU, cross-ref part number, size, model) | Done |
| Cart (session + D1, options, quantity-tier repricing, promo codes, Subscribe + Save, free-shipping threshold) | Done |
| Checkout (addresses → shipping → review/donation → payment → confirmation) | Done on stub providers |
| Provider interfaces (payment, tax, shipping, email, address) | Done, stubs only |
| Cloudflare: Worker, D1, KV, R2 provisioned; deploy script | Done |
| Accounts (Better Auth: register, login, reset, order history, reorder, addresses, settings, guest tracking) | Done for email+password; legacy passwords verified with the `LEGACY_HASH_KEY` secret (set on staging) |
| Manager (`/manager`: own staff accounts + login, dashboard, orders + status/shipments, customers, site settings, staff accounts, password change) | Done, minimal. Separate `admins` table/cookie; customers can never reach it. First account: `manager:admin <email> --remote` |
| Email | `console` provider by default (nothing sent; locally the reset link is shown on the page via `EMAIL_DEBUG_LINKS=true` in `.dev.vars`). `sendgrid` provider ready: needs `SENDGRID_API_KEY` secret + `EMAIL_PROVIDER=sendgrid`. **Staging cannot send password resets until then**; legacy passwords work, so existing customers can sign in |
| Tests | 48 unit tests (`pnpm test`), `astro check` clean |

## Backlog, in priority order

Work top-down. Each item is meant to be one commit-sized slice.

### P0 — unblock staging
0. ~~Workers Paid plan~~ Done September 10, 2026: account upgraded, remote D1 migrated and fully seeded (73 chunks), Worker deployed. Remote reload recipe: `db:migrate:remote`, `import:build`, `seed:apply --remote` (`--from N` resumes after a transient wrangler error), `cf:deploy`.

### P1 — needed before the site is usable by a customer
1. ~~Options in the cart/checkout~~ Done: option validated against the product/parent groups (required, excluded, out of stock), price add/percent/override applied, label carried to cart, summary and order lines. One option group per product for now (the PDP posts only the first).
2. ~~Cart line pricing from tiers~~ Done: cart lines are repriced on every view from current price + option + quantity tier; "Bulk price" shown on the line.
3. ~~Promo codes~~ Done: `@ff/domain/promotions` ports the DiscOrder rules (percent/amount, subtotal + date windows with the 11¢ tolerance, scope by product/category/class/brand/id-list, multiply-by-qty, tiered thresholds, exclusive/compoundable stacking; GWP/BOGO report "unsupported"). Cart code entry/removal, `/promo/{CODE}` landing, tax on the discounted amount, codes stored on the order, single-use codes consumed at placement. Still to do: load `promo_codes` (`import:build --with-codes`, 2.3M rows) and once-only-per-customer enforcement (needs accounts).
4. ~~Accounts~~ Done (email/password): Better Auth on D1 (`auth_*` tables, migration 0001), register/login/logout/forgot/reset pages as server-rendered forms, `/account` overview, order history (imported + new), order detail with per-line "Add to Cart" and "Re-Order Everything", addresses (saved from orders), settings (profile + change password), `/track-order` (number + email), checkout prefill and order↔customer linking. Legacy customers are imported as auth users whose credential carries `legacy:<sha256|rc4>:<hex>` (`@ff/domain/legacy-password`, unit-tested against the legacy `SecureHash`/`EnDeCrypt` routines); verifying those needs the old site's `rc4Key` as the **`LEGACY_HASH_KEY` Wrangler secret** (first successful login re-hashes to scrypt). Without the secret, legacy users are told to set a new password. Still to do: Google/Facebook sign-in (needs OAuth client ids), saved appliances page, subscriptions page is a placeholder, sign-in attempt lockout (legacy locked after 5).
4b. ~~Manager (back office)~~ Done (minimal, September 10, 2026), modelled on the legacy `/Manager` + `cp_admins`: staff accounts live in their own `admins` table (scrypt hashes, migration 0003) with server-side `admin_sessions` and the `ff.manager` cookie scoped to `/manager`. Customer sessions are never recognised there and manager sessions never sign in on the storefront. `/manager/login` (work email), 5 failed attempts lock for 15 min, temporary passwords force a change, 12-char minimum. Pages: dashboard, orders (search/filter, status, add shipment), customers (search, profile, orders, sign-in state), site settings (JSON), staff accounts (create/reset with one-time temp password, deactivate), my password. First account: `pnpm --filter @ff/storefront manager:admin <email> --name "…" [--remote]`. Later: permissions/roles per legacy `cp_roles`, IP allow-list (legacy `internalIPCheck`), promotions/redirects editors, product overrides, order export to NAV.
4c. ~~Password reset email~~ Done: `SendGridEmailProvider` (v3 mail send, inline HTML or `d-…` dynamic templates) behind `EMAIL_PROVIDER=sendgrid` + `SENDGRID_API_KEY` secret + `EMAIL_FROM`. With the default `console` provider the reset link goes to the Worker logs; locally, `EMAIL_DEBUG_LINKS=true` in `.dev.vars` also prints it on the forgot-password page. Never set that var on a public deployment (it would let anyone reset any account); staging stays without self-service resets until SendGrid is configured.
5. ~~Mega-menu~~ Done September 10, 2026: `src/lib/nav.ts` carries the legacy flyout curation (brand logo tiles, Most Popular SKUs/sizes, water types, the three "More Products" tabs, pool-season ordering) and resolves every entry against D1 at render time (cached 10 min per isolate), so retired categories/products drop out. `Nav.astro` renders the desktop hover/focus flyouts with no JS (a few lines for the More Products tabs) and a checkbox-driven mobile drawer. Logos and promo images ship from `public/nav/` (copied from the legacy `images/` folder; the live site 403s hot-links from non-browsers). Not data-driven: `pop_rank` has hundreds of ties at 1, so "Most Popular" stays curated. The `/air-filters/size/{key}` page now reads the legacy size chart (`search_products` → `air_filter_size_products`, migration 0004, MERV grade per row, legacy grid order) and falls back to a name/keyword/option-label match for sizes not in the chart. Only 168 of 554 chart rows load until the products re-export fixes the 39 column-shifted rows (see `docs/DATA-EXPORT.md`).
6. ~~XML sitemaps + robots~~ Done September 11, 2026: `/sitemap-index.xml` → `sitemap-pages.xml`, `sitemap-categories.xml` (1.8k), `sitemap-products-N.xml` (10k per file, listable products only), `sitemap-models-N.xml` (25k per file, `noindex = 0` and at least one product). Generated from D1 on request, cached 12 h at the edge via the Cache API, URLs always on the canonical origin (`astro.config` `site`). `robots.txt` is a route: any non-canonical host (workers.dev staging, previews) gets `Disallow: /`; the canonical host gets the real rules plus the Sitemap lines. Submit `https://www.filtersfast.com/sitemap-index.xml` in Search Console at cutover.
7. ~~Paired products~~ Done September 11, 2026: child SKUs (`parent_product_id`, 5.8k rows, 1.7k parents) inherit from the parent as `prodViewHv2.asp` does: options and quantity tiers (already), plus specs, cross-reference part numbers, compatible models and reviews when the child has none, the Home Filter Club flag and frequency, and discontinued/temporarily-unavailable alternatives. The PDP links "Same filter as {parent SKU}" when the parent is listable. 64 children whose parent was never exported render standalone. Verified 40 random children plus targeted cases on the dev server.

### P2 — parity with the legacy site
7. Finish model pages once the full `tFridgeModelLookup` text export arrives (Excel truncated it); image gallery polish.
8. ~~Refrigerator finder~~ Done September 11, 2026: `/tools/refrigerator-finder` (brand → style → location → removal → product with alternates, plain links so every step has a URL; single-removal locations skip a step as the legacy tool did) and `/api/refrigerator-finder` (JSON, CORS `*`, for the third-party embeds that called `refrigeratorFinderTool.asp`). Style/location/removal photos are not in the repo (`images/refrigerator/*` lives with ProdImages), so the steps are text tiles until P2 #12. Still to do: custom air filter builder (needs the products re-export).
9. Reviews: legacy `reviews` imported and rendered on PDPs and `/reviews`; Trustpilot sync behind a `ReviewsProvider` once a key exists.
10. ~~Static/legal/marketing pages~~ Done September 11, 2026, copy ported from the legacy pages: `/about-us` (with story, mission, values, awards; `/our-story` and `/our-mission` 301 to its anchors), `/our-brand`, `/returns`, `/support`, `/reviews`, `/models` (lookup form + finder brands), `/home-filter-club` (with FAQ JSON-LD), `/military-discount` (ID.me cart verification itself is P3), `/business-services` (Monday.com form embed), `/wine-to-water`, `/xtreme-hike`, `/habitat-for-humanity`, `/sitemap` (HTML), `/terms` (+ `/privacy`, `/accessibility`, `/shipping-policy` → anchors; `/privacy/california`). **Gap:** the Terms text was truncated at Excel's cell limit, so the Privacy/Shipping/Returns/Accessibility sections show placeholders until `termsAndCond.txt` is exported (see `docs/DATA-EXPORT.md`). Support center added September 11, 2026 from the `support_*` export: `/support` (topics + promoted FAQs + search), `/support/{topic}`, `/support/{topic}/{article}` (legacy URLs, trailing slashes 301), `/support/search`. Product and category FAQs (legacy `faq`) render on PDPs (with FAQPage JSON-LD) and category pages; the legacy `redirectHub` keywords short-circuit search to a product or page. Remaining: AAA / Frontdoor / partner landing pages (blocked on Q19).
11. Email templates (order confirmation, shipping, password reset) via the email provider; SendGrid implementation.
12. Images to R2 + Cloudflare Images (needs the `ProdImages` zip); replace hot-links.
13. Inbound endpoints (architecture doc §4a): Ordergroove order insertion, Shopify webhook, WMS ship-confirm, price feed.

### P3 — vendors (each blocked on credentials)
14. CyberSource Microform payment provider; PayPal; Apple/Google Pay.
15. TaxJar provider. 16. UPS / USPS / FedEx REST rate providers. 17. SmartyStreets validator + Melissa autocomplete.
18. HawkSearch search provider (server-side results) replacing the LIKE fallback. 19. Klaviyo/Attentive events. 20. Signifyd.

### P4 — launch
21. Playwright e2e suite on staging; GitHub Actions CI (test, check, deploy on main).
22. Cloudflare Access on staging; custom hostname; observability alerts.
23. Redirect table populated from `prodRedirect` / `catRedirect` / `redirectHub` / keyword list; 301 audit against the legacy sitemap.
24. Cutover checklist: DNS, Apple Pay domain verification, Typekit domain, secrets rotation (inventory 02 §B5).

## Blocked on Adam

- Export gaps: `rerun/12a`–`12c` (shipping holidays, currency rates, marketplace tax states), plus the newline-safe re-export of `01-products.sql` / `02-categories.sql` (39 product rows, including the air-filter SKUs behind the size chart, are still column-shifted). Details in `docs/DATA-EXPORT.md` §Status.
- ~~`LEGACY_HASH_KEY` secret~~ Set on staging and in `.dev.vars` (same value as the legacy `rc4Key`). If they ever drift: `pnpm --filter @ff/storefront secret:sync LEGACY_HASH_KEY` copies `.dev.vars` → Worker.
- `SENDGRID_API_KEY` (a Mail Send key from the SendGrid account the legacy site uses; `no-reply@filtersfast.com` is already a verified sender there): add to `.dev.vars`, run `secret:sync SENDGRID_API_KEY`, set `EMAIL_PROVIDER` to `sendgrid` in `wrangler.jsonc`, deploy.
- OAuth client ids/secrets for Google and Facebook sign-in.
- `ProdImages` + `images` folder zips → P2 #12.
- Vendor API keys → P3.
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
- **Data loading**: `seed:build` (legacy feed files, small) or `import:extract` + `import:build` (full export workbook, needs `NODE_OPTIONS=--max-old-space-size=8192`) both write `packages/db/seed/chunks/`; `seed:apply [--remote]` loads them. `import:build` skips the 2.3M single-use promo codes unless `--with-codes`.
- **D1 free tier** allows 100k row writes per day; the full import needs Workers Paid.
- **Seeding**: local uses `node:sqlite` directly (wrangler's local runner OOMs on big files); remote uses `wrangler d1 execute` per 1.5 MB chunk with statements capped at 32 KB / 100 rows (larger ones hit `SQLITE_TOOBIG` / `SQLITE_NOMEM`).
- **Remote seeding** occasionally fails with `Not currently importing anything` (transient wrangler import bug); rerun with `seed:apply --remote --from <chunk>`.
- **Deploy propagation**: the first requests after `wrangler deploy` can hit the previous version for ~10 s; retry before assuming a bug.
- **Cloudflare auth** comes from `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` user env vars (token "ff-redesign-wrangler", expires Sept 2027). Restart the editor after `setx`.
- Product images hot-link `https://www.filtersfast.com/ProdImages/...` until R2 is populated.
- The legacy `prodgen.txt` feed's `Description` column is body copy plus appended compatible SKUs and model numbers, so `description_html` is noisy until export 01 replaces it.
- No Python or `pdftoppm` on this machine; use Node for one-off scripts.
- **Legacy password labels**: the importer writes `legacy:sha256:…` (HMAC-SHA256 keyed with `rc4Key`, password case preserved) and `legacy:rc4:…` (RC4 of the lower-cased password). The verifier accepts `sha256` and `hmac` as the same scheme; a mismatch here silently fails every legacy sign-in.
- **Secrets can't be read back** from Wrangler. Keep the canonical value in `.dev.vars` and push with `secret:sync`.
- **Astro Actions can be posted to any page URL** (`?_action=…`), so authorization must be checked inside the action handler (`requireAdmin` reads `locals.admin`, which middleware only sets on `/manager` routes).
- **D1 caps bound parameters at 100 per statement.** A large `inArray` fails with a bare "Failed query"; batch the values (see `chunk()` in `src/lib/nav.ts`).
- **A thrown error inside a streamed Astro page returns 200 with a truncated body**, and the dev log may only show an unrelated React "Invalid hook call" from the aborted render. Call the failing function from a throwaway API route to see the real message.
- **A file in `public/` shadows a route of the same path** (assets are served before the Worker), so `robots.txt` lives in `src/pages/robots.txt.ts` and there must be no `public/robots.txt`.
- **`astro build` while `astro dev` is running wipes Vite's dep cache** (`node_modules/.vite`); every page then 500s until the dev server is restarted.
- **Two sign-in systems on purpose**: customers = Better Auth (`auth_*`, `ff.session_token`); staff = `admins` + `admin_sessions` (`ff.manager`, path `/manager`). Never bridge them with a role flag.
