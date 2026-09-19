# Matjari — Master Audit Report (2026-09-18)

**Scope:** full-application static code audit (public marketing, auth, Super Admin/`/platform`, Merchant dashboard/`/dashboard`, public storefront/`/store/:slug`), Firestore/Storage rules, all 123 Cloud Functions callables, shipping architecture, and automated validation (typecheck/lint/build/tests).

**Method:** this is a **code-verified static audit**, cross-referenced against the emulator test suite where practical. It is not a full manual visual/responsive pass in a live browser across the 7 requested breakpoints — see the explicit **Coverage & Limitations** section before treating Phases 3/4/12 as complete. Every issue below cites exact `file:line` evidence; nothing is reported from documentation claims alone (the project's own `docs/*.md` were found to be significantly stale and are treated as unverified claims, not ground truth — see **Documentation staleness**).

**No fixes were applied.** No destructive action was taken against any data. All verification ran against source code and the local Firebase emulator only.

---

## Top-line numbers

```
TOTAL_ROUTES              = 64   (13 public/top-level incl. dev+fallback, 21 platform, 20 merchant, 10 storefront)
TOTAL_SCREENS_REVIEWED    = 56   (24 platform, 11 storefront + 4 shared storefront components, 5 auth/public, [merchant: pending — see note])
PUBLIC_SCREENS            = 5    (Landing, Login, Register, ForgotPassword, VerifyEmail/EmailActionHandler, + InfoPage/legal, ShippingPartnerApply)
MERCHANT_SCREENS          = pending (deep-dive in progress at time of writing; ~20 routes registered, see Route Inventory)
SUPER_ADMIN_SCREENS       = 24
STOREFRONT_SCREENS        = 11 (+4 shared components)
```

> **Note on merchant coverage:** the merchant-dashboard deep-dive (Products, Orders, Customers, Coupons, Shipping UI, Settings, Subscription, Team/Roles, CRM, Analytics, Landing Pages, Store Links, Tickets — ~20 routes, 57 files) was still running at the time this report was compiled. Everything else in this document is complete and final. The merchant section will be appended as **Addendum A** the moment it lands; do not treat the absence of merchant-specific P0/P1 findings here as "merchant is clean" — it is simply not yet reported.

---

## Coverage & Limitations (read this before acting on Phase 3/4/12 items)

- **Functional/business-logic/security/tenant-isolation/shipping/backend audit: thorough**, code-verified, cross-checked against the emulator test suite.
- **Responsive audit (Phase 4):** NOT performed as a live browser pass at 360/390/768/1024/1366/1440/1920px. The project *does* have an automated `responsive.spec.ts` Playwright spec (part of `playwright.emulator.config.ts`'s `mobile-360`/`mobile-390`/`mobile-430` projects), which is running as part of the background full-suite validation started during this audit (see **Automated Validation**) — but no human/agent visual inspection at the other requested breakpoints (768/1024/1366/1920) was done. Treat Phase 4 as **open**, not verified.
- **Visual/UI polish audit (Phase 3) and accessibility (Phase 12):** covered only at the static-code level (aria-labels, focus management, contrast via CSS, error/empty/loading state *existence* in code) — not a rendered/screen-reader pass. See **Code Quality / Accessibility** section for what was actually checked.
- **Recommendation:** if a true visual/responsive pass is wanted, run it as a dedicated follow-up (Playwright screenshot diffing across the 7 breakpoints, or a live browser-automation pass) — this report's findings are a necessary prerequisite (fix the functional dead-buttons first; a visual pass over broken functionality wastes effort).

---

## Documentation staleness (read this once, applies everywhere)

`README.md`, `docs/SECURITY.md`, `docs/PERMISSION_MATRIX.md`, `docs/ROLE_MATRIX.md`, `docs/ROUTE_MAP.md`, `docs/CHANGELOG.md`, and `docs/ARCHITECTURE_AUDIT.md` all describe an earlier, much smaller version of this system (e.g. **"six callable functions"** — the codebase now has **123**; **16/17/8 pages** for platform/merchant/storefront — actual is **21/~20/11**; "staff granular permissions... not yet wired into route/component-level guards" — **it is wired**, both client (`ZoneRouter`) and server (`firestore.rules` `hasAnyPermission`), and is actually *more* correct than the docs claim). `docs/FULL_SYSTEM_AUDIT_2026-08-29.md` is only 3 weeks old but already stale on shipping (marked external carriers `NOT_IMPLEMENTED`; a real webhook endpoint, 4 live adapters, and a shipping-partner marketplace now exist) and on WhatsApp/CRM/Promotions (all `NOT_IMPLEMENTED` in that doc; all now implemented).

**This is not a documentation-nitpick aside** — it means anyone (human or AI) who trusts these docs for a security or scope decision will be wrong. **Recommendation: regenerate all of the above from current source before relying on them again**, ideally with a CI check that fails when `App.tsx`'s route count or `index.ts`'s callable count drifts from what's documented.

---

## Route Inventory (code-verified against `src/App.tsx`, not filenames)

### Public / top-level (13)

| Route | Auth | Component | Status |
|---|---|---|---|
| `/` | No | `HomeRedirect` → `LandingPage` (signed-in users auto-redirect to their zone) | Working |
| `/login` (`?role=platform\|merchant\|customer`) | No | `LoginByRole` → `Login` | Working |
| `/register` | No | `Register` | Working |
| `/forgot-password` | No | `ForgotPassword` | Working |
| `/verify-email` | Implicit (authenticated, pending verification) | `VerifyEmail` | Working |
| `/auth/action` | No | `EmailActionHandler` (Firebase verify/reset link handler) | Working |
| `/partners/shipping/apply` | No | `ShippingPartnerApply` | Working |
| `/privacy`, `/terms`, `/contact` | No | `InfoPage` | Working |
| `/__dev/firebase` | Dev-only | `FirebaseDiagnostics` | Working (excluded from prod build) |
| `/s/:code` | No | `StoreLinkRedirect` (sales-link short code) | Working |
| `/landing/:slug` | No | `StoreLanding` (merchant QuickBuy landing page) | Working |
| unmatched | — | `Redirect to="/"` | Working |

### Platform / Super Admin (21) — role `superAdmin`, gated by `ZoneRouter`

`/platform`, `/platform/merchants`, `/platform/crm`, `/platform/stores/:id` (`/platform/stores` redirects here), `/platform/products`, `/platform/orders`, `/platform/orders/:id`, `/platform/customers`, `/platform/subscriptions`, `/platform/subscriptions/:id`, `/platform/plans`, `/platform/promotions`, `/platform/payments`, `/platform/transactions` (redirects to `/payments`), `/platform/coupons` (renders `SubscriptionCoupons.tsx`), `/platform/reports`, `/platform/tickets`, `/platform/audit`, `/platform/notifications`, `/platform/settings`, `/platform/shipping-companies`, `/platform/shipping-revenue`, `/platform/shipping-companies/applications`, `/platform/shipping-companies/:id`.

5 of these (CRM, Promotions, and 3 shipping-company pages) are **not in `docs/ROUTE_MAP.md`** at all. `src/platform/pages/Coupons.tsx` exists but is **dead code**, not routed anywhere (see PLAT-08).

### Merchant (20) — role `merchant`/`staff`, gated by `ZoneRouter` + per-route permission key

`/dashboard`, `/dashboard/products` (`products:view`), `/dashboard/inventory`→redirect, `/dashboard/categories`, `/dashboard/orders`+`/:id` (`orders:view`), `/dashboard/customers` (`customers:view`), `/dashboard/crm` (`crm:view`, **new, undocumented**), `/dashboard/coupons` (`coupons:manage`), `/dashboard/shipping` (`settings:edit`), `/dashboard/reports`→redirects to `/analytics`, `/dashboard/analytics` (`reports:view`), `/dashboard/team` (`team:view`), `/dashboard/roles`→redirects to `/team`, `/dashboard/landing-pages` (`landing:manage`), `/dashboard/store-links` (`sales_links:view`), `/dashboard/notifications`, `/dashboard/tickets`, `/dashboard/subscription`, `/dashboard/themes` (**new, undocumented — theme editor split out of Settings**), `/dashboard/settings`.

Every merchant route carries a `permission` prop checked against `user.permissions[]` **both** client-side (`ZoneRouter`) and server-side (`firestore.rules` `hasAnyPermission`) — this is correctly wired, contradicting `docs/PERMISSION_MATRIX.md`'s stale claim otherwise.

### Storefront (10) — `/store/:slug/*`, no router-level auth gate (see AUTH-01)

`/store/:slug`, `/catalog`, `/product/:id`, `/cart`, `/checkout`, `/track`, `/account` (+ `orders/:id`), `/login`, unmatched→`StoreHome` silent fallback (no real 404, minor UX note).

---

## Severity-ranked findings

Global numbering by area prefix. **P0 = release/security/data-loss blocker. P1 = major functional issue. P2 = UX/business inconsistency. P3 = visual/polish.**

### P0

#### SHIP-01 — "Platform credential mode" for shipping partners is completely non-functional end-to-end
- **AREA:** Shipping / Backend — **ROUTE:** N/A (callables) — affects `/dashboard/shipping`, `/dashboard/orders/:id` ("create shipment"), automatic post-checkout shipment creation, `/platform/shipping-companies/applications` (approval flow)
- **ISSUE:** Every `shippingProviders` document has a `credentialMode` of `platform` (merchant-owned vault not required — this is **the schema default**, and it is exactly what `approveShippingPartnerApplication` (index.ts:5680) sets on every newly onboarded shipping partner). Commit `46f3fb8` ("allow platform API providers to create orders without per-store vault") patched the vault *requirement* out of only 2 of at least 6 code paths that gate on it — and, critically, **there is no platform-level credential store anywhere in the codebase to use instead**: no `defineSecret()` per provider, no platform-scoped vault document. Every adapter (`bosta.ts`, `wasla.ts`, `mega.ts`, `customCarrierX.ts`) reads `context.credentials` directly with no platform fallback, and throws/fails the instant it's null.
- **Patched (2 of 6):** `createOrder` (index.ts:1686-1699), `getShippingOptions` (index.ts:6133-6141).
- **NOT patched (still unconditionally require a per-store vault for any non-`manual` provider):**
  - `functions/src/shipping/service.ts:141-144` (`createShipmentForOrder`) — used by **both** the merchant "create/retry shipment" callable `createOrderShipment` (index.ts:6250) **and** the automatic outbox-driven creation on `order.confirmed`/`order.created` (index.ts:6557-6561). This is the actual shipment-creation code path.
  - `testShippingConnection` (index.ts:5960-5972)
  - `getShippingProviderLocationsHandler` (index.ts:6223-6226)
  - `shippingWebhook` signature verification (index.ts:6757-6759)
  - `downloadShipmentDocument` (index.ts:6457), `cancelExternalShipment` (index.ts:6490)
- **EXPECTED:** A `credentialMode: 'platform'` + `integrationType: 'api'` provider should work end-to-end (test connection, quote rates, create shipment, receive webhooks) using platform-managed secrets, with zero per-store vault entries.
- **ACTUAL:** Checkout rate-quoting will fail inside the adapter itself (null credentials → adapter throws `CONFIGURATION_ERROR`) the moment a real API call is attempted; if an order is somehow placed, **shipment creation always hard-fails** (`CONFIGURATION_ERROR: Shipping credentials are not configured`), marking the order `shippingCreationStatus: FAILED` forever; `testShippingConnection` reports `NOT_CONFIGURED`; inbound carrier webhooks are rejected (`Invalid webhook authorization`) because signature verification also needs a vault that doesn't exist. **Net effect: any shipping partner approved through the new marketplace flow — the newest revenue-generating feature in this codebase (commercial agreements, revenue-share settlement, `/platform/shipping-revenue`) — cannot fulfill a single real order today.**
- **ROOT_CAUSE:** `46f3fb8`'s commit message ("platform credentialMode uses server-managed secrets") describes a mechanism that was never built; the fix only suppressed 2 of 6 error checks gating on its absence.
- **AFFECTED_FILES:** `functions/src/shipping/service.ts:141-144`; `functions/src/index.ts:5960-5972,6223-6226,6757-6759`; `functions/src/shipping/bosta.ts:17-21` (and wasla.ts/mega.ts/customCarrierX.ts, same pattern).
- **FIX_RECOMMENDATION:** Either (a) finish the platform-credential mechanism — one `defineSecret`/structured platform-credential source per provider, threaded through all 6 gating points and every adapter's credential resolution — or (b) until (a) ships, make `credentialMode: 'platform'` require an admin-owned (not per-store) vault entry consistently everywhere, and disable/hide the "platform" option in `saveShippingProvider`'s admin UI. Do not leave a half-applied gating change in production.
- **RISK:** Silent, systematic order/shipment failure for a monetized, customer-facing feature; support load from confused merchants; already-collected commercial-agreement revenue projections (`/platform/shipping-revenue`) are built on shipment volume that can't currently be generated for platform-mode partners.
- **HOW_TO_VERIFY:** In the emulator, create a `shippingProviders` doc (`integrationType:'api'`, `slug:'bosta'`, `credentialMode:'platform'`, no `integrationCredentials` doc for any store), enable it for a test store, call `getShippingOptions` (expect opaque pricing failure), then `createOrderShipment` for an order using it (expect `CONFIGURATION_ERROR: Shipping credentials are not configured`).
- Independently corroborated by two separate passes of this audit (direct commit/call-site tracing, and full adapter-code reading) — high confidence.

---

### P1

#### AUTH-01 — Storefront account/order-history routes have no router-level auth gate
- **AREA:** Auth/Routing — **ROUTE:** `/store/:slug/account`, `/store/:slug/account/orders/:id`, `/store/:slug/orders/:id`
- **ISSUE:** `StoreRoutes` in `src/App.tsx:216-241` renders `StoreAccount`/`StoreOrderDetails` with **zero** router-level auth/role check — every other protected zone uses `ZoneRouter`; the storefront customer zone relies on the page component to self-guard.
- **EXPECTED:** Only an authenticated customer of this store can reach account/order-history content; unauthenticated visitors redirect to `/store/:slug/login`.
- **ACTUAL:** Protection (confirmed present and correct at the component level — see storefront section, `OrderDetails.tsx`'s ownership re-check) is ad hoc per-page, not centrally enforced, so a future page edit can silently drop it with no router-level safety net.
- **AFFECTED_FILES:** `src/App.tsx:216-241`.
- **FIX_RECOMMENDATION:** Wrap these two routes in a small `RequireCustomer` guard inside `StoreRoutes`, matching `ZoneRouter`'s pattern.
- **RISK:** Low today (component-level guard exists and was verified correct), but structurally fragile.
- **HOW_TO_VERIFY:** Log out, hit `/store/<slug>/account` directly — currently the page component itself redirects; confirm this stays true after any future edit.

#### SEC-1 — Read access to 13 sensitive per-store collections is not permission-gated, only store-membership-gated
- **AREA:** Firestore rules / RBAC — **AFFECTED COLLECTIONS:** `subscriptions`, `subscriptionPayments`, `subscriptionChangeRequests`, `storePurchaseRequests`, `transactions`, `payments`, `auditLogs`, `team`, `roles`, `invitations`, `analytics`, `storeLinks`, `landingPages`, `shipping` (zones/rates)
- **ISSUE:** These collections' `allow read` rules use the older `isAdminOrStore(storeId)` helper (any user whose `users` doc lists this `storeId`), **not** the newer permission-aware `canReadX`-style helpers already used correctly for `orders`/`customers`/`customerFollowUps`/`customerTimeline` (`canReadOrders`/`canReadCustomers`/`canReadCrm`).
- **EXPECTED:** A staff member invited with only e.g. `products:edit` should not be able to read the store's billing history, full audit trail, teammates' permission sets, or pending invitation tokens — matching the write-side granularity already implemented for these exact collections.
- **ACTUAL:** Any staff account, regardless of assigned permission, can query `subscriptions`/`payments`/`transactions`/`auditLogs`/`team`/`roles`/`invitations`/`analytics`/`storeLinks`/`landingPages`/`shipping` directly via the Firestore SDK from the browser console. This is **within-tenant over-privilege, not a cross-tenant leak** — storeId scoping itself is solid everywhere checked.
- **ROOT_CAUSE:** These `match` blocks predate the granular-permission read helpers and were never migrated.
- **AFFECTED_FILES:** `firestore.rules:345-381` (subscriptions/payments/transactions), `:410-418` (shipping), `:555-558` (auditLogs), `:571-574` (analytics), `:582-603` (storeLinks), `:609-617` (landingPages), `:623-647` (team/roles/invitations).
- **FIX_RECOMMENDATION:** Add `canReadBilling`/`canReadAudit`/`canReadTeam`/`canReadAnalytics`/`canReadShipping` helpers mirroring `canReadOrders`, gated on `settings:view`/`team:view`/`reports:view`/`sales_links:analytics` as appropriate, and swap into each `allow read`. Pure tightening — no legitimate access path is removed (merchant/platformAdmin already pass via `isMerchant()`/`isPlatformAdmin()` in the proposed helpers too).
- **RISK of the fix:** Low. **RISK of leaving as-is:** any staff hire, however narrowly scoped, can read the owner's most sensitive operational and financial data.
- **HOW_TO_VERIFY:** Emulator: create a staff user with only `products:edit`; sign in as them; `getDocs(query(collection(db,'auditLogs'), where('storeId','==',X)))` and similarly for `team`/`subscriptions`/`payments` — currently succeeds, should be denied.

#### PLAT-01 — Super Admin's "published" toggle on Store Details is a no-op that shows a false success toast
- **AREA:** Functional / Data-consistency — **ROUTE:** `/platform/stores/:id`
- **ISSUE:** `StoreDetails.tsx:60-74`'s `save()` writes `published`/`active` directly to Firestore via `storesService.update()`, bypassing the `setStorePublished` callable entirely. The actual storefront gate (`storePublicationStatus()`, index.ts:29-34, used by `getPublicStore`/`getPublicStoreStatus`) checks `storeStatus` **first**, and `storeStatus` is only ever written by `setStorePublished` (index.ts:4542). Every store has had `storeStatus` set since creation (`registerMerchant` sets it to `'draft'`).
- **ACTUAL:** Flipping the admin toggle shows "تم حفظ التغييرات" (saved successfully) but has **zero effect** on what the storefront actually shows, and `/platform/merchants`' own "النشر" column (which reads server-computed `storePublicationStatus`) will keep showing the pre-toggle value — a direct cross-screen contradiction inside the admin app itself.
- **AFFECTED_FILES:** `src/platform/pages/StoreDetails.tsx:60-74,175-183`; `functions/src/index.ts:29-34,2464,4525-4554,5534`.
- **FIX_RECOMMENDATION:** Route this toggle through `setStorePublished` (or an equivalent that also sets `storeStatus`), or make `storesService.update` special-case `published` to keep `storeStatus` in lockstep.
- **RISK:** Admin believes a store is published/unpublished when it isn't; no audit trail is written either (PLAT-03), so support can't reconstruct what happened. Not a privilege-escalation route — `firestore.rules` correctly blocks non-admins from touching these fields.
- **HOW_TO_VERIFY:** As superAdmin, flip a store's toggle whose `storeStatus` was already set by a real publish flow; call `getPublicStoreStatus({slug})` — status is unchanged.

#### PLAT-02 — Platform "Policies" settings (maintenance mode, registration toggle, store-per-merchant cap) are saved but read by nothing
- **AREA:** Fake/dead UI — **ROUTE:** `/platform/settings`
- **ISSUE:** `maintenanceMode`, `registrationEnabled`, `allowCustomerAccounts`, `maxStoresPerMerchant` are persisted to `settings/platform` but `grep -rn` across `functions/src/index.ts` and `src/` (outside the type declaration and `Settings.tsx` itself) returns **zero** read sites.
- **ACTUAL:** Toggling "وضع الصيانة" (maintenance mode) on does not lock the platform; disabling registration does not block `/register`; the store cap is never enforced in `registerMerchant`. The UI reports success on every save.
- **AFFECTED_FILES:** `src/platform/pages/Settings.tsx:25-32,59-60,116-118`; `src/shared/services/system.ts:114-117`; `src/shared/types/index.ts:1269-1274`.
- **FIX_RECOMMENDATION:** Implement the enforcement (check the flags in `registerMerchant`/login/storefront gates) or remove the controls.
- **RISK:** In a real incident, an admin flips "Maintenance Mode" expecting the platform to lock down — it does nothing. False sense of control during an emergency.
- **HOW_TO_VERIFY:** Toggle maintenance mode on; hit any storefront route or `/register` — nothing is blocked.

#### STORE-01 — "Add to cart" buttons on every product card (Home, Catalog, wishlist) have no click handler
- **AREA:** Broken functionality / dead button — **ROUTE:** `/store/:slug`, `/store/:slug/catalog`, wishlist tab
- **ISSUE:** Both "أضف للسلة" buttons on `StoreProductCard.tsx` (lines 62-67, 121-124 — hover quick-add overlay and mobile button) have **no `onClick`** at all. Only the full product-detail page (`Product.tsx`) wires a real `addToCart`.
- **ACTUAL:** Clicking either button does nothing — no cart update, no toast. This is the single most common commerce action surface in a storefront grid.
- **AFFECTED_FILES:** `src/store/components/StoreProductCard.tsx:62-67,121-124`.
- **FIX_RECOMMENDATION:** Wire a real handler (routing to the PDP or a quick-select popover for products with variants, since a card can't safely blind-add a product that requires size/color selection), or remove the buttons so the UI stops promising a capability it doesn't have.
- **RISK:** High — directly suppresses conversions on the primary browse surfaces.
- **HOW_TO_VERIFY:** Open any storefront home/catalog page, click "أضف للسلة" on a card — cart badge does not change, no toast.

#### STORE-02 — Category links from Home never actually filter the Catalog
- **AREA:** Broken navigation — **ROUTE:** `/store/:slug/catalog?cat=<id>`
- **ISSUE:** `Home.tsx:101,111` link to `catalog?cat=<categoryId>`, but `Catalog.tsx:23` initializes its `cat` filter as local `useState('')`, never reading the URL query param.
- **ACTUAL:** Clicking any category chip/circle on Home always opens the catalog unfiltered.
- **AFFECTED_FILES:** `src/store/pages/Catalog.tsx:23`; `src/store/pages/Home.tsx:101,111`.
- **FIX_RECOMMENDATION:** Initialize `cat` from `useSearch()` on mount (mirrors the pattern already used in `Account.tsx:40` for `tab`).
- **RISK:** Medium — degrades browse experience; customer can still manually filter once on the page.
- **HOW_TO_VERIFY:** Click a category chip on Home; Catalog shows "الكل", not the clicked category.

---

### P2

| ID | Area | Summary | File(s) |
|---|---|---|---|
| SEC-2 | Security (open since 08-29) | `inviteStaff` still returns a plaintext `initialPassword` in the callable response instead of an expiring invitation-acceptance link. | `functions/src/index.ts:7672` |
| RULES-01 | Firestore rules | `canAccessStoreOrAdmin()`/`isStoreStaff()` helpers grant access with **no storeId membership check** at all (any staff from any store would pass). Currently **dead code** — grepped, zero call sites — but a landmine: a future rule author who wires either in, trusting the name, creates a real cross-tenant leak. | `firestore.rules` (helper defs, unused) |
| PLAT-03 | Platform / Audit | `StoreDetails.tsx` and `Settings.tsx`'s direct-Firestore-write paths never call `auditLog(...)`, unlike equivalent callable-driven actions (`setStorePublished`, `suspendMerchant` do). `/platform/audit` is incomplete for admin-originated changes. | `src/platform/pages/StoreDetails.tsx:60-74`; `Settings.tsx:25-32` |
| PLAT-04 | Platform / UX-safety | No confirmation dialog on: impersonate-merchant (one click), deactivating a shipping provider platform-wide, approving/rejecting a paid subscription (3 separate implementations, only some confirm), accept/reject payment row-buttons. Inconsistent with the confirm pattern already used for merchant delete. | `Merchants.tsx:446`; `ShippingCompanies.tsx:526-536`; `Subscriptions.tsx:31-53`; `StoreDetails.tsx:76-87`; `Payments.tsx:143-153` |
| PLAT-05 | Platform / Scalability | `Products`, `Orders`, `Customers`, `Reports`, `Dashboard` (platform) fetch entire collections via `useCollection` with **no `limit`** — an unbounded real-time listener over the full cross-tenant collection, paginated only client-side after full download. | `src/platform/pages/{Products,Orders,Customers,Reports,Dashboard}.tsx` |
| PLAT-06 | Platform / Scalability | `getPlatformOverview` runs 5-6 full unindexed collection scans on every dashboard load/refresh — accurate (no stale cache, a real strength) but O(total platform data) per call. | `functions/src/index.ts:5452-5586` |
| CQ-01 | Backend architecture | Entire Cloud Functions backend is one 8422-line file (`index.ts`), no module boundaries except shipping/integrations. | `functions/src/index.ts` |
| CQ-02 | Type safety | 830 `any`/`as any` occurrences codebase-wide; `index.ts` alone has 220 (26%) — the callable-payload validation layer is the least-typed code. | `functions/src/index.ts` (concentration), also `Customers.tsx`, `wasla.ts`, `Shipping.tsx` |
| CQ-03 | Plan/subscription data integrity | `functions/src/planCatalog.ts` and `src/shared/plans/catalog.ts` are two independently-maintained full copies of the plan table (cannot share a module — separate TS projects). All numeric limits currently match, but `whatsappAutomation: false` exists on every plan in the **backend** copy and is **entirely absent** from the **frontend** copy. **Independently confirmed real** during this audit: the server enforces `canUseFeature(grant.plan,'whatsappAutomation')` (index.ts:3042,3119,3135, `resource-exhausted` if not entitled) — so the enforcement itself is safe — but the merchant UI has no field to read to show "not included in your plan" *before* the user hits that error, and any future plan-limit change to this pattern will silently diverge between UI and server with no automated check catching it. | `functions/src/planCatalog.ts`; `src/shared/plans/catalog.ts` |
| SHIP-02 | Shipping / Code quality | The "vault required only when `credentialMode` is `merchant`/`hybrid`" rule is reimplemented inline in 4+ places instead of one shared helper — literally how SHIP-01 happened (fixed in 2 places, forgotten in the others). | `index.ts:1689,6137`; `service.ts:141-144`; `index.ts:5969-5972,6223-6226` |
| STORE-03 | Storefront / Data correctness | `Account.tsx:55`'s `orders` query has no `storeId` filter (unlike the sibling `products` query on the same page, line 58) — a customer with orders at multiple Matjari stores sees their **full cross-store order history** on every store's account page. Not a cross-customer leak (still scoped to the signed-in user), and `OrderDetails.tsx`'s ownership check prevents opening an out-of-scope order, but it's a real data-correctness bug and unnecessary over-fetch. | `src/store/pages/Account.tsx:55` |
| STORE-07 | Storefront / Business logic | Checkout hardcodes `packageWeightKg: 1` for every order regardless of actual cart contents, sent to both the shipping-rate quote and `createOrderCallable`. Weight-based carrier pricing (Bosta/Wasla/Mega all support it) will misquote/undercharge bulk or heavy orders. | `src/store/pages/Checkout.tsx:58,144` |

### P3

| ID | Area | Summary |
|---|---|---|
| ROUTE-DOC-01 | Docs | `docs/ROUTE_MAP.md` stale — missing 5 platform + 2 merchant routes, wrong component names for `/platform/coupons`/`/platform/transactions`, lists `Reports`/`Roles` as live pages when they're now redirects. |
| GUARD-01 | Code quality | `RequireRole`/`PublicOnly` guard components are dead code (zero call sites) — not a security hole (ZoneRouter/StoreSlugLoader do the real gating) but pure maintenance debt. |
| PLAT-07 | Platform | Dashboard's "needs attention" panel doesn't remove a row after approving it (missing `refresh()` call) — reload required. |
| PLAT-08 | Platform / Dead code | `src/platform/pages/Coupons.tsx` (111 lines, direct-Firestore-write coupon manager) is unrouted dead code. |
| PLAT-09 | Platform | `Crm.tsx`'s `saveStage`/`handleAddNote`/`handleAddFollowUp` have no try/catch — a thrown error becomes a silent unhandled rejection, no toast. |
| PLAT-10 | Platform | "Approve subscription" logic duplicated 3 times independently (Dashboard/Merchants/StoreDetails) with inconsistent confirm/refresh behavior — root cause of PLAT-04/PLAT-07. |
| PLAT-11 | Platform | `Merchants.tsx` (579 lines) and `ShippingCompanies.tsx` (1577 lines) are oversized, multi-concern components. |
| PLAT-12 | Platform | `any` typing throughout newer CRM/promotions/shipping-partner-application UI and callable-response handling. |
| PLAT-13 | Platform | `submitShippingPartnerApplication` (public, unauthenticated by design) has input sanitization but no visible rate limiting/App Check — potential spam vector for the admin triage queue. |
| SHIP-03 | Shipping | `shipping/adapters/mega.ts` is a stray 1-line dead file; the real 168-line `mega.ts` lives one level up and is what's actually imported. |
| SHIP-04 | Shipping | No `functions/**/*.test.ts` unit tests exist for shipping; correctness relies entirely on e2e specs that don't exercise the `credentialMode`/vault-skip branches — exactly the class of bug SHIP-01 is. |
| CQ-04 | Accessibility | Shared `Modal.tsx` has no focus trap/restoration — Tab can escape a modal into the page behind it; closing doesn't return focus to the trigger. High-leverage fix since it's one shared component. |
| CQ-05 | Accessibility | 29 icon-only buttons rely on `title` instead of `aria-label` as their accessible name (weak AT/mobile support). |
| CQ-06 | Resilience | Only one global `ErrorBoundary` (around `<App/>`); a render exception in any chart (Dashboard/Analytics/Reports) blanks the entire zone instead of degrading locally. |
| STORE-04 | Storefront / Dead code | `Confirmation.tsx` is a complete, unrouted component — Checkout renders its own inline confirmation instead. |
| STORE-05 | Storefront | "تقييم الطلب" (rate order) button on delivered orders has no `onClick`. |
| STORE-06 | Storefront / Fake UI | "Related products" section is gated on a hardcoded empty array — can never render. |
| STORE-08 | Storefront | Catalog's zero-results "show all products" link is a same-route no-op (local filter state isn't URL-driven, so nothing resets). |
| STORE-09 | Storefront | `createOrderCallable` has no client-generated idempotency key — only a `loading` boolean guards the submit button; a fast double-tap on a slow network could race two submissions (server-side dedup not verified in this pass). |

---

## Automated Validation (Phase 14)

| Check | Result |
|---|---|
| `npm run typecheck` (`tsc -b --noEmit`) | **PASS** — 0 errors |
| `npm run lint` (oxlint) | **PASS** — 0 errors, ~55 warnings, all style/hygiene (unused vars, missing hook deps, one real `jsx-key` smell at `src/merchant/pages/Settings.tsx:317`) |
| `npm run build` (Vite production) | **PASS** — 2-3s, clean code-splitting, no oversized-chunk warnings |
| `npm --prefix functions run build` | **PASS** — clean |
| `e2e/integration-foundation.spec.ts` (emulator, desktop) — the suite covering vault/outbox/shipping-provider work from the recent commits | **PASS 10/10** — credential vault encryption/redaction/cross-tenant-block, shipment idempotency (duplicate events, duplicate webhooks), inventory restore on cancel/return, invalid-credential handling all verified green. Notably, none of these 10 tests exercise the `credentialMode: 'platform'` branch — consistent with SHIP-01 going undetected by existing tests. |
| Full 11-group / 4-viewport regression matrix (`scripts/verify-e2e-isolated.sh`) | **Launched during this audit, long-running** — first group (`emulator-core`) passed; remaining 10 groups were still executing at report time. Do not treat Phase 4 (responsive) as validated by this alone even once it finishes, since visual correctness ≠ functional pass. |
| `verify:visual`, `verify:wasla-rates`, `verify:shipping-commercial`, `verify:production-*` | **Not run** — require live carrier credentials, a visual baseline, or a production target; correctly out of scope for a no-deploy, no-live-credential audit. |

No test failures were found in anything actually run. No product-bug-vs-test-bug analysis was needed.

---

## Section index (per the requested format)

1. **Broken functionality:** STORE-01, STORE-02, PLAT-01, PLAT-02, SHIP-01
2. **Dead/non-working buttons:** STORE-01, STORE-05, PLAT-07 (stale, not dead, but effectively non-responsive), GUARD-01 (dead components, not buttons)
3. **Responsive problems:** not assessed live — see Coverage & Limitations
4. **UI inconsistencies:** PLAT-04 (confirmation dialogs), PLAT-10
5. **Backend/function problems:** SHIP-01, SHIP-02, CQ-01, CQ-02
6. **Firestore/security problems:** SEC-1, RULES-01
7. **Tenant isolation risks:** none found at the cross-tenant level (explicitly checked in shipping, security, and storefront passes); SEC-1 and STORE-03 are within-tenant/within-account issues, not cross-tenant
8. **Subscription/plan problems:** CQ-03, PLAT-10
9. **Product/inventory problems:** none found (product/variant/stock paths were checked incidentally via the shipping and storefront passes — cancel/return inventory restoration is tested and green; no dedicated merchant-catalog deep-dive yet, see Addendum A)
10. **Order/checkout problems:** STORE-07, STORE-09, SHIP-01
11. **Shipping problems:** SHIP-01, SHIP-02, SHIP-03, SHIP-04
12. **Super Admin problems:** PLAT-01 through PLAT-13
13. **Storefront problems:** STORE-01 through STORE-09
14. **Performance/code-quality problems:** CQ-01, CQ-02, PLAT-05, PLAT-06, PLAT-11, PLAT-12
15. **Missing tests:** SHIP-04; full regression matrix not run to completion at report time
16. **Features implemented in UI but not truly functional:** SHIP-01 (shipping-partner marketplace), PLAT-02 (platform policy toggles), PLAT-01 (publish toggle), STORE-01 (add-to-cart on cards), STORE-06 (related products)

---

## Counts

```
RELEASE_BLOCKERS      = 1   (SHIP-01)
HIGH_PRIORITY_FIXES   = 5   (AUTH-01, SEC-1, PLAT-01, PLAT-02, STORE-01, STORE-02)  [6 P1s, listed]
MEDIUM_PRIORITY_FIXES = 11  (SEC-2, RULES-01, PLAT-03..06, CQ-01..03, SHIP-02, STORE-03, STORE-07)
POLISH_ITEMS          = 18  (all P3s listed above)
```
(Counts will shift once Addendum A — merchant dashboard — is appended.)

---

## Recommended execution plan

### PHASE A — Critical correctness/security (do first)
- Fix SHIP-01 end-to-end (decide platform-credential mechanism or disable the option) — **HIGH complexity**, touches `service.ts` + 5 call sites in `index.ts` + all 4 adapters. Depends on a product decision (build real platform-credential storage vs. restrict to admin-owned vault).
- Fix SEC-1 (add `canReadX` helpers, swap into 13 collections' rules) — **LOW-MEDIUM complexity**, additive/tightening only, no legitimate access removed. Tests required: emulator rules tests with a narrowly-scoped staff account per affected collection.
- Fix STORE-01 (wire add-to-cart on product cards) — **LOW-MEDIUM complexity** (needs a variant-selection UX decision for products with options). Tests: e2e add-to-cart-from-grid spec.
- Fix STORE-02 (category filter from URL) — **LOW complexity**. Tests: e2e nav-from-home-category spec.
- Fix AUTH-01 (wrap storefront account routes in a guard) — **LOW complexity**, defense-in-depth only (component-level guard already correct). No test currently fails; add a regression test.
- Delete/neutralize RULES-01's dead unsafe helpers — **LOW complexity**, zero behavior change (unused today).

### PHASE B — Business flows
- Fix PLAT-01 (route publish toggle through `setStorePublished`) and PLAT-03 (audit logging for direct admin writes) together — **MEDIUM**, same root cause.
- Fix PLAT-02 (implement or remove platform policy toggles) — **MEDIUM**, needs a product decision on whether maintenance-mode/registration-gate/store-cap are still wanted.
- Fix STORE-07 (real package weight in shipping quotes) — **MEDIUM**, depends on whether product weight is already captured in the catalog (coordinate with merchant/product-catalog + shipping owners).
- Fix CQ-03 (plan-catalog parity check + surface `whatsappAutomation` in frontend catalog) — **LOW** (add a parity test), **MEDIUM** if also building the pre-emptive UI gate.
- Await and integrate **Addendum A** (merchant dashboard) before considering this phase complete — it almost certainly contains its own Phase-B-relevant findings (product/order/coupon flows).

### PHASE C — Responsive/UI consistency
- Commission the actual 7-breakpoint visual pass this report could not perform (dedicated browser-automation or Playwright-screenshot session).
- PLAT-04 (shared confirm-dialog consistency), PLAT-10 (dedupe triple-implemented approve-subscription flow), CQ-04 (Modal focus trap — one fix, reused everywhere), CQ-05 (aria-labels on 29 icon buttons).
- Complexity: LOW-MEDIUM across the board; CQ-04 is the highest-leverage single fix (one shared component).

### PHASE D — Polish/performance
- PLAT-05/PLAT-06 (pagination/aggregation for platform-scale lists) — **MEDIUM-HIGH**, no urgency at current tenant count but will degrade linearly.
- CQ-01/CQ-02 (functions module split, `any` reduction) — **HIGH** effort if done broadly; recommend opportunistic (touch-when-editing) rather than a dedicated pass.
- SHIP-03 (delete stray file), PLAT-08 (delete dead Coupons.tsx), GUARD-01 (delete or wire dead guards), STORE-04/STORE-06 (delete dead code) — **LOW**, batchable as one cleanup PR.
- SHIP-04 (shipping unit tests), fill out the remaining 10 e2e groups to a clean full-matrix run — **MEDIUM**.

---

## What's already solid (don't touch without evidence)

- Merchant/platform destructive-action flows (suspend/reactivate/permanent-delete merchant) are the best-built part of the admin app: callable-gated, confirmed, typed-confirmation-phrase + pre-delete impact preview for permanent delete, and a hard `isTestMerchant` guard prevents test-deletion tooling from ever touching a real merchant.
- Multi-tenant isolation at the **cross-tenant** level: no cross-tenant data leak was found anywhere across the security, storefront, platform, or shipping passes. Every issue found (SEC-1, STORE-03) is a *within-tenant* or *within-account* scoping gap, not cross-tenant.
- Shipment creation idempotency (transactional guard + 1:1 shipment doc + `order.activeShipmentId` check) is well-built and verified green under test (duplicate webhook/duplicate-event scenarios).
- Credential vault encryption (AES-256-GCM with an AAD binding of `storeId:integrationType:provider:version`) is correctly implemented — cross-tenant decryption is not possible even with ciphertext access.
- Route-level RBAC (`ZoneRouter` + per-route permission keys) is client- and server-enforced consistently — better than the project's own docs claim.
- Build/typecheck/lint pipeline is completely clean.

---

*Report compiled 2026-09-18. No code was modified. Awaiting explicit approval before any fix is implemented, per audit instructions.*
