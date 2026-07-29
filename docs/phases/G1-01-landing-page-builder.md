# Phase G1 — Block 1: Landing Page Builder Enhancement

## Date
2025-07-29

## Status
✅ Complete

## Changes

### Frontend
- **`src/pages/MerchantLandingEditor.tsx`**:
  - Extended `Section` type union: added `testimonials`, `faq`, `contact`
  - Added default section templates for all 3 new types
  - Added add-section buttons for new types with Material Symbols icons
  - Added editor panels:
    - **Testimonials**: title + JSON items (name, text, rating)
    - **FAQ**: title + JSON items (q, a)
    - **Contact**: title, phone, whatsapp, email, address
  - All new editors include labels and placeholders in Arabic

- **`src/pages/PublicLanding.tsx`**:
  - Extended `Section` type union: added `testimonials`, `faq`, `contact`
  - Added renderers:
    - **Testimonials**: card grid with star ratings, quote text, author name — responsive grid layout
    - **FAQ**: accordion (`<details>`/`<summary>`) with stylized Q&A pairs
    - **Contact**: icon + link rows for phone, WhatsApp, email, address with Material Symbols

### Database
- No schema changes (sections stored as JSON string, handled generically)

### API
- No API changes (server route handles sections generically)

## Seller Network Architecture
- Landing pages remain scoped to `storeId` → Store → Sellers chain
- Store branding (logo, name, primaryColor) renders in public page header
- Contact section links (phone, WhatsApp) use store-specific contact info

## Backward Compatibility
- All existing landing pages with hero/features/products/cta/footer sections continue to work
- No migration needed — new section types are additive only

## Build
- `npm run build` — ✅ passed (0 errors)
