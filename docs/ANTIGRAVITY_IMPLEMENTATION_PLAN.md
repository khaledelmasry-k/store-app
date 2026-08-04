# M&K Store — Phased Master Implementation Plan

> **Document Status**: Approved & Execution-Ready  
> **Prepared by**: Lead Developer & Product Architect  
> **Date**: August 2026  
> **Target System**: M&K Store SaaS Platform  

---

## Plan Structure Overview

This implementation plan outlines the exact sequence of engineering tasks required to repair, consolidate, redesign, and test the M&K Store SaaS platform. Execution is divided into 9 prioritized phases (P0 through P8).

```
┌─────────────────────────────────────────────────────────────────────────┐
│ P0: Security & Auth Stabilization                                       │
│      └─ Fix registration active flag, auth flow, reset password         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ P1: Routing, Multi-Tenancy & RBAC Architecture                         │
│      └─ Fix StoreSlugLoader query bug, ZoneRouter staff support         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ P2: Public Marketing Landing Page Redesign                              │
│      └─ RTL Arab-first layout, SaaS design tokens, interactive FAQ      │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ P3: Pricing & Subscription Flow Integration                            │
│      └─ Dynamic plans, /register?plan=<id>, SuperAdmin approvals        │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ P4: Merchant Dashboard & Staff RBAC                                     │
│      └─ Staff permission guards, inventory alerts, real analytics       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ P5: Platform Admin Command Center                                       │
│      └─ SaaS metrics, merchant management, plan/subscription controls   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ P6: Customer Storefront Experience                                      │
│      └─ Store branding, checkout pipeline, order tracking               │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ P7: Sales Links Attribution Engine & Analytics                          │
│      └─ Ref URL parsing, session retention, order attribution, reports   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ P8: Code Cleanup, Quality Verification & Deployment Audit              │
│      └─ Dead code removal, linting, typechecking, browser testing       │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Phase Details & Task Specifications

### Phase 0: Security & Auth Stabilization (P0 — CRITICAL)
* **Goal**: Ensure absolute password safety, fix merchant registration approval state, and complete auth flow routing.
* **Tasks**:
  1. **Fix Registration Activation**: Update `functions/src/index.ts` in `registerMerchant` to ensure newly registered merchants are saved with `active: false` until explicit platform admin approval.
  2. **Implement Password Reset**: Create dedicated `/forgot-password` page and wire `sendPasswordResetEmail` in `src/shared/services/auth.ts`.
  3. **Fix Auth Flow Navigation**: Ensure `Login.tsx` and `HomeRedirect` in `App.tsx` navigate seamlessly without remaining stuck on authentication messages.
  4. **Verification**: Verify no plaintext passwords exist across Firestore documents, Functions, or client state.

### Phase 1: Routing, Multi-Tenancy & RBAC Architecture (P1 — CRITICAL)
* **Goal**: Fix routing bugs, support staff roles in `ZoneRouter`, and enforce multi-tenancy URL matching.
* **Tasks**:
  1. **Fix Store Slug URL Query Parsing**: Modify `StoreSlugLoader.tsx` to strip query strings (e.g. `?ref=ahmed`) from the URL pathname before looking up store documents in Firestore.
  2. **Update `ZoneRouter.tsx` Role Validation**: Allow users with `role: 'staff'` to access `/dashboard/*` alongside `merchant` users while enforcing store membership.
  3. **Normalize Trailing Slashes**: Ensure all router definitions and redirects strictly normalize trailing slashes to prevent infinite redirect loops.
  4. **Route Guard Cleanup**: Remove obsolete unused guard components (`PublicOnly`, `RequireRole`) and replace with unified `ZoneRouter`.

### Phase 2: Public Marketing Landing Page Redesign (P2)
* **Goal**: Transform `/` into a stunning, high-converting Arabic-first SaaS marketing page.
* **Tasks**:
  1. **Layout & Container Redesign**: Fix CSS container widths in `LandingPage.css` so content spans full desktop grid (1200px+ width) without narrow column compression.
  2. **Hero Section Enhancement**: Integrate a polished, interactive SaaS dashboard preview card with key metrics.
  3. **Features & How-It-Works Grids**: Build responsive 4-column feature cards with crisp typography, hover animations, and iconography.
  4. **Accessible FAQ Accordion**: Upgrade FAQ section into an accessible interactive accordion component.
  5. **Footer & Navigation Wiring**: Connect all navbar and footer links (`/#features`, `/#how-it-works`, `/#pricing`, `/#faq`, `/login`, `/register`). Eliminate all `href="#"` placeholders.

### Phase 3: Pricing & Subscription Flow Integration (P3)
* **Goal**: Connect real Firestore plan data to the landing page and build complete subscription approval flow.
* **Tasks**:
  1. **Data-Driven Pricing Cards**: Update `LandingPage.tsx` to fetch active plans from the `plans` collection via `useCollection('plans')`, with fallbacks.
  2. **Preserve Selected Plan**: Wire pricing card CTAs to navigate to `/register?plan=<planId>`. Update `Register.tsx` to capture `planId` and store it in subscription requests.
  3. **Platform Admin Subscription Approval**: Add an "Approve Subscription" action button in `PlatformSubscriptions.tsx` that triggers `approveSubscriptionCallable`.
  4. **Merchant Subscription UI Cleanup**: Remove the non-functional "Instant Approval" button from `MerchantSubscription.tsx` and show real status tracking.

### Phase 4: Merchant Dashboard & Staff RBAC (P4)
* **Goal**: Complete the operational merchant dashboard with real metrics and staff permission enforcement.
* **Tasks**:
  1. **Dashboard KPI Widgets**: Display Real Sales Revenue, Pending Orders, Active Products, Customer Counts, Low Stock Alerts, and Sales Links Conversion.
  2. **Staff Permission Scoping**: Implement permission checks on merchant sub-pages based on staff user permissions (e.g. `products:manage`, `orders:manage`).
  3. **Empty States**: Ensure polished, intentional empty state UI components when a store has 0 orders/products.

### Phase 5: Platform Admin Command Center (P5)
* **Goal**: Polish the platform command center for SaaS super-admins.
* **Tasks**:
  1. **Platform Metrics**: Render total merchants, active stores, subscription revenue, and system activity logs in `PlatformDashboard.tsx`.
  2. **Merchant Management**: Enhance `PlatformMerchants.tsx` to allow super-admins to inspect, activate, deactivate, or impersonate store accounts safely.
  3. **Plan Builder**: Verify `PlatformPlans.tsx` allows creating and editing monthly/yearly plans and feature limits.

### Phase 6: Customer Storefront Experience (P6)
* **Goal**: Deliver a high-converting, branded e-commerce storefront experience for shoppers.
* **Tasks**:
  1. **Branding & Layout**: Ensure store logo, custom primary color, currency, and header navigation render dynamically.
  2. **Product Catalog & Filters**: Support instant search, category filtering, variant selection (colors/sizes), and stock validation.
  3. **Cart & Checkout Pipeline**: Verify cart drawer, stock reservation, order placement callable (`createOrder`), and order tracking (`StoreTrack.tsx`).

### Phase 7: Sales Links Attribution Engine & Analytics (P7)
* **Goal**: Complete the Sales Links attribution feature end-to-end.
* **Tasks**:
  1. **Capture & Persist Referral Code**: In `StoreSlugLoader.tsx` or Storefront root, extract `?ref=<code>` from URL and persist in `sessionStorage` (`mk_sales_ref`).
  2. **Increment Link Visits**: Trigger atomic visit increment on `storeLinks` collection upon referral entry.
  3. **Order Attribution**: Pass `refCode` / `salesLinkId` to `createOrder` callable and store on order document (`orders/${orderId}.salesLinkId`).
  4. **Merchant Sales Link Dashboard**: Display conversion rate, total visits, total orders, and total revenue per sales link in `StoreLinks.tsx` and `Analytics.tsx`.

### Phase 8: Polish, Code Cleanup, QA & Deployed Verification (P8)
* **Goal**: Ensure zero errors, clean code quality, and full cross-browser responsiveness.
* **Tasks**:
  1. **Code Cleanup**: Remove dead imports, unused files (`.firebaserc.bak`), and document changes in `docs/CLEANUP_REPORT.md`.
  2. **Build Verification**: Run `npm run typecheck`, `npm run lint`, and `npm run build` to verify clean compilation.
  3. **Browser Testing**: Perform visual and functional browser checks across Desktop (1440px+), Tablet (768px), and Mobile (390px/360px).
  4. **Deployment Check**: Inspect deployed Vercel application (`https://store-five-dun.vercel.app/`) and ensure local fixes match deployment requirements.

---

## Execution Constraints & Rules

1. **No Code Modification Before Plan Sign-off**: Audit and plan documentation must be generated first.
2. **Preserve Firebase Infrastructure**: Do NOT attempt to swap Firebase for another database or backend framework.
3. **No Hashing Workarounds**: Passwords must be handled strictly by Firebase Auth. Plaintext passwords must NEVER be saved in Firestore.
4. **Empirical Verification**: Every phase must end with runtime typecheck, lint, build, or browser testing verification.
