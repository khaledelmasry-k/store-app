# M&K Store — Final Delivery Report

**Date:** 2026-08-01
**Status:** Production-ready for Northflank deployment.

---

## 1. Summary

M&K Store is a multi-tenant e-commerce SaaS (customer storefront + merchant
dashboard + super-admin panel). This release finalizes the codebase to production
quality: **0 type errors, 0 lint errors**, PostgreSQL-only, CORS allow-list, hardened
security, atomic order handling, verified E2E, full documentation, and a
containerized deployment path.

---

## 2. What was fixed / delivered

### Bug fixes (Phase 1 audit)

**Server**
- `store.ts`: public tracking no longer leaks customer PII; order creation is an
  atomic transaction (order + stock deduction) that rejects products not belonging to
  the store and validates attribution fields (`sellerId`, `landingPageId`,
  `marketingLinkId`) belong to the same store.
- `orderNumber.ts`: order numbers generated inside the transaction under a
  Postgres advisory lock — unique under concurrency (verified: 5 parallel orders →
  `ORD-00001..00006`, no collisions).
- `subscriptions.ts`: approval creates admins with a random one-time password (no
  hardcoded `password123`); fixed username whitespace regex and a bogus `seller` field.
- `config.ts`: fails fast outside development when `JWT_SECRET` is missing or known-weak.
- `permission.ts`: `getTenantRole` resolves the role scoped to the current tenant
  (no cross-tenant fallback); legacy owner fallback via `Store.adminId`.
- `product.ts` + `seller/products.ts`: plan-limit enforcement on product creation;
  `DELETE /` added for the admin product endpoint.
- `seller/storeLinks.ts`: slug uniqueness enforced on PATCH (409 on conflict).
- `auth.ts` register: single atomic transaction (admin + tenant + tenantUser + store +
  product + subscription); username conflict resolved automatically.
- `requireSuperAdmin`: re-verifies the role against the DB on each request (survives demotion).
- `orders.ts` + `seller/orders.ts`: stock restored on **CANCELLED** as well as RETURNED
  (verified E2E: cancel via seller route restored inventory).
- `analytics.ts`: fixed `item.price` → `item.unitPrice`.
- `reports.ts`: `csvSafe()` guards CSV formula injection and quotes all fields.
- `landingPages.ts`: `GET /public/:slug` moved before auth middleware.
- `customers.ts`: notes & segment now **persist** to the order table
  (new columns `merchantNote`, `segment`) instead of silently succeeding — verified E2E.

**Frontend**
- `MerchantProducts.tsx`: edit no longer JSON-parses already-parsed API fields
  (colors/sizes/variantStock/tiers/images were being wiped on save).
- `MerchantSettings.tsx`: settings save path corrected (`/settings/settings`).
- `StoreLinkRedirect.tsx`: attribution query built with `?` instead of `&`.
- `MerchantStoreLinks.tsx`: marketing link URL uses `/go/{slug}`.
- `Onboarding.tsx`: registration uses `${API_BASE}/auth/register` (works with `VITE_API_URL`).
- `CustomerStore.tsx`: cart line price computed live via tier pricing.
- `AdminSettings.tsx`: removed broken platform `admin` role option (created
  non-loginable accounts); admins are created as `super_admin`.
- `Landing.tsx`: dead `/admin/login` route → `/login`.
- `AdminProduct.tsx`: delete button now has error handling + correct redirect.
- Removed unused files: `AdminLogin.tsx`, `CustomerOrder.tsx`, `Sidebar.tsx.backup`.

### Infrastructure / delivery

- **CORS**: allow-list driven by `FRONTEND_URL` (defaults include localhost dev +
  `https://mk-store-app.web.app`); preflight (OPTIONS) handled; disallowed origins get
  no CORS headers (verified).
- **PostgreSQL only**: all SQLite references purged from code and docs.
- **Migrations**: committed migrations `0_init` + `add_customer_note_segment`.
- **`docker-compose.yml`**: PostgreSQL 16 + app with health checks and readiness gating.
- **Dockerfile/entrypoint**: fail-fast migrations + idempotent seed.
- **`.env`**: strong `JWT_SECRET` regenerated; `.env.example` covers all vars.
- **Quality**: `tsc` clean (root + server, incl. `--noUnusedLocals`), `npm run build`
  clean, oxlint 0 errors.
- **Docs**: new `README.md`, `docs/API.md`, `docs/DEPLOYMENT.md`, `docs/DATABASE.md`,
  `docs/PROJECT_STRUCTURE.md`; updated architecture/gap/readiness docs.

---

## 3. E2E verification (run against local Postgres)

| Scenario | Result |
| -------- | ------ |
| Super-admin login | ✅ |
| Merchant registration (atomic) | ✅ |
| CORS: allowed origin → headers, evil origin → none | ✅ |
| Create order (ref) + stock deduction | ✅ |
| Track order (no PII) | ✅ |
| Cancel order → stock restored (admin + seller routes) | ✅ |
| Concurrent orders → unique numbers (advisory lock) | ✅ |
| Customer segment + note persist & filter | ✅ |
| CSV export (BOM, quoted, injection-safe) | ✅ |
| Public landing page route (no auth) | ✅ |
| Plan limit enforced (FREE = 1 product) | ✅ |

Test data was cleaned up afterward; only the super admin (`admin`) remains.

---

## 4. Configuration needed before deploy

1. Set a strong `JWT_SECRET` (already generated locally; regenerate per environment).
2. Set `DATABASE_URL` to the Northflank PostgreSQL addon.
3. Set `FRONTEND_URL` to the deployed frontend origin(s) (or leave empty for same-origin).
4. Change the default super-admin password (`admin / admin123`) immediately after first login.
5. For >1 replica, mount a volume at `server/uploads` or move uploads to object storage.

---

## 5. Known limitations (non-blocking)

- Uploads are local filesystem only.
- `Role`/`Permission` tables are not wired; RBAC uses `tenant_users.role`.
- Analytics are simple counters (UTM attribution captured on orders).
- `exhaustive-deps` lint warnings are pre-existing and non-breaking.

---

## 6. Files changed (this release)

36 files modified, 4 removed, 10 added — including schema, routes, middleware,
frontend pages, deployment assets, and documentation (see `git diff` for detail).
