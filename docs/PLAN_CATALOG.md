# Matjari plan catalog and entitlement matrix

This document is the local catalog contract used by `functions/src/planCatalog.ts`
and `src/shared/plans/catalog.ts`. Prices are EGP and are loaded by the server
for every paid request; the browser never supplies an authoritative amount.

## Commercial catalog

| Offer | Model | Monthly | Yearly | One-time | Products | Orders/month | Team | Storage | Intended customer |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Free (legacy) | archived subscription | 0 | 0 | — | 50 | 50 | 1 | 200 MB | grandfathered subscriptions only; no new registrations |
| Basic | subscription | 149 | 1,490 | — | 100 | 100 | 2 | 512 MB | new entry plan — 3 days trial |
| Starter | subscription | 249 | 2,490 | — | 500 | 300 | 3 | 1 GB | small active seller — 3 days trial of Starter entitlements |
| Growth | subscription | 399 | 3,990 | — | 2,000 | 1,500 | 10 | 5 GB | growing business; Most Popular — 3 days trial of Growth entitlements |
| Pro | subscription | 649 | 6,490 | — | unlimited | 10,000 | 50 | 20 GB | high-volume merchant — 3 days trial of Pro entitlements |
| Business (legacy) | archived subscription | 1,099 | 10,990 | — | 5,000 | 3,500 | 20 | 10 GB | historical subscriptions only; not purchasable — hidden from Landing |
| Lifetime | one-time | — | — | 4,999 | 1,000 | 5,000 | 5 | 5 GB | base-store ownership without recurring base fee — no trial, separate product |
| Enterprise / Custom | contact-only | — | — | — | — | — | — | — | custom scope, no fixed price, no trial, not a plan |

The public launch page presents **أسعار الإطلاق** monthly prices (149 / 249 / 399 / 649). Yearly catalog snapshots remain available to the billing backend and equal ten monthly payments (1,490 / 2,490 / 3,990 / 6,490). Lifetime is a separate product and approval flow.
No fake crossed-out prices are shown.

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

| Feature | Free legacy | Basic | Starter | Growth | Business | Pro | Lifetime |
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
periods keep their snapshots when the live catalog changes. Legacy active Free
subscriptions without an expiry remain grandfathered; existing Free trials preserve their stored `trialEndsAt`; new registrations receive a server-timed three-day trial of Basic/Starter/Growth/Pro
with that plan's entitlements (Lifetime and Enterprise have no trial). Intro trial is one per store
(`initialTrialPlanId`/`trialConsumed`); after it is consumed, switching plans never grants a new trial —
it creates a pending payment/activation request and expired trials require activation of the same or another paid plan
without fallback to Free. When any trial expires, merchant data and billing access remain available,
while operational mutations and storefront checkout require an approved paid upgrade. Business remains archived
and hidden from Landing, visible only for historical subscriptions.
