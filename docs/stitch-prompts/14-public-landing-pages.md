# Google Stitch Prompt — Customer-Facing Landing Pages

## Title
Customer-Facing Landing Pages — Public render of merchant landing pages

## What to Build
A public-facing route at `/p/:slug` that renders a published landing page with the merchant's store branding (logo, name, tagLine, primaryColor).

## Files to Create
- `src/pages/PublicLanding.tsx` — Public landing page component at `/p/:slug`
  - Fetches landing page from `/api/landing-pages/public/:slug`
  - Renders sections (hero, features, products, cta, footer) with store branding
  - Shows 404 if not found or not published

## Files to Modify
- `src/App.tsx` — Add route `/p/:slug` → `PublicLanding` (no auth required)

## API Used
- `GET /api/merchant/landing-pages/public/:slug` — returns landing page with store data (logo, name, tagLine, primaryColor)

## Design Notes
- Match existing landing page design language
- Use store's primaryColor for accents
- Material Symbols for any icons
- RTL Arabic layout
