# Block 7: Reports

## Objective
Add daily/weekly/monthly period reports with CSV export.

## Changes

### Server (`server/src/routes/reports.ts`)
- `GET /reports/summary?dateFrom=X&dateTo=Y` — total orders, revenue, avg order value, by-status breakdown
- `GET /reports/period?period=daily|weekly|monthly&dateFrom=X&dateTo=Y` — period breakdown with order/revenue per period
- `GET /reports/export-csv` — full order CSV download with UTF-8 BOM

### Client (`src/pages/MerchantReports.tsx`)
- Summary cards (total orders, total revenue, avg order value)
- Period selector (Daily/Weekly/Monthly toggle)
- Date range filter
- Period breakdown table
- CSV Export button
- Route registered at `/merchant/reports`
- Sidebar navigation item added: "التقارير"

## Status
✅ Complete — Build passes.
