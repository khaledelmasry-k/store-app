# Migration Report — V1 (Express/Prisma/PostgreSQL) → V2 (Firebase SaaS)

## Summary

The V1 prototype — a production-hardened monolith on **Express + Prisma + PostgreSQL** (`commit 35b8e9c` on `master`) — has been **fully replaced** by a multi-tenant **Firebase SaaS**. There is **no in-place migration**: V2 starts from a clean Firestore because the legacy database contained only a super-admin placeholder and no production tenant data.

| Aspect              | V1 (removed)                         | V2 (this branch)                          |
| ------------------- | ------------------------------------ | ----------------------------------------- |
| Backend             | Express server (`server/`)           | 6 callable Cloud Functions (`functions/`) |
| ORM                 | Prisma (`prisma/schema.prisma`)      | Direct Firestore SDK                       |
| Database            | PostgreSQL 16 + SQLite fallback      | Cloud Firestore (Native)                   |
| File storage        | local `uploads/` dir + Dockerfile    | Cloud Storage                              |
| Auth                | JWT + bcrypt, custom `/api/auth/*`   | Firebase Auth (Email/Password)            |
| Deployment          | Docker (`docker-compose.yml`)        | `firebase deploy` (Hosting + Functions)   |
| Multi-tenancy       | Single-tenant per deploy, super admin| True multi-tenant via `storeId` + Rules   |

## What was deleted

- `server/` (Express app, Prisma client, routes, middleware, seed)
- `server/prisma/` (schema, migrations)
- `prisma/` (if separate), `server/Dockerfile`, `docker-compose.yml`, `server/entrypoint.sh`
- `src/pages/*` (31 legacy pages → replaced by three app zones)
- `src/components/Sidebar.tsx` (single nav → 3 isolated sidebars)
- `src/services/api.ts` (REST client → Firestore services)
- `src/types/index.ts` → `src/shared/types/index.ts` (expanded, 17 collections)
- `src/hooks/*`, `src/utils/*` (legacy) → `src/shared/hooks/*`, `src/shared/utils/*`
- `docs/*` (legacy prototype docs), `HANDOFF.md`

## Feature parity map

| V1 module (schema)            | V2 mapping (Firestore)                              |
| ----------------------------- | --------------------------------------------------- |
| `Admin` / `TenantUser` / Roles | `users` (`storeIds[]`, `role`) + `roles`            |
| `Tenant` / `Store`            | `stores`                                            |
| `Product`                     | `products` (variants, stock)                        |
| `Order` / `OrderItem`         | `orders` (created via `createOrder` function)       |
| `Seller`                      | store link (seller removed; per-store team instead) |
| `StoreLink`                   | `storeLinks`                                        |
| `LandingPage`                 | `landingPages`                                      |
| `Notification`                | `notifications`                                     |
| `Subscription` / `SubscriptionRequest` | `subscriptions` + `plans` (+ `approveSubscription`) |
| `SubscriptionRequest` approval| `approveSubscription` function (one-time password)  |
| `Role` / `Permission`         | `roles`                                             |
| — (new)                       | `customers`, `transactions`, `payments`, `coupons`, `shipping`, `tickets`, `auditLogs`, `analytics`, `addresses`, `wishlist`, `settings` |

## Behavioral changes

1. **Orders are function-only.** V1 let the REST API create orders directly; V2 denies `orders.create` in rules and routes all order creation through `createOrder`, which enforces stock consistency with a transaction. Order numbers are globally unique (`ORD-00012`) via a transactional counter.
2. **Registration is async.** `registerMerchant` writes `users`+`stores`+`subscriptions` then creates the Auth user. The account stays inactive until a platform admin runs `approveSubscription` (which also sets a one-time password). This replaces V1's immediate super-admin provisioning.
3. **Stock is restored on cancel.** V1 restored stock on the admin/seller cancel route; V2 centralizes it in `updateOrderStatus`, which restores both product and variant stock on transition to `CANCELLED`/`RETURNED`.
4. **Analytics are denormalized.** V1 computed dashboards by querying orders server-side (heavy). V2 keeps a daily `analytics/{storeId}_{date}` doc updated by the order transactions — compatible with Spark's read limits.
5. **No scheduled jobs.** V1 used cron-like flows; V2 relies on write-time aggregation to stay within the Spark Free Plan.

## Verification

| Check                          | Result                                   |
| ------------------------------ | ---------------------------------------- |
| `tsc -b --noEmit` (frontend)   | 0 errors                                 |
| `npm run build`                | ✓ (code-split: firebase / wouter / preact vendor chunks) |
| `npm run lint`                 | 0 errors (warnings: exhaustive-deps only) |
| `functions/tsc --noEmit`       | 0 errors                                 |
| Firestore rules                | ✓ store-isolation via `storeId`          |
| Emulator smoke                 | `firebase emulators:start` boots all 6 services |

## Upgrade path (Spark → Blaze)

When daily write volume approaches the 20k Spark limit:
1. Upgrade to **Blaze**.
2. Add a scheduled `computeDailyAnalytics` function and stop incrementing the live `analytics` doc on every order.
3. Enable **App Check** (reCAPTCHA) to block abusive clients.
4. Add per-IP/per-uid rate limiting counters on `createOrder`.
