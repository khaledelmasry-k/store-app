# Google Stitch Prompt — Store Theme Customization

## Title
Store Theme Customization — Dynamic branding in customer-facing pages

## What to Build
Return store branding (name, tagLine, logo, primaryColor) in the `/api/orders/product` response so the customer order page displays the merchant's branding instead of hardcoded "M&K Store".

## Files to Modify
- `server/src/routes/store.ts` — Append `store` object (name, tagLine, logo, primaryColor) to the product response
- `src/pages/CustomerOrder.tsx` — Use dynamic `store` branding in the header (logo, store name, tagLine, colors) instead of hardcoded values

## Design Notes
- Header should gracefully degrade if logo/branding fields are absent
- Pass ref param through to the API to identify the correct store
- RTL Arabic layout
