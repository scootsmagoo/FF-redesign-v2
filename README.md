# FiltersFast.com Redesign v2

Rebuild of FiltersFast.com from ASP Classic onto **Astro 7 + React islands**, running on
**Cloudflare Workers** with D1, R2, KV and Queues. The legacy repository (`FiltersFast`, ASP Classic)
is a read-only reference for features, business rules and branding.

## Layout

```
apps/storefront/      Astro site (pages, components, middleware, wrangler.jsonc)
packages/db/          Drizzle schema, D1 migrations, seed + legacy import tooling
packages/domain/      Pure business rules (URLs, pricing, size parsing) with unit tests
scripts/legacy-export SQL export pack to run against the legacy SQL Server
docs/                 Architecture, decisions, brand, legacy inventories
```

## Getting started

Requires Node 22.12+ and pnpm 10.

```bash
pnpm install
pnpm --filter @ff/storefront db:migrate:local   # create local D1 schema
pnpm --filter @ff/db seed:local                  # seed from the legacy feed exports (see below)
pnpm dev                                         # http://localhost:4321 on the workerd runtime
```

Other commands: `pnpm test` (domain unit tests), `pnpm check` (astro check + tsc),
`pnpm build`, `pnpm --filter @ff/storefront cf:deploy` (build + wrangler deploy), `pnpm --filter @ff/storefront cf-typegen` after editing `wrangler.jsonc`,
`pnpm --filter @ff/db generate` after editing the schema.

The seed builder reads `FiltersFast/srchupload/*.txt` from the legacy repo. Point it elsewhere with
`FF_LEGACY_FEEDS=<dir>` or `pnpm --filter @ff/db seed:build --src <dir>`.

## Docs

- `docs/ARCHITECTURE.md` — stack, cost sketch, layout, inbound endpoints, phases
- `docs/QUESTIONS.md` — decisions made and questions still open
- `docs/DATA-EXPORT.md` — how to run the legacy SQL export pack
- `docs/brand/` — brand tokens, copy rules, official logo files
- `docs/legacy-inventory/` — feature, integration, design-system and schema inventories of the legacy site

## Environments

- **Staging:** https://filtersfast-storefront.adam-021.workers.dev (Cloudflare account `Adam@filtersfast.com`, Worker `filtersfast-storefront`, D1 `filtersfast`, R2 `filtersfast-images`).
- Deploys need `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in the environment (never in the repo).
- Remote DB: `pnpm --filter @ff/storefront db:migrate:remote`, then `pnpm --filter @ff/db seed:apply --remote`.
