# OPENCODE AUDIT — M&K Store (Firebase v2)

Audit date: 2026-08-03
Branch: `opencode-repair-*`
Stack: Preact + Vite + Wouter + Firebase (Auth / Firestore / Functions / Storage / Hosting), Arabic-first RTL.

> This document describes the CURRENT architecture as inspected, the critical bugs
> found, and the fixes applied. It is the working reference for the repair.

---

## 1. Current Architecture

- **Frontend**: Preact 10 + Vite 8 + Wouter (hash-free client routing). Lazy-loaded route components via `src/shared/utils/lazy.tsx`.
- **State**: React context providers — `AuthProvider`, `StoreProvider`, `CartProvider`, `ToastProvider`, `ThemeProvider` (all under `src/shared/contexts/`).
- **Data**: Firestore client-direct reads/writes gated by `firestore.rules`, plus 6 callable Cloud Functions (`functions/src/index.ts`) for operations that need server authority (order creation, approval, impersonation, counters).
- **Auth**: Firebase Email/Password only. The `users/{uid}` document holds `role` + `storeIds` (not custom claims) so role changes apply immediately.
- **Storage**: `storage.rules` for product/store images.
- **Deploy**: Firebase Hosting (SPA rewrite to `/index.html`) + Functions (Node 20) + Firestore + Storage. `vercel.json` also present.

### Directory layout

```
src/
  shared/        contexts, hooks, services, types, UI kit, guards, routing, firebase
  merchant/      Merchant Dashboard pages (tenant-scoped)
  platform/      Platform Admin pages (platform-wide)
  store/         Customer storefront pages
  App.tsx        Route table (wouter)
functions/src/index.ts   Cloud Functions
firestore.rules          Security rules
scripts/                 seed scripts
```

## 2. Current Routes

| Path | Experience | Auth | Role |
|---|---|---|---|
| `/` | Public marketing landing page | No | — |
| `/login?role=platform|merchant|customer` | Login | No | — |
| `/register` | Merchant self-registration | No | — |
| `/register?plan=<id>` | Register preserving plan selection | No | — |
| `/forgot-password` | Password reset | No | — |
| `/platform/*` | Platform Admin (16 sub-routes) | Yes | `superAdmin` |
| `/dashboard/*` | Merchant Dashboard (17 sub-routes) | Yes | `merchant`/`staff` |
| `/store/:slug/*` | Customer storefront | No (customer optional) | — |

Routing is implemented in `src/App.tsx` with `ZoneRouter` for the two authenticated zones and a hand-rolled slug parser for the storefront.

## 3. Auth Flow

```
Firebase init → onAuthStateChanged → load users/{uid} doc → user resolved
→ role/storeIds resolved → route decision (ZoneRouter/Login redirect)
```

- Auth states: `LOADING`, `AUTHENTICATED`, `UNAUTHENTICATED`, `UNINITIALIZED` (AuthProvider).
- Login redirects: superAdmin → `/platform/`, merchant/staff → `/dashboard/`, customer → `/`.
- **BUG (P0)**: `users.active` is written `false` at registration, but **nothing enforces it** — a pending merchant can still sign in (Auth user is created enabled) and access `/dashboard`. Enforcement is missing in `ZoneRouter`, `Login`, and Functions.

## 4. Roles

Conceptual roles: `superAdmin`, `merchant`, `staff`, `customer`.

- `superAdmin` — platform-wide, /platform only.
- `merchant` — owner of `storeIds[]`, /dashboard with full store permissions.
- `staff` — member of a store, /dashboard **with per-route permission restrictions** (products:manage, orders:manage, customers:manage, reports:view, settings:manage, team:manage, coupons:manage, landing:manage).
- `customer` — storefront account.

**BUG (P1)**: `ZoneRouter` lets `staff` into `/dashboard` with **no permission enforcement** — every staff member effectively has merchant-level access. There is no `permissions` field on the user document, no `RequirePermission` guard, and no backend permission checks for staff.

## 5. RBAC

- `src/merchant/pages/Roles.tsx` defines a static `ALL_PERMS` list and lets merchants create store-scoped `roles` docs with permission arrays.
- **Permissions are never enforced** at the route, UI, or backend level.

## 6. Multi-Tenancy

Tenant key = `storeId` on every scoped document. `useCollection`/`listDocs` scope queries by `storeId`. `canAccessStore(storeId)` in rules checks `users/{uid}.storeIds`.

**CRITICAL HOLES found (all fixed in this pass):**
1. `users` update rule allows a user to **self-modify `storeIds`** → a merchant could grant themselves access to any store.
2. `users` create rule lets a customer set arbitrary `storeIds`.
3. `stores` create rule lets any merchant create a store doc client-side.
4. `createOrder` callable **does not verify each product belongs to the order's `storeId`** → cross-tenant stock corruption possible.
5. `subscriptions` write rule lets a merchant flip their own subscription status.

## 7. Sales Links

- `StoreSlugLoader` reads `?ref=` and stores it in `sessionStorage['mk_sales_ref']`.
- `StoreLink` docs: `{ storeId, code, title, active, visits }`; created via Merchant Dashboard `/dashboard/store-links`.
- `createOrder` accepts `salesLinkRef`, looks up the store link by `storeId+code`, and increments `ordersCount`/`totalRevenue`.
- **BROKEN**: Checkout never reads `sessionStorage['mk_sales_ref']` and never sends `salesLinkRef` → attribution is never persisted to orders.
- **MISSING**: visit counting (a visit via a sales link is never recorded).
- **MISSING**: the sales-link analytics (orders / revenue / conversion) are not surfaced in the Merchant Dashboard.

## 8. Plans / Subscriptions

- `plans` collection: `{ name, priceMonthly, priceYearly, productLimit, orderLimitPerMonth, features, active }`. Platform Admin CRUD at `/platform/plans`.
- Landing pricing is DB-driven (`useCollection('plans')`) **but falls back to hardcoded fake plans** (0 / 99 / 299) when the collection is empty → violates "do not invent pricing".
- Registration flow: landing → `/register?plan=<id>` → `registerMerchant(planId)` → `subscriptions` doc created with `status:'pending'` → Platform Admin approves via `approveSubscription`.
- `approveSubscription` enables the Auth user + sets `users.active=true` + writes `expiresAt`.

## 9. Landing Page

- `src/platform/pages/LandingPage.tsx` + `LandingPage.css`.
- Sections: Navbar, Hero (contains **fabricated stats** "1,240 زيارات / 83 طلب / 47,520 ج.م"), Features, How-it-works, Dashboard showcase (**fabricated stats**), Sales-links showcase (**fabricated stats**), Pricing, FAQ, Final CTA, Footer.
- Footer contains placeholder links (`#faq` for الخصوصية/الشروط), nav uses `href="#features"` (task requires `/#features`).
- FAQ is not a real accessible accordion (pure conditional render).
- Layout is acceptable but does not meet the "modern premium SaaS, mobile-first, RTL" bar.

## 10. Merchant Dashboard

17 pages, all tenant-scoped by `storeId`. Dashboard shows real stats with proper empty states for charts. Product/order/customer pages exist and are functional.

## 11. Platform Admin

16 pages, platform-wide reads. Subscriptions approval, plans CRUD, merchants, orders, payments, reports, audit, etc. all present and functional.

## 12. Storefront

Store landing, catalog (search + category filter), product detail (variants), cart, checkout, track, account, login. Track page is **broken** — it reads `orders` collection directly, which rules deny to guests/customers.

## 13. Critical Bugs

| # | Severity | Description |
|---|---|---|
| B1 | P0 | Pending merchants can access `/dashboard` (no `active` enforcement; Auth user created enabled) |
| B2 | P0 | Self-modification of `users.storeIds` breaks multi-tenancy |
| B3 | P0 | `createOrder` doesn't validate product→store ownership (cross-tenant stock deduction) |
| B4 | P1 | Staff have unrestricted merchant access (no RBAC enforcement) |
| B5 | P1 | Order tracking (Track page) denied by rules — feature broken |
| B6 | P1 | Storefront slug parsing is brittle string handling (`split('/')` + `split('?')`) |
| B7 | P1 | Sales-link attribution never reaches orders; visits not counted |
| B8 | P2 | Landing page fabricates metrics and falls back to invented pricing |
| B9 | P2 | Merchant can self-manage subscription status via rules |

## 14. Security Risks

- Hardcoded fallback Firebase config in `src/shared/firebase/index.ts` (public API key — acceptable for Firebase web apps, but env overrides are preferred; `.env.example` placeholders exist).
- No plaintext passwords are stored in Firestore (verified — passwords only passed to `auth.createUser`/`signInWithEmailAndPassword`). `Subscription.adminPassword` type field is **unused** → removed.
- Impersonation has no exit flow / UI; stale `impersonatedBy` persists on the owner document.
- `createOrder` is callable by any signed-in or anonymous caller (COD model) — no rate limiting (documented, not fixed in this pass).

## 15. Duplicate / Obsolete Code

- `src/lib/firebase.ts` — thin re-export of `src/shared/firebase` (harmless; kept).
- `src/shared/components/guards/RequireRole.tsx` / `PublicOnly.tsx` — declared but unused in the route tree. `RequireRole` is superseded by `ZoneRouter`; kept for the API but `ZoneRouter` remains the source of truth.
- `Subscription.adminPassword` type field — unused, removed.
- `docs/*` legacy Postgres-era documents (DATABASE/DEPLOYMENT/MIGRATION) are historical, not imported by code.

## 16. Recommended Fixes (implemented)

**P0 — Security + Auth**
1. `registerMerchant`: create Auth user `disabled: true`; merchant only becomes able to sign in after `approveSubscription`.
2. Enforce `users.active` in `ZoneRouter` + Login (redirect pending merchants to a "pending approval" screen, never a loop).
3. Tighten `users` rules: forbid self-change of `role`/`storeIds`/`active`; customer create must have empty `storeIds` + `active:true`.
4. `createOrder`: verify each `product.storeId === order.storeId`; whitelist `paymentMethod`.
5. Restrict `subscriptions` writes to platform admin.
6. Restrict `stores` client create to platform admin (creation is callable-only).
7. Remove unused `adminPassword` type field.

**P1 — Routing / RBAC / Multi-tenancy**
8. `ZoneRouter` gains `active` enforcement + optional `permission` prop; per-route permission map for staff.
9. Add `permissions: string[]` to the `User` type + rules helper `canManage(storeId, perm)` used across scoped writes.
10. `updateOrderStatus`/`generateOrderNumber` enforce staff permissions server-side.
11. `trackOrder` callable for public order tracking; Track page uses it.
12. Clean slug/query parsing util for storefront routes.
13. `exitImpersonation` callable + impersonation banner/exit in dashboard.

**P7 — Sales Links**
14. Checkout reads `sessionStorage['mk_sales_ref']` and sends `salesLinkRef` to `createOrder`.
15. `recordStoreLinkVisit` callable (throttled per session) + called from `StoreSlugLoader`.
16. Merchant StoreLinks page shows visits / orders / revenue per link.

**P2 — Landing Page**
17. Full rebuild: DB-driven pricing (no invented fallback, professional empty state), no fabricated metrics in hero/showcases, real accessible FAQ accordion, correct `/#anchor` links, professional footer, modern indigo/violet RTL responsive design.
