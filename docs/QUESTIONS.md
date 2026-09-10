# Open Questions (need answers before Phase 0 closes)

Recommended answers are marked ★. Answer inline or in chat; this file gets updated with decisions.

## Q1. Primary database: D1 (SQLite) or Postgres?
- ★ **D1.** Included in the Workers plan, zero ops, 10 GB cap is ~10× what the catalog + models + a few
  years of orders need. Single-writer throughput (~1k simple queries/sec) is plenty for a storefront.
- **Postgres (Neon or Supabase) via Hyperdrive.** Pick this if: you want the same DB shared with other
  tools (BI, NAV integration jobs), you expect >10 GB, or you already pay for Supabase (there is a
  Supabase Studio shortcut on your desktop; is that in use for FiltersFast?).

## Q2. SQL Server access for migration
- Can I get a read-only login to the staging DB (172.24.16.15 is referenced in your migration notes)
  or a `.bak`/CSV export? Without it I will build the schema from the legacy code and use the
  `srchupload/*.txt` feed exports as seed data.

## Q3. Payments: keep CyberSource + PayPal, or move to Stripe?
- ★ **Keep CyberSource (Microform) + PayPal + Apple Pay.** Preserves merchant accounts, vaulted
  customer tokens, Signifyd fraud flow, and the finance team's reconciliation.
- Stripe is simpler to integrate but changes processing fees, vaulting, and back-office reports.
- Is Authorize.net still used for anything, or dead code? Visa Checkout looks dead.

## Q4. Home Filter Club: keep Ordergroove?
- ★ **Keep Ordergroove as the subscription engine in phase 1** (embed their offer widget on PDP/cart,
  use their SSO for the "Manage subscriptions" page). Rebuilding subscriptions in-house is a multi-month
  project on its own and touches billing/dunning.
- If the contract is ending, say so and I will design an in-house version (Queues + Cron + vaulted tokens).

## Q5. Order handoff to NAV / fulfillment
- How do orders reach NAV today (SQL table polled by a job? `OrderInsertionAPI.asp`? the Shopify
  push?). The new site needs one clean handoff: I propose writing orders to D1 and exposing a
  signed REST endpoint + a nightly export that the existing job server can pull.

## Q6. Search provider
- HawkSearch is confirmed live (autocomplete, results page, tracking). ★ Keep it and integrate its
  JSON API server-side, so results pages render as HTML instead of a client-side Handlebars app.
  Confirm the contract continues through the cutover, and whether you have API credentials for a
  test index.

## Q7. Reviews
- Trustpilot product reviews via API sync (there is a `trustpilot-products` job), or migrate the
  internal `reviews` table and render natively? ★ Both: import legacy reviews, keep pulling Trustpilot.

## Q8. Admin / back office scope
- ★ **Out of scope for the storefront launch.** Product data continues to be managed where it is today
  (NAV + legacy Manager), synced into D1 by a job. A lightweight admin (orders view, promo codes,
  redirects, content blocks) comes after cutover.
- If you want admin in v2 from the start, that roughly doubles the project; tell me and I will phase it.

## Q9. Inbound order channels
- `shpfyOrdersCreation4.asp` is an inbound webhook from a sister Shopify store (Ace Pools), and
  `Config/wm_api.asp` syncs Walmart Marketplace orders. Are both still active? If so, v2 needs to
  host those two receivers (small) or they stay on legacy pointed at the same order store.

## Q10. Mobile site
- ★ Single responsive site; retire `m.`/`mobile/` entirely with 301s.

## Q11. International / currency
- The legacy site has currency conversion and Canada Post shipping. Do you ship outside the US today,
  and to which countries? Is multi-currency display (not settlement) enough?

## Q12. Domain and cutover
- Is DNS for filtersfast.com already on Cloudflare? Will staging live at a subdomain
  (e.g. `next.filtersfast.com`) protected by Cloudflare Access during the build?

## Q13. Repo visibility and secrets
- Is `scootsmagoo/FF-redesign-v2` public? I will keep every key in Wrangler secrets / `.dev.vars`
  (git-ignored) regardless, and I will not copy any credentials out of the legacy repo or your Desktop.

## Q14. Design direction
- Faithful modern refresh of the current look (same header/mega-menu/footer structure, brand orange/blue,
  Museo Sans Rounded), or a bigger visual rethink? ★ Faithful refresh first; the brand guide gives clear
  rules, and the customer base is price-driven and conversion-sensitive.
- Do you have an Adobe Fonts (Typekit) kit ID for Museo Sans Rounded that the new domain can use?

## Q15. Anything from v1 worth salvaging?
- The v1 Next.js repo has a lot of business-rule transcription (campaign flags, gift-with-purchase,
  Home Filter Club activation). I plan to read it as a second reference but not copy code. Any parts
  you consider correct and finished that I should port directly?

## Q16. Keep the `.asp` URLs or move to clean paths?
- ★ Move to `/p/{slug}` and `/c/{slug}` with 301s from every legacy URL. Cleaner long-term, and the
  redirect table is needed anyway for the mobile tree and `redirectHub`. If SEO would rather avoid a
  site-wide 301 wave at cutover, the new site can serve the `.asp` paths as canonical instead.

## Q17. The two ASP.NET sidecars
- `/PaymentProcessor/` (card tokenization, PayPal express posting) and `/kvmapi/` (Azure Key Vault
  proxy) live outside the repo. Do you have their source? v2 replaces both (CyberSource Microform
  direct + Wrangler secrets), but I need to know what `PaymentProcessor` does beyond tokenization.

## Q18. Support chat
- The support-chat bot is either keyword scoring over `support_articles` or Gemini-backed (the two
  inventories disagree). Do you want an LLM assistant in v2? If yes, ★ Workers AI or the Claude API
  over the same article corpus, with Monday.com escalation preserved.

## Q19. Partner/membership programs to keep
- AAA (member ID validation), ID.me military, Frontdoor / HSA / 2-10 / American Home Shield landing
  pages, affiliate landing pages (`aff/`), ShareASale + Awin pixels. Which of these are still
  contractually live? Talkable referrals appear switched off already.
