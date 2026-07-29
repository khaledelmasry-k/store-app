# Google Stitch Prompt — Merchant Settings

## Description
Create a merchant settings hub at `/merchant/settings` with tabs for Store Info, Shipping (placeholder), and Integrations (placeholder). Expose Store model fields `tagLine`, `logo`, `primaryColor` which previously existed in the DB but had no UI.

## Changes
### Server: `server/src/routes/merchantSettings.ts` (new)
- `GET /api/merchant/settings` — return current store + tenant info
- `PUT /api/merchant/settings/store` — update name, tagLine, logo, primaryColor

### Server: `server/src/index.ts`
- Register `/api/merchant/settings` route

### Client: `src/pages/MerchantSettings.tsx` (new)
- Three tabs: Store Info (name, tagLine, logo upload, primaryColor picker), Shipping (placeholder), Integrations (placeholder)
- Save button for Store Info tab
- Toast notification on save success/failure
- Logo upload via raw fetch (FormData) to `/admin/upload`

### Client: `src/App.tsx`
- Route: `/merchant/settings`

### Client: `src/components/Sidebar.tsx`
- Add "الإعدادات" to `MERCHANT_NAV` array
