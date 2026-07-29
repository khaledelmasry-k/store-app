# Block 4: Analytics Upgrade

## Objective
Add multi-dimensional filtering to analytics: by seller, campaign, date range, landing page, and traffic sources.

## Changes

### Server (`server/src/routes/analytics.ts`)
- Updated `GET /overview` with filtering by sellerId, landingPageId, marketingLinkId, utmCampaign, dateFrom, dateTo, tenantId, storeId, status
- Updated `GET /daily` with same filter support
- Updated `GET /top-products` with same filter support
- Added `GET /seller-performance` — per-seller orders/revenue with filtering
- Added `GET /campaigns` — per-campaign orders/revenue
- Added `GET /traffic-sources` — per-source order counts

### Client (`src/pages/MerchantAnalytics.tsx`)
- Added filter bar with date range, seller dropdown, campaign dropdown
- Added Seller Performance section with table
- Added Campaign Performance section
- Added Traffic Sources section
- Kept existing summary cards, daily charts, and top products table

## Status
✅ Complete — Build passes.
