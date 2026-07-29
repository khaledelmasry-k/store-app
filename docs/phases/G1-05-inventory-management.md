# Block 5: Inventory Management

## Objective
Add SKU field to products, low stock detection, and inventory alerts.

## Changes

### Schema
- Added `Product.sku String?` with unique constraint `@@unique([storeId, sku])`

### Server (`server/src/routes/merchantProducts.ts`)
- Added `sku` field to product creation/update schema
- Added `GET /products/low-stock?threshold=5` — returns products with any variant at or below threshold

### Client (`src/pages/MerchantProducts.tsx`)
- Added SKU input field to product form
- Added SKU column to products table
- Low stock warning banner when products need restocking
- Low stock badge on product rows with stock ≤ 5

## Status
✅ Complete — Build passes.
