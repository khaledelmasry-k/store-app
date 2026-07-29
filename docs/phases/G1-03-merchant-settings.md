# Block 3: Merchant Settings

## Objective
Replace placeholder settings tabs with comprehensive merchant configuration covering shipping, payment, WhatsApp, Pixel, SEO, social media, and custom domain settings.

## Changes

### Schema
- Added `Store.settings` JSON field to store all merchant settings

### Server (`server/src/routes/merchantSettings.ts`)
- `GET /merchant/settings` — returns store with parsed `settings` object + tenant info
- `PUT /merchant/settings/store` — updates store name/tagLine/logo/primaryColor
- `PUT /merchant/settings` — partial merge update to settings JSON

### Settings sections supported
- **Shipping**: governorates with name+price, free shipping minimum
- **Payment**: COD toggle, bank transfer toggle, bank account
- **WhatsApp**: number, default message template
- **Pixel**: Facebook Pixel ID, Google Analytics ID
- **SEO**: meta title, description, keywords
- **Social**: Facebook, Instagram, TikTok URLs
- **Domain**: custom domain, SSL toggle

### Client (`src/pages/MerchantSettings.tsx`)
- 8-tab settings interface with responsive form controls
- Tab bar with icons for each section
- All settings save via `PUT /merchant/settings` with merge semantics

## Status
✅ Complete — Build passes.
