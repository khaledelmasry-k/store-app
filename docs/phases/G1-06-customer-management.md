# Block 6: Customer Management

## Objective
Enhance customer list with profile view, order history, and notes.

## Changes

### Server (`server/src/routes/customers.ts`)
- Enhanced `GET /` with segment filter and order history per customer
- Added `GET /:phone` — returns full customer profile + order history with attribution details
- Added `POST /:phone/notes` — add note to customer
- Added `PUT /:phone/segment` — update customer segment

### Client (`src/pages/MerchantCustomers.tsx`)
- Clickable customer rows open profile modal
- Profile modal shows customer info, order history with status, items, campaign info
- Add note input in profile modal
- All attribution data visible in order history (sellerId, landingPageId, marketingLinkId, utmCampaign)

## Status
✅ Complete — Build passes.
