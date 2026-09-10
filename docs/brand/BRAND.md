# FiltersFast.com Brand Reference

Source: "Brand Guidelines & Standards v4" (April 2026, Katie Hawkes, Brand Content Manager), plus
the legacy site CSS. This is the design-token source of truth for the rebuild. Logo files live in
`docs/brand/logos/` (copied from the official brand asset folder, not from the legacy repo).

## Naming rules

- Customer-facing name is **FiltersFast.com** (or **Filters Fast** in marketing copy where a link is unwanted).
- Never: "FiltersFast", "Filtersfast.com", "Filter Fast", "FF" (internal/SKU only).
- **Filters Fast®** only when referring to Filters Fast brand products. Legal name: Filters Fast, LLC.
- Subscription program is **Home Filter Club**; use "subscription", "Subscribe + Save", or "Home Filter Club".
  Never "Auto delivery", "Autoship", "Subscribe & Save", "HFC" (internal only). The legacy site still
  says "Auto Delivery" in places (`auto-delivery.asp`, `MyAutoDelivery.asp`); the rebuild should use the new wording.
- B2B program is **FiltersFast.com Business Services**.
- Tagline on the full logo: **Filter. Purify. Protect.**
- Hashtags: #filtersfast, #filterpurifyprotect, #filtrationsimplified.
- Social: Instagram @filtersfastllc, Facebook @filtersfast, TikTok @filtersfast.

## Color tokens

| Token | Hex | Use |
|---|---|---|
| `brand-orange` | `#f26722` | Primary CTA buttons (white text), shield logo |
| `brand-orange-dark` | `#f58612` | Legacy secondary orange |
| `brand-orange-hover` | `#FF6700` / slightly darker than `#f26722` + subtle shadow | CTA hover |
| `brand-blue` | `#054f97` | Links, wordmark, headings accents. Guide mandates links in this color, underlined on hover |
| `brand-blue-link` | `#086db6` | Legacy link variant |
| `brand-blue-link-hover` | `#001e59` | Legacy link hover |
| `brand-blue-dark` | `#2352a0` | Legacy |
| `brand-blue-badge` | `#002F8C` | Legacy badge |
| `brand-green-success` | `#37b033` | Success / in-stock |
| `brand-red` | approved brand red (exact hex to confirm from CSS inventory) | Occasional CTA, sale |
| Text on light | `#000000` / near-black | Guide: primary text on light backgrounds is black |

WCAG AA (4.5:1) contrast is mandatory for text and CTAs. Note `#f26722` on white with white text is
~3.0:1, which passes only for large text; button text must be at least 18.66px bold or 24px regular,
or the button color must be darkened for small text. Flag this for the design pass.

## Typography

- Primary typeface: **Museo Sans Rounded** (Adobe Fonts / Typekit; legacy site loads it via `fontsFF.css`).
  Fallback stack: Lato, Verdana, Helvetica, sans-serif.
- Desktop: H1 36–42px bold, H2 28–32px bold, H3 20–24px medium, body 16–18px regular, 1.5 line height.
- Mobile: H1 24–28px bold, H2 18–22px semi-bold, body 15–17px, 1.4–1.6 line height, captions 13–14px.
- Line length 50–80 characters; minimum 24px padding around key content areas.

## Layout and components

- Primary CTA: brand orange, rounded corners, white text, Title Case (never ALL CAPS). Hover: slightly
  darker + subtle drop shadow. CTA length 2–5 words. Approved verbs: Add To Cart, Shop Now, Buy Now,
  Learn More, Add & Subscribe, Find My Filter, Find Your Filter.
- Links: `#054f97`, underline and slight color change on hover.
- Icons: simple, flat, consistent stroke weight (Lucide fits).
- Mobile: mobile-first grid, 16px side margins, breakpoints for 320 / 375–414 / up to 480, sticky top bar
  with logo + search + cart, hamburger or bottom-tab nav, 44×44px minimum tap targets, visible tap feedback.
- Images: white/light neutral product shots, consistent 4:3 or square aspect ratio, WebP, lazy loading,
  lowercase hyphenated file names.
- Email: centered logo on white, orange rounded buttons, single column, 600px min width.

## Copy standards

- ALL CAPS only for: FREE, OFF, MERV, HEPA, VOCs, NSF, WQA, NAFA, HVAC, AC, and industry acronyms.
- Title Case for category/product/blog/brand page titles; sentence case for body and subheads.
- Oxford comma. Numerals for measurements (20x25x1, 3 months). Dates as "April 15, 2025".
- Unique meta title (≤60 chars) and meta description (≤160 chars) on every page. One H1 per page.
- Alt text includes key specs ("20x25x1 MERV 8 pleated air filter").
- Link text describes the destination ("View Return Policy"), never "click here".
- Compatibility disclaimer on compatible products: "This product is not affiliated with or sponsored by [Brand]."
  Footer disclaimer: "FiltersFast.com is not affiliated with or endorsed by [Original Manufacturer]."
- Avoid superlatives and medical/performance claims unless third-party verified (NSF etc.).

## Product page (PDP) structure

1. Title, 60–70 chars, per-category format (see guide pp. 30–36). Examples:
   - OEM fridge: "Whirlpool EDR4RXD1 everydrop Filter 4 - Refrigerator Water Filter Replacement"
   - HVAC: "20x25x1 Air Filter MERV 8 Filters Fast 6-Pack - Pleated AC Furnace"
   - Filters Fast® fridge (contractual format): "[Compatible SKU] Filters Fast® [Part#] Replacement for [OEM Brand] [OEM SKU]"
2. Description: opening sentence → performance & benefits (contaminants, NSF) → replacement interval →
   Subscribe + Save callout → disclaimer.
3. Specifications bullet list: part numbers + cross-refs, filter type, dimensions (H x W x D in inches),
   flow rate, micron rating, pressure/temperature range, capacity (gallons/months), certifications.
4. Optional sections: Available Sizes (air filters with size dropdown), Resources (spec sheets,
   install guides), FAQ.

## Brand personality

"Surprisingly human." Relatable, positive, considerate, understanding, curious. Customers are
discount-driven and value efficiency and simplicity; trust and clear communication are the strategy.
Mission: the best filtration shopping experience: comprehensive catalog, easy navigation, tools and
education to choose correctly, and strong support.
