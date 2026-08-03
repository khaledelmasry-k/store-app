# M&K STORE — FINAL ARCHITECTURE AUDIT

> Phase 0 deliverable — repository inspection only. **No source code was modified.**
> Evidence: source inspection, route tracing, auth flow tracing, Firebase security rules,
> callable functions, data models, live Firebase Emulator + headless Chrome verification.
> Tags: `[VERIFIED]` = confirmed by live browser/emulator test · `[INSPECTED]` = confirmed by code reading.

---

## 1. Current architecture

Firebase-only, serverless SPA. **No backend HTTP server exists in the running app.**

- **Frontend:** Preact 10 + Vite, Wouter client routing, Arabic-RTL (`dir="rtl"`), shared UI kit
  (`Button`, `Input`, `Select`, `Card`, `Badge`, `EmptyState`, `Loading`, `ToastViewport`) in `src/shared/components/ui/`.
- **Backend:** Firebase Auth + Firestore + 9 `onCall` Cloud Functions (`functions/src/index.ts`, 542 lines) + Hosting + Storage.
- **Data access:** client SDK listeners (`onSnapshot`) for reads; callable functions for privileged writes
  (register, approve subscription, create order, update order status, impersonate, track, sales-link visits).
- **Deployment:** `firebase.json`, `vercel.json`, `.env.production` (untracked), `.firebaserc`.
- **Legacy removed (not yet committed):** the entire `server/` (Express + Prisma/PostgreSQL) tree, the old
  flat `src/pages/*`, and dozens of legacy docs are deleted in the working tree (148 files, −23,374 lines) but
  **not yet committed**.

---

## 2. Current routes (`src/App.tsx`)

### Public
| Route | Component | Notes |
|---|---|---|
| `/` | `HomeRedirect` → `PlatformLanding` | Always renders landing for unauthenticated; redirects by role if authenticated `[VERIFIED]` |
| `/login` | `LoginByRole` | `?role=platform\|merchant\|customer`, reads `window.location.search` `[VERIFIED]` |
| `/register` | `Register` | Plan-aware (`?plan=ID`) `[VERIFIED]` |
| `/forgot-password` | `ForgotPassword` | `[VERIFIED]` |
| `/privacy` `/terms` `/contact` | `InfoPage` | Static RTL pages `[VERIFIED]` |
| `/features` `/pricing` `/faq` | — | **NOT standalone routes.** These are anchors on `/` (`/#features`, `/#pricing`, `/#faq`) `[INSPECTED]` |

### Super Admin `/platform/*` (`ZoneRouter` role `superAdmin`, `PlatformLayout`)
`/`, `/merchants`, `/stores`, `/stores/:id`, `/products`, `/orders`, `/orders/:id`, `/customers`,
`/subscriptions`, `/plans`, `/payments`, `/transactions`, `/coupons`, `/reports`, `/tickets`,
`/audit`, `/notifications`, `/settings` — all render `[VERIFIED]`.

### Merchant `/dashboard/*` (`ZoneRouter` role `merchant` + `staff`, `MerchantLayout`)
`/`, `/products`, `/categories`, `/orders`, `/orders/:id`, `/customers`, `/coupons`, `/shipping`,
`/reports`, `/analytics`, `/team`, `/roles`, `/landing-pages`, `/store-links`, `/notifications`,
`/tickets`, `/subscription`, `/settings` — all render `[VERIFIED]`.
**Missing from spec:** `/dashboard/stores` (multi-store) and `/dashboard/inventory` are **not implemented** `[INSPECTED]`.

### Storefront `/store/:slug/*` (`StoreSlugLoader` + `StoreLayout`)
`/`, `/catalog`, `/product/:id`, `/cart`, `/checkout`, `/track`, `/account`, `/login` `[INSPECTED]`.

### Redirect/guard behavior (`ZoneRouter.tsx`)
- Not initialized → `<Loading/>` (never blank) `[VERIFIED]`
- Unauthenticated → `/login?role=platform|merchant`
- Wrong role → redirect to own zone (`superAdmin`→`/platform/`, merchant/staff→`/dashboard/`)
- `users.active === false` (non-admin) → "الحساب قيد المراجعة" gate `[VERIFIED]`
- Staff + declared permission → `ROUTE_PERMISSIONS[route]` enforcement, else "صلاحيات غير كافية" `[VERIFIED]`

---

## 3. Current roles

| Role | Definition | Home after login |
|---|---|---|
| `superAdmin` | Platform operator | `/platform/` |
| `merchant` | Store owner (tenant holder via `storeIds`) | `/dashboard/` |
| `staff` | Merchant employee | `/dashboard/` |
| `customer` | Shopper | storefront / `/` |

`[INSPECTED]` `src/shared/types/index.ts`, `ROLE_LABELS`.

---

## 4. Current permissions

Coarse permission strings (`src/shared/utils/constants.ts`):

```
products:manage  orders:manage  customers:manage  reports:view
settings:manage  team:manage    coupons:manage     landing:manage
```

- `ROUTE_PERMISSIONS` maps merchant routes → permission; staff must hold it, merchants pass implicitly.
- **Verified:** staff with only `products:manage` can open products, is denied orders ("صلاحيات غير كافية") `[VERIFIED]`.
- **Spec gap:** the spec wants finer-grained perms (`products.view/create/edit/delete`, `orders.view/update_status`, etc.).
  Current model is per-module (`*:manage`) — coarse but functional. Fine-grained split is a Phase-1 decision.

---

## 5. Current Firestore collections

`users`, `stores`, `products`, `categories`, `orders`, `customers`, `subscriptions`, `transactions`,
`payments`, `coupons`, `shipping`, `plans` (global), `notifications`, `tickets`, `auditLogs`, `settings`,
`analytics`, `storeLinks`, `landingPages`, `team`, `roles`, `invitations`, `addresses`, `wishlist`,
plus sub-collection `stores/{id}/counters/orders` (order numbering).

`firestore.rules` (280 lines) enforces:
- tenant scoping via `canAccessStore(storeId)` = `users{uid}.storeIds.hasAll([storeId])`
- write gating via `canManage(storeId, perm)`; `plans`/`settings` admin-only; `orders.create = false` (callable-only);
  `auditLogs.write = false`; users cannot self-change `role`/`storeIds`/`active` `[INSPECTED]`.

---

## 6. Current callable functions (`functions/src/index.ts`)

| # | Function | Authz | Purpose |
|---|---|---|---|
| 1 | `generateOrderNumber` | unauthenticated-safe (concurrency-guarded) | unique `ORD-NNNNN` |
| 2 | `createOrder` | guest-allowed | atomic stock deduction + order creation + customer upsert + **server-side sales-link attribution** |
| 3 | `registerMerchant` | guest-allowed | atomic user + store + pending subscription creation; Auth user created `disabled:true` |
| 4 | `approveSubscription` | `superAdmin` only | enables Auth user + `users.active=true`, sub→`active`, 30-day `expiresAt`, notification |
| 5 | `updateOrderStatus` | `superAdmin` or store `orders:manage` | status transitions + stock restore on cancel/return + analytics |
| 6 | `impersonate` | `superAdmin` only | custom token for merchant owner + `impersonatedBy/Until` 15-min markers |
| 7 | `exitImpersonation` | authenticated owner | clears markers, writes audit log |
| 8 | `trackOrder` | guest | public order lookup scoped to store + phone (safe subset) |
| 9 | `recordStoreLinkVisit` | guest | increments `visits` only when `storeId`+`code` match; silent on mismatch |

---

## 7. Current auth flow

`AuthProvider` → `onAuthStateChanged` + `users{uid}` doc → `state: Loading/Unauthenticated/Authenticated` (+ role + `active`).
`Login` (`LoginByRole`) → role-specific screen → on `user` present auto-redirects by role; disabled accounts show
"الحساب قيد المراجعة"; **never leaves user on login page after success** `[VERIFIED]`.

Registration (`registerMerchant`): account is created **disabled** + `users.active:false` + subscription `pending`;
login is impossible until `approveSubscription` runs. End-to-end verified via emulator: register → pending →
admin approves → merchant logs in `[VERIFIED]`.

---

## 8. Current merchant flow

`MerchantLayout` sets the tenant: `storeIds[0]` (single-store assumption) → `AppShell` (nav filtered by permission).
Merchant workspace pages verified rendering `[VERIFIED]`.
**Gaps:** no multi-store list/switch/create UI (spec §3, §12); no `/dashboard/stores`; no `/dashboard/inventory`;
onboarding after approval drops the merchant straight into the dashboard with no guided setup (spec §12).

---

## 9. Current Super Admin flow

`PlatformRoutes` under `PlatformLayout`. Platform dashboard is **KPI-focused** (merchants/stores/subscriptions/revenue),
with professional empty states — no fake customer rows `[VERIFIED]`.
`/platform/stores` aliases the merchants view (`<PlatformMerchants/>`), `/platform/stores/:id` → `StoreDetails` `[INSPECTED]` (working-tree fix, uncommitted).
**Overlap with spec:** the platform nav still lists merchant-operational modules (`/products`, `/orders`, `/customers`,
`/transactions`) as first-class platform sections. Spec §2 says Super Admin should manage the platform and inspect a
merchant only via "View Store / Open Merchant / Impersonate", not by operating merchant modules from the platform nav.
This is the main role-separation correction to plan.

---

## 10. Current storefront flow

`StoreSlugLoader` resolves `slug`, captures `ref` → `parseStoreLocation`; store context feeds Catalog/Product/Cart/Checkout/Track/Account.
Checkout calls `createOrder` (callable). Order confirmation + track flow implemented `[INSPECTED]`.
**Not yet exercised live end-to-end** (product → cart → checkout → order) — Phase (P6).

---

## 11. Current sales-link flow

1. Merchant creates link → `storeLinks{storeId, code, visits, ordersCount, totalRevenue}` (`StoreLinks.tsx` `[VERIFIED]` creation works).
2. Customer opens `/store/:slug?ref=CODE` → `StoreSlugLoader` persists `sessionStorage['mk_sales_ref']` + calls
   `recordStoreLinkVisit` (validates storeId+code server-side, increments `visits` once/session) `[INSPECTED]`.
3. `Checkout` reads the session ref and passes `salesLinkRef` → `createOrder` re-validates `storeId`+`code`
   **server-side** in a transaction and, only when found, increments `ordersCount`/`totalRevenue`; order stores `salesLinkRef` `[INSPECTED]`.
4. Merchant dashboard shows per-link visit/order/revenue via the Store Links page + sales-link performance card `[VERIFIED] rendering`.

**Design already matches spec §8** (server-side validation, attribution on the order, not just visits).
Remaining work is the live end-to-end test (visit→checkout→attribution→KPIs).

---

## 12. Current subscription flow

`/register?plan=ID` → plan banner → `registerMerchant` (user disabled + store + sub `pending`) → login blocked →
`/platform/subscriptions` approve/reject (callable `approveSubscription`) → user enabled → merchant logs in `[VERIFIED]`.
`plans` are DB-driven (`plans` collection, `active` filter) — **not hardcoded** `[VERIFIED]` (بداية / احترافية / مؤسسات render).
No online payment gateway: `payments`/`transactions` are platform-managed documents; approval sets a hardcoded 30-day `expiresAt`.
No renewal/expiry job yet.

---

## 13. Duplicate / legacy files

| File/area | Status | Used by | Safe to delete? | Reason |
|---|---|---|---|---|
| `server/**` (Express+Prisma/PostgreSQL) | Deleted in working tree, uncommitted | none (stack is Firebase-only) | **YES** (commit the deletion) | Legacy stack, superseded |
| `src/pages/*` old flat pages (Landing, Admin*, Merchant*, PublicPricing, Seller*, Onboarding, CustomerStore…) | Deleted in working tree, uncommitted | none | **YES** (commit the deletion) | Superseded by `src/platform|merchant|store/pages` |
| `src/components/*` (Sidebar, NotificationBell) | Deleted, uncommitted | none | **YES** | Superseded by AppShell/layouts |
| `src/services/api.ts`, `src/types/index.ts`, `src/preact-shims.d.ts` | Deleted, uncommitted | none | **YES** | Legacy |
| `docs/` legacy stitch/plan/report files | Deleted or rewritten | none | **YES** | Redundant historical prompts |
| `/platform/transactions` | `App.tsx:34` imports `./platform/pages/Payments` | platform nav "المعاملات" | **Consolidate** | Two routes render the same page (المدفوعات) |
| `/platform/stores` | `App.tsx:115` aliases `<PlatformMerchants/>` | platform nav "المتاجر" | **Keep, formalize** | Was a dead route; alias added in working tree (uncommitted) |
| `.env.production` | Untracked | deploy | **Verify secrets** | Must never be committed |
| New audit docs (`ARCHITECTURE_AUDIT.md`, `ROUTE_MAP.md`, `ROLE_MATRIX.md`, `PERMISSION_MATRIX.md`, `SECURITY.md`, `ROUTING.md`, …) | Untracked | documentation | **Consolidate in Phase 8** | Overlapping content; keep one canonical set |

> `docs/LEGACY_CLEANUP.md` (with FILE / STATUS / USED BY / SAFE TO DELETE? / REASON) is created during Phase 8, after the deletions above are committed and every reference confirmed gone.

---

## 14. Broken / non-functional flows

| # | Finding | Evidence | Severity |
|---|---|---|---|
| B1 | `/features`, `/pricing`, `/faq` are not real routes — anchors only | `App.tsx` has no such routes; landing uses `/#…` | Medium (spec §7) |
| B2 | Merchant multi-store UI missing; `MerchantLayout` hardcodes `storeIds[0]` | `MerchantLayout.tsx:14-15` | High (spec §3, §12) |
| B3 | No `/dashboard/inventory` page | nav + routes lack it | Medium (spec §3) |
| B4 | Platform nav exposes merchant-operational modules (products/orders/customers/transactions) instead of inspect/impersonate-only | `NAV_ITEMS.platform` (`constants.ts:117-134`) | Medium (spec §2) |
| B5 | `/platform/stores` alias fix is **uncommitted** | working tree `App.tsx:115` | High (repo state) |
| B6 | Pricing cards show price + `productLimit` + `features` only; plan model has no `storesLimit`/`staffLimit`; spec asks for order/stores/staff/reports/sales-links/support rows | `SubscriptionPlan` (`types/index.ts:132-142`), `LandingPage.tsx:274-292` | Medium (spec §10) |
| B7 | No online payment/renewal: `approveSubscription` hardcodes 30-day expiry; no expiry job | `index.ts:344` | Medium (spec §11, §17) |
| B8 | Storefront checkout E2E + sales-link attribution **not yet tested live** | Phase gate | High (spec §19 G/I) |
| B9 | Impersonation flow implemented but **not browser-tested** | callables + AppShell banner | Medium (spec §17) |
| B10 | `sessionStorage['mk_sales_ref']` not cleared on a fresh non-ref session until checkout completes | `StoreSlugLoader` sets, `Checkout` removes | Low |
| B11 | Login screen after success historically could flash "تم تسجيل الدخول" — **current code auto-redirects and was verified to leave login** | `Login.tsx:32-47` `[VERIFIED]` | Resolved; keep regression test |
| B12 | Working tree contains a massive uncommitted legacy deletion (148 files, −23,374 lines) — repo is mid-migration | `git status` | High (repo state) |

---

## 15. Data-leakage risks

| # | Risk | Evidence | Priority |
|---|---|---|---|
| L1 | **Rules reads not permission-gated for store members.** `orders/customers` read = `isAdminOrStore` → any staff (even products-only) can read all store orders/customers at the DB layer; UI hides but rules allow | `firestore.rules:137-150` | High — add per-permission read gates |
| L2 | `stores.update` allowed to any store owner incl. flipping `active` (merchant could self-reactivate a suspended store) | `firestore.rules:114` | Medium |
| L3 | Storage cross-store protection relies on client-set `metadata.storeId` + Firestore doc rules (documented in `storage.rules`) | `storage.rules` | Medium |
| L4 | `storeLinks` / `coupons` / `categories` / `products` / `shipping` are public-read — by design (storefront), but ensure no PII is ever stored in them | `firestore.rules:122-179,236-239` | Low (design) |
| L5 | `orders` read in rules doesn't check `active`; a pending-approval merchant whose doc briefly exists could read own store data | `ZoneRouter` gates UI; rules gate only store membership | Low |
| L6 | No per-store encryption/segregation beyond rules + callable re-validation (createOrder validates `product.storeId === storeId`, trackOrder scoped to store) | `index.ts:142,476-479` | Mitigated — keep |

---

## 16. Recommended final architecture

Keep the Firebase/serverless design. Corrections, in dependency order:

1. **Repo hygiene** — commit the legacy deletion (server/, old pages, docs) so the tree matches reality; formalize `/platform/stores`.
2. **Role separation** — trim platform nav to platform modules (overview, merchants, stores, plans, subscriptions,
   payments, coupons, reports, notifications, audit, settings); make merchant operational modules (products/orders/customers…)
   **merchant-only**; give Super Admin deliberate inspect actions ("View Store" → `StoreDetails`, "Impersonate") instead of operating merchant modules.
3. **Authorization depth** — keep permission-based staff access (not role-equality); decide whether to split coarse `*:manage`
   into finer perms (spec §4) or keep module-level with explicit read-gating in rules (L1 fix either way).
4. **Multi-store + onboarding** — `MerchantLayout` reads selected store from `StoreProvider` (already exists) with a
   store switcher; `/dashboard/stores` page; guided onboarding (create store → add product → publish → copy URL → first sales link).
5. **Pricing & plans** — keep plans DB-driven; extend `SubscriptionPlan` with `storesLimit`, `staffLimit`, `orderLimitPerMonth`
   (already present), `supportLevel`; render the full spec row-set on `/pricing`; preserve `?plan=` through registration (already works).
6. **Subscriptions** — keep approval gate (no instant approval); add explicit reject, expiry handling, and later payment/renewal.
7. **Storefront & sales links** — keep the current server-side-validated attribution design; finish and lock with live E2E.
8. **Cleanup** — consolidate audit docs into one canonical set (`MK_FINAL_ARCHITECTURE.md` + `LEGACY_CLEANUP.md`).

---

## 17. Exact implementation phases

> After each phase: `typecheck` → `build` → `lint` → live-test affected routes → summarize → list remaining issues.
> Do not proceed past a blocking failure.

- **P0 — Audit** (this document). ✅ done, no code changed.
- **P1 — Repo hygiene + role separation + authorization**
  Commit legacy deletion; formalize `/platform/stores`; trim platform nav to platform-only modules; add inspect/impersonate actions;
  add permission-based read gates to rules (L1) and store `active` guard (L2). Test: Test matrix D/E/F/J/K/L.
- **P2 — Landing + pricing**
  `/` polish stays; add real `/pricing`, `/features`, `/faq`; extend `SubscriptionPlan` fields; full pricing rows; `?plan=` preserved.
  Test: matrix A/B/M; widths 1440/1280/390, no overflow.
- **P3 — Subscription/onboarding**
  Reject path + expiry handling; guided merchant onboarding (store name/slug → first product → publish → copy URL → first sales link).
  Test: matrix C→E + full register→approve→onboard loop.
- **P4 — Merchant dashboard**
  Multi-store `/dashboard/stores` + store switcher; inventory page; empty states; permission-filtered nav for staff.
  Test: merchant + staff on every merchant route; isolation J.
- **P5 — Super Admin dashboard**
  KPI-only with clean empty states; "View Store" + impersonate (live); remove merchant-operational modules from platform nav.
  Test: matrix D/K/L; inspect store via StoreDetails.
- **P6 — Storefront E2E**
  `/store/:slug` product → cart → checkout → order; track page; customer account. Test: matrix H/I (referral survival + attribution).
- **P7 — Sales links + attribution lock**
  Live E2E: create link → `?ref=` visit → checkout → order carries `salesLinkRef` + `storeLinks.ordersCount/totalRevenue` increments; merchant KPIs per person.
  Test: matrix G/H/I + conversion-rate display.
- **P8 — Cleanup + testing + deployment**
  `docs/LEGACY_CLEANUP.md` (FILE/STATUS/USED BY/SAFE TO DELETE?/REASON); delete confirmed-unused files; consolidate audit docs;
  full matrix A–O regression; build/typecheck/lint; deployment prep.

---

## Appendix — Spec compliance quick map

| Spec item | Status |
|---|---|
| §2 Super Admin not a merchant / no merchant operational nav | **Needs P1/P5 correction** (currently platform nav still lists products/orders/customers) |
| §3 Merchant multi-store | **Missing UI** (P4) |
| §4 Staff permission-based (not role-equality) | **Present** (coarse perms); fine-grained split optional (P1) |
| §5 Landing on `/` for unauthenticated | **Present & verified** |
| §6 Auth redirect by role, never stuck on login | **Present & verified** |
| §7 Route map (`/pricing` etc.) | **Partial** — add `/pricing`, `/features`, `/faq` (P2) |
| §8 Sales-link server-side validation | **Present** (createOrder validates storeId+code); E2E pending (P7) |
| §9 Multi-tenancy in rules + callables | **Present**; read-gating gap (L1) |
| §10 DB-driven plans | **Present**; extend plan fields + full pricing rows (P2) |
| §11 Subscription approval flow | **Present & verified**; add reject/expiry (P3) |
| §12 Onboarding | **Missing guidance** (P3) |
| §13 Platform KPI dashboard, no fake data | **Present & verified** |
| §16 Legacy cleanup | **Pending** (P1 commit deletions; P8 doc + final delete) |
| §17 Known issues | Mapped in §14; remaining work tracked per phase |
| §19 Test matrix A–O | A–F, K–M largely verified; G–J (attribution), L live-impersonation pending |
