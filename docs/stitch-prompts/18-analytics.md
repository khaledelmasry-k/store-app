# Google Stitch Prompt — Analytics

## Title
Analytics & Reports — Merchant analytics dashboard with charts

## What to Build
A merchant analytics page at `/merchant/analytics` with summary KPIs, daily order/revenue bar charts, trend line charts, and top products table.

## Files to Create
- `server/src/routes/analytics.ts` — Three endpoints:
  - `GET /api/merchant/analytics/overview` — totalOrders, confirmedOrders, totalRevenue, avgOrderValue, topProducts (top 10 by count)
  - `GET /api/merchant/analytics/daily?days=30` — daily order count and revenue for the last N days
  - `GET /api/merchant/analytics/top-products` — all products ranked by quantity sold
- `src/pages/MerchantAnalytics.tsx` — Analytics page with:
  - 4 summary cards (total orders, confirmed orders, revenue, avg order value)
  - Daily bar charts (orders + revenue) with day range selector (7/30/90 days)
  - SVG line charts for trend visualization
  - Top products table

## Files to Modify
- `server/src/index.ts` — Register `/api/merchant/analytics` route
- `src/App.tsx` — Add route `/merchant/analytics` → `MerchantAnalytics`
- `src/components/Sidebar.tsx` — Add "التقارير" nav item to MERCHANT_NAV

## Design Notes
- Inline SVG charts (no external chart library needed)
- MiniBar component for bar charts, LineChart component for trend lines
- Material Symbols icons for summary cards
- RTL Arabic layout
