# Google Stitch Prompt — Customers API

## Title
Customers API — Server-side customer aggregation with pagination

## What to Build
Replace the client-side customer aggregation (fetching all orders and grouping by phone) with a server-side endpoint that returns paginated customer data with aggregate stats.

## Files to Create
- `server/src/routes/customers.ts` — `GET /api/merchant/customers?page=&limit=&search=&sortBy=&sortDir=`
  - Groups orders by phone number within the merchant's store
  - Returns: name, phone, governorate, city, orderCount, totalSpent, lastOrder
  - Supports search by name or phone
  - Supports sort by name, phone, orders, total, lastOrder
  - Filters by storeId for merchants (or no filter for super admin)
- `src/pages/MerchantCustomers.tsx` — Customer list page with:
  - Summary cards (total customers, total orders, total revenue)
  - Search bar
  - Sortable table columns (click to toggle sort)
  - Pagination
  - Material Symbols icons

## Files to Modify
- `server/src/index.ts` — Register `/api/merchant/customers` route
- `src/App.tsx` — Add route `/merchant/customers` → `MerchantCustomers`

## Design Notes
- Sidebar already has a customers link
- Match existing table styles from other merchant pages
- RTL Arabic layout
