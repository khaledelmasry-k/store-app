# Google Stitch Prompt — Merchant Dashboard Completion

## Description
Upgrade the merchant dashboard to fully dynamic, removing all hardcoded references to specific stores (Khaled/Mahmoud ref=1/ref=2). Add a recent orders table and wire up quick actions.

## Changes
### Server: `server/src/routes/orders.ts`
- Remove `personStats(adminId)` function
- Replace super admin dashboard: instead of `personStats("khaled")` + `personStats("mahmoud")`, fetch all stores dynamically and compute per-store stats via `storeStats(storeId)`
- Add `recentOrders` to both super admin and merchant dashboard responses (last 10 orders via `getRecentOrders`)
- New helper `storeStats(storeId)` — computes counts and revenue for a single store
- New helper `getRecentOrders(storeId | null)` — returns last 10 orders with selected fields

### Client: `src/pages/AdminDashboard.tsx`
- Remove `stores` state and `storeMap`
- Remove `personSections` hardcoded to ref=1/ref=2
- Replace with dynamic `storeSections` from `stats.storesStats`
- Add Recent Orders table below seller stats showing: orderNumber, customerName, phone, totalPrice, status (with color badge), createdAt
- Wire up "إضافة منتج جديد" button to navigate to `/merchant/products/new`

### Client: `src/pages/AdminReports.tsx`
- Refactor to use `storesStats` array instead of hardcoded `khaledStats`/`mahmoudStats`
- Dynamic table header with store names
- Dynamic per-store summary cards
- Quick summary section unchanged

### Types: `src/types/index.ts`
- Remove `PersonStats` interface
- Add `StoreStat` interface (ref, name, all numeric stats)
- Add `RecentOrder` interface (id, orderNumber, customerName, phone, totalPrice, status, createdAt)
- Replace `khaledStats`/`mahmoudStats` in `DashboardStats` with `storesStats: StoreStat[]`
- Add `recentOrders: RecentOrder[]` to `DashboardStats`
- Remove `stores` property
