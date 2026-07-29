# Block 2: Customer Store Experience

## Objective
Replace single-product order page with a full multi-product storefront featuring catalog browsing, cart management, checkout flow, and order tracking.

## Changes

### Server (`server/src/routes/store.ts`)
- **`GET /api/orders/products?ref=`** — Returns all active products for a store (not just first), with variantStock, images, colors, sizes, pricingTiers. Includes store info (name, tagLine, logo, primaryColor).
- **`POST /api/orders`** — Updated to accept:
  - `items[]` with `{ productId, name, color, size, quantity }`
  - `sellerId` for seller attribution
  - Validates stock per product variant, deducts stock per product, sets totalPrice from sum
- **`GET /api/orders/track/:orderNumber`** — Returns order status, items, customer details, timeline
- **`GET /api/orders/links/resolve/:slug`** — Now returns `sellerId` alongside `storeRef`

### Schema (`server/prisma/schema.prisma`)
- `OrderItem.productId String?` — FK to Product
- `OrderItem.name String?` — cached product name for historical accuracy

### Client
- **New `CustomerStore.tsx`** — replaces legacy `CustomerOrder.tsx`
  - Product grid with color/size variant selectors per product
  - Cart panel with add/remove/quantity controls
  - Checkout form (name, phone, governorate, city, address, notes)
  - Order confirmation with order number display
  - Order tracking via header input field
  - Seller attribution: passes `sellerId` param to order
- **Updated `StoreLinkRedirect.tsx`** — propagates `sellerId` from resolved link to store URL
- **Updated `App.tsx`** — routes `/store` to `CustomerStore`

## Status
✅ Complete — Build passes, all endpoints functional.
