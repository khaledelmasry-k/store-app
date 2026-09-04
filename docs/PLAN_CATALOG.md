# Matjari plan catalog and entitlement matrix

This document is the local catalog contract used by `functions/src/planCatalog.ts`
and `src/shared/plans/catalog.ts`. Prices are EGP and are loaded by the server
for every paid request; the browser never supplies an authoritative amount.

## Commercial catalog

| Offer | Model | Monthly | Yearly | One-time | Products | Orders/month | Team | Storage | Intended customer |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Free | subscription | 0 | 0 | — | 50 | 50 | 1 | 200 MB | trial/basic entry |
| Starter | subscription | 399 | 3,990 | — | 500 | 300 | 3 | 1 GB | small active seller |
| Growth | subscription | 749 | 7,490 | — | 2,000 | 1,500 | 10 | 5 GB | growing business |
| Business | subscription | 1,099 | 10,990 | — | 5,000 | 3,500 | 20 | 10 GB | operational team |
| Pro | subscription | 1,499 | 14,990 | — | unlimited | 10,000 | 50 | 20 GB | high-volume merchant |
| Lifetime | one-time | — | — | 4,999 | 1,000 | 5,000 | 5 | 5 GB | base-store ownership without recurring base fee |

Yearly prices are intentionally ten monthly payments, leaving two months of
effective annual discount without pretending that a one-time purchase is Pro or
unlimited.

## Canonical feature keys

Only these boolean keys are commercial entitlements:

- `quantityPricing`
- `variantInventory`
- `coupons`
- `analytics` (basic analytics, available on every offer)

Landing pages, sales links, products, orders, team members, and storage are
numeric quotas. Storefront, checkout, customer accounts, tracking, themes,
settings, notifications, tickets, and manual shipping are core capabilities.

The legacy flags `abandonedCart`, `advancedReports`, `customDomain`, `apiAccess`,
`removeBranding`, and `prioritySupport` remain typed only for historical read
compatibility and are forced to `false` by canonical sync/save paths. They are
not marketed or granted as current features.

| Feature | Free | Starter | Growth | Business | Pro | Lifetime |
| --- | --- | --- | --- | --- | --- | --- |
| Core storefront/products/orders/customers | YES (limited) | YES | YES | YES | YES | YES |
| Basic analytics | YES | YES | YES | YES | YES | YES |
| Product variants | NO | YES | YES | YES | YES | YES |
| Quantity pricing | NO | NO | YES | YES | YES | NO |
| Coupons | NO | YES | YES | YES | YES | YES |
| Landing pages | 0 | 1 | 5 | 10 | 20 | 3 |
| Sales links | 0 | 10 | 50 | 100 | unlimited | 50 |
| Team members | 1 | 3 | 10 | 20 | 50 | 5 |
| Storage | 200 MB | 1 GB | 5 GB | 10 GB | 20 GB | 5 GB |
| Custom domain/API/advanced reports/priority support | NO | NO | NO | NO | NO | NO |

## Enforcement contract

Plans are platform-admin writable and publicly readable only as safe plan
metadata. Subscriptions, payments, snapshots, and purchase requests are
server-managed. `grantForStore()` resolves the active snapshot; product,
order, landing-page, sales-link, coupon, staff, and storage mutations enforce
limits or feature keys server-side. Product content edits use `updateProduct`;
direct client writes cannot add variants or quantity tiers. Existing paid
periods keep their snapshots when the live catalog changes.
