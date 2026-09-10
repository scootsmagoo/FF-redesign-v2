# FiltersFast.com Redesign v2 — Architecture Proposal

Status: **DRAFT for review** (September 10, 2026). Nothing here is locked until the open questions in
`docs/QUESTIONS.md` are answered.

## 1. What we are replacing

- **Legacy site:** ASP Classic (VBScript) on IIS, SQL Server backend, ~500 `.asp` files, separate
  `mobile/` page tree with server-side device detection, jQuery 1.9/3.5, hand-rolled CSS
  (`desktopFF.css` / `mobileFF.css`).
- **Catalog scale (from the search feed export):** ~12,800 products, ~1,000 categories, ~600
  manufacturers, ~83,000 appliance model → product mappings.
- **Back office around it:** Microsoft Dynamics NAV (ERP/orders/inventory), ~78 Windows scheduled
  jobs on `devserver01` (feeds, reports, syncs), Ordergroove for subscriptions (including an inbound
  XML order-insertion endpoint), HawkSearch (live), Trustpilot, SendGrid, Klaviyo, Attentive, TaxJar,
  CyberSource Microform + PayPal/Venmo + Apple/Google Pay, SmartyStreets + Melissa, Maxmind, Signifyd,
  Walmart Marketplace order sync, an inbound Shopify webhook from a sister store (Ace Pools), and two
  ASP.NET sidecars outside the repo (`/PaymentProcessor/`, `/kvmapi/` Key Vault proxy).
  The site is **already fronted by Cloudflare** (CSP and geo cookies reference it), which makes the
  DNS side of cutover trivial. Full inventories: `docs/legacy-inventory/`.
- **Catalog behaviours that are easy to miss:** option matrices with per-option stock, pack-size
  UOM pricing, quantity-tier discounts, channel-specific pricing (`tsourceprice`), side-by-side
  compare products, custom-cut air filter SKU grammar, state-level sales restrictions, Prop 65,
  a 95 KB promo engine (`_INCDiscountsAndTotals.asp`) with BOGO/GWP/tiered/presence rules, AAA and
  ID.me membership discounts, checkout donations with round-up, and a search redirect layer that
  resolves SKUs, fridge model numbers (with OCR-style normalization) and air-filter sizes before
  the search engine is ever hit.
- **Prior attempt (v1, `filtersfast-next`, Oct–Nov 2025):** Next.js 16 + SQLite + Stripe, targeted at
  Vercel. It grew to 165 pages and 334 API routes in six weeks, including a full admin workspace,
  blog, loyalty, marketplaces, workflows, push notifications and more. Lessons applied here:
  - Scope discipline. v2 ships the storefront first, parity-driven, and treats admin as a separate
    later phase (or keeps NAV + legacy Manager for back office).
  - Hosting cost. Vercel's per-seat + usage billing is the stated concern; Cloudflare's flat
    Workers plan is the target from day one, so the framework choice must be Cloudflare-native.
  - No "SQLite locally, Postgres in prod" ambiguity. One database target, chosen up front.

## 2. Recommended stack

| Layer | Choice | Why |
|---|---|---|
| Hosting/runtime | **Cloudflare Workers** (Workers Paid, $5/mo base) with Workers Static Assets | Flat, predictable pricing: 10M requests + 30M CPU-ms included, $0.30/M after. No egress fees. Global edge. |
| Framework | **Astro 6** (server output) + **React islands** | Cloudflare acquired Astro in Jan 2026; `astro dev` now runs on workerd, so dev = prod. ~100k SEO pages (products, categories, models) render as zero-JS HTML; cart/checkout/account/model-finder are React islands. Astro Actions handle form mutations; Astro Sessions use KV. |
| Language | TypeScript everywhere, strict | |
| Styling | **Tailwind CSS v4** + a small set of headless components (Radix/shadcn-style) + Lucide icons | Brand tokens as CSS variables; flat icon style matches the brand guide. |
| Database | **Cloudflare D1** (SQLite) via **Drizzle ORM** — *see Q1 in QUESTIONS.md* | Catalog + models + orders fit comfortably in D1's 10 GB. Included in Workers Paid; reads are effectively free ($0.001/M rows). Alternative if you want Postgres: Neon/Supabase behind **Hyperdrive** (included in Workers Paid, no per-query fee). |
| Search | **HawkSearch API** (already live and paid for) behind a `SearchProvider` interface, with the legacy pre-search redirect rules (SKU, model number, air-filter size, custom SKU, redirectHub) ported as pure TypeScript in `packages/domain` — *see Q6* | Keeps merchandising/facet config the team already maintains in HawkSearch. DB full-text is the fallback if the contract ends. |
| Bot / geo | Cloudflare Turnstile (replaces reCAPTCHA v3), Cloudflare request geo headers (replace MaxMind GeoIP for country/currency defaults); MaxMind minFraud only if Signifyd doesn't cover it | Both free on the plan. |
| Object storage | **Cloudflare R2** for product images/spec sheets; Cloudflare Images binding for on-the-fly resizing/WebP | $0 egress. |
| Cache | Workers KV for sessions, hot config (promo bar, shipping thresholds), rendered fragment cache; Cloudflare Cache API for full-page cache on catalog pages | |
| Background jobs | **Cloudflare Queues** + **Cron Triggers** (feeds, order export to NAV, abandoned-cart emails, currency refresh) | Replaces the relevant subset of the 78 Windows jobs over time; the rest stay on the Windows job server. |
| Auth | **Better Auth** (email/password + Google/Apple/Facebook, passkeys optional) with D1 adapter | Migrate legacy accounts by re-hashing on first successful login (legacy uses MD5/RC4-era helpers). |
| Payments | **Keep the existing gateways** behind a `PaymentProvider` interface: CyberSource (Microform/Flex for PCI-SAQ-A), PayPal (JS SDK), Apple Pay via CyberSource — *see Q3* | Preserves merchant accounts, vaulted tokens and Signifyd flow. Stripe is a business decision, not a technical one. |
| Tax | TaxJar (existing account) | |
| Shipping | UPS (OAuth REST), USPS (APIs v3), FedEx (REST), DHL for international, behind a `ShippingProvider` interface; SmartyStreets for validation, Melissa for autocomplete | **All four legacy carrier integrations use sunset APIs** (UPS XML, USPS Web Tools, FedEx SOAP, Canada Post over plain HTTP). They must be rewritten in any case. |
| Email | SendGrid (existing templates/IPs); transactional via Queues consumer | |
| Subscriptions | Ordergroove stays as system of record for Home Filter Club in phase 1 — *see Q4* | |
| Reviews | Trustpilot product reviews (existing) — *see Q7* | |
| Analytics | GA4/GTM via Partytown or the Cloudflare Zaraz tag manager (keeps third-party tags off the main thread) | |
| Observability | Workers Logs + Cloudflare Web Analytics; Sentry optional | |
| CI/CD | GitHub Actions → `wrangler deploy`; PR preview deployments via Workers preview URLs | |
| Testing | Vitest (unit, with `@cloudflare/vitest-pool-workers`), Playwright (e2e on preview URL) | |

### Why not the alternatives

- **Next.js on Cloudflare (OpenNext):** works, but is a compatibility shim maintained outside Vercel;
  the v1 codebase was Next.js and still tied itself to Vercel. Not the safe long-term bet on Cloudflare.
- **React Router v7 / TanStack Start:** both are excellent and Cloudflare-native. They are better than
  Astro when the whole site is an app. This site is ~99% content pages by URL count; Astro's
  zero-JS default wins on Core Web Vitals and on Workers CPU cost per request. If checkout/account
  complexity grows beyond what islands handle cleanly, those flows can move to a TanStack Start
  sub-app on the same Worker without touching the catalog.
- **Shopify/BigCommerce headless:** the legacy code already pushes some orders into Shopify
  (`shpfyOrdersCreation4.asp`) — clarify whether that is a marketplace channel or a migration signal
  (*Q9*). A SaaS backend removes most of this project; it is a business decision.

## 3. Cost sketch (monthly, steady state)

| Item | Estimate |
|---|---|
| Workers Paid plan | $5 (covers Workers, D1, KV, R2, Queues, Hyperdrive, Cron) |
| Workers requests above 10M (a site at ~3M pageviews/mo with assets served from Static Assets, which are free, lands well under) | $0–15 |
| D1 storage/reads/writes | $1–10 |
| R2 storage (20 GB images) + ops | $1–5 |
| Cloudflare Images transformations | $0.50 per 1k unique transforms; typically $5–30 |
| Domain/DNS/SSL/CDN/WAF (Cloudflare Free or Pro $20) | $0–20 |
| **Total platform** | **~$15–90/mo** vs Vercel Pro ($20/seat + bandwidth/function overages that scale with traffic) |

Third-party services (SendGrid, TaxJar, Trustpilot, Ordergroove, HawkSearch, Signifyd) are unchanged.

## 4. Application layout (monorepo, pnpm)

```
apps/
  storefront/            Astro 6 site: pages, islands, actions, middleware
packages/
  db/                    Drizzle schema, migrations, seed + legacy-import scripts
  domain/                Pure TS: pricing, discounts, shipping rules, tax, cart math (unit-tested, no I/O)
  integrations/          PaymentProvider, ShippingProvider, TaxProvider, EmailProvider, SearchProvider
  ui/                    Brand tokens, shared React + Astro components
  config/                tsconfig, eslint, tailwind preset
workers/
  jobs/                  Cron + Queue consumers (feeds, NAV export, abandoned carts)
docs/                    This folder
```

## 4a. Inbound endpoints the new site must keep serving

These are called *into* the storefront by other systems and need equivalents on the Worker from day
one of cutover (or a reverse proxy to legacy until each is ported):

| Legacy endpoint | Caller | v2 plan |
|---|---|---|
| `OrderInsertionAPI.asp` (XML) | Ordergroove recurring orders | Worker route + Queue consumer, same XML contract |
| `shpfyOrdersCreation4.asp` | Shopify webhook (Ace Pools store) | Worker route, HMAC-verified |
| `automation/shipconfirm*.asp` | WMS ship confirmations | Worker route, token-auth |
| `ogPriceApi.asp`, `ogMsiAuth.asp` | Ordergroove price feed / SSO | Worker routes |
| `TaxCalculationAPI.asp`, `applepay-process.asp`, `reCaptcha.asp` | The site's own JS | Astro Actions |
| `refrigeratorFinderTool.asp` (CORS `*`) | Third-party embeds | Keep as a CORS route |
| `b2b/b2bInventory.asp` | StockSync partner feed | Cron-generated file in R2 |
| `fbItems/fbproducts.asp`, `srchupload/*` | Feed jobs | Cron → R2 |

## 5. URL and SEO plan

Legacy URLs are the site's SEO equity and must keep working:

- Product: `/{Slug}.asp` (e.g. `/WFCB-Frigidaire-PureSourcePlus-Water-Filter.asp`) → new canonical
  `/p/{slug}` with a 301 from the `.asp` form, driven by a `redirects` table (D1) checked in
  middleware. Same for category `/{Slug}-Cat.asp` → `/c/{slug}`, models `/models/{model}` (kept as-is).
  Decision point: keeping the `.asp` URLs as canonical is also viable and avoids a site-wide 301 wave;
  the redirect table supports either. (*Q16*)
- Every `/mobile/…` URL (~80 page types) 301s to its desktop equivalent; the `rel=alternate` m-dot
  pairing goes away.
- Port `redirectHub`, `prodRedirect`, `catRedirect` and the ~87 KB of keyword redirects in
  `_INCSearchRedirects.asp` into the same table.
- Keep `sitemap.asp` semantics with generated sitemap indexes (products, categories, models).
- JSON-LD parity: Product/Offer/AggregateRating (already added to legacy PDPs in 2026), BreadcrumbList,
  Organization, ItemList on category pages, the compatible-parts structured data from the models work.

## 6. Data migration approach

1. Get a read-only SQL Server export (bcp/CSV or a `.bak` restored locally). The legacy schema list in
   `docs/legacy-inventory/` names the tables to pull.
2. `packages/db/import/*` scripts transform → Drizzle inserts into D1 (batched, idempotent, keyed on
   legacy IDs so re-runs are safe).
3. Products, options, pricing tiers, categories, model compatibility, compatible-SKU cross refs,
   reviews (or re-pull from Trustpilot), customers (email + profile; password reset flow on first login),
   order history (read-only import for "My Orders"), promo codes, redirects.
4. Images: pull from the current image host into R2 keyed by SKU.

## 7. Delivery phases

| Phase | Scope | Exit criteria |
|---|---|---|
| 0 | Decisions (QUESTIONS.md), repo scaffold, CI, brand tokens, D1 schema, legacy import scripts | `pnpm dev` shows homepage with real imported catalog |
| 1 | Catalog: home, category/PLP with facets, PDP with options/pricing/Subscribe + Save, model lookup, search, redirects, sitemaps, JSON-LD | Lighthouse ≥ 95 mobile on PDP/PLP; every legacy product URL 301s correctly |
| 2 | Cart + checkout: guest + account, promo codes, automated discounts, address validation, live rates, tax, CyberSource/PayPal/Apple Pay, order confirmation email, NAV order handoff | Test orders flow end-to-end on staging |
| 3 | Accounts: login/social, order history, reorder, saved models, reminders, Home Filter Club management (Ordergroove embed or API), returns | Legacy customer can log in and see history |
| 4 | Long tail: B2B/Business Services, affiliates, referrals, charity pages, giveaways, gift cards, static/legal pages, PWA manifest | Parity checklist in `docs/legacy-inventory/` fully ticked |
| 5 | Cutover: DNS to Cloudflare, legacy kept on a subdomain for Manager/admin until admin replacement is scoped | |

Each phase ends with a Playwright suite covering its flows.
