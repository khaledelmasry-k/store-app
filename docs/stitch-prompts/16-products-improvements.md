# Google Stitch Prompt — Products Improvements

## Title
Products Improvements — Enhanced product form with colors, sizes, variants, images

## What to Build
Enhance the merchant products form (`MerchantProducts.tsx`) to support full product fields: colors (chip input), sizes (chip input), variant stock matrix (color × size), pricing tiers (quantity discounts), image upload per color, and active toggle.

## Files to Create
- `src/pages/MerchantProducts.tsx` — Full product management page with:
  - Product list table (search, pagination, sort)
  - Add/Edit form with: name, description, price, oldPrice, active toggle
  - Colors chip input (add/remove with Enter key)
  - Sizes chip input (add/remove with Enter key)
  - Variant stock table (color × size matrix with number inputs)
  - Pricing tiers (1, 2, 3, 4 quantity fields)
  - Image upload per color (using API_BASE + admin/upload)
  - Delete product with confirmation
  - Duplicate product

## Files to Modify
- `src/pages/AdminProduct.tsx` — Wire up delete button with `api.delete("/admin/product")` + navigate to `/admin`

## API Used
- `GET /merchant/products?page=&limit=&search=` — List products
- `POST /merchant/products` — Create product
- `PUT /merchant/products/:id` — Update product
- `DELETE /merchant/products/:id` — Delete product
- `POST /merchant/products/:id/duplicate` — Duplicate product
- `POST /admin/upload` — Image upload (FormData)

## Data Types
Product fields: colors (string[]), sizes (string[]), variantStock (Record<string, Record<string, number>>), pricingTiers (Record<string, number>), images (Record<string, string>), active (boolean)

## Design Notes
- Chip-style inputs for colors and sizes with × removal
- Matrix table for variant stock
- Image thumbnails per color with upload button
- Material Symbols icons for actions
- RTL Arabic layout, mobile-first responsive
