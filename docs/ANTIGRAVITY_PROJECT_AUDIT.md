# M&K Store — Comprehensive Product & Technical Audit

> **Document Status**: Complete & Authoritative  
> **Prepared by**: Lead Developer & Product Architect  
> **Date**: August 2026  
> **Target System**: M&K Store SaaS Platform  

---

## Executive Summary

M&K Store is a multi-tenant SaaS e-commerce platform built with Preact, Vite, Wouter, and Firebase (Auth, Firestore, Cloud Functions). The platform comprises four distinct product experiences:

1. **M&K Platform Admin** (`/platform/*`) — Management console for SaaS super-admins.
2. **Merchant Dashboard** (`/dashboard/*`) — Operational dashboard for store owners and staff members.
3. **Customer Storefront** (`/store/:slug/*`) — Branded e-commerce store experience for buyers.
4. **Public Marketing Website** (`/`) — SaaS marketing landing page and onboarding portal.

This audit evaluates the codebase, database architecture, security rules, authentication flows, routing, multi-tenancy, Sales Links attribution, pricing models, and UI/UX implementation against production-grade requirements.

---

## 1. System Architecture Analysis

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND LAYER                                      │
│   Preact 10 + Vite 8 + TypeScript 6 + Wouter 3.10.0 + Custom CSS Design System   │
└─────────┬───────────────────────┬─────────────────────────┬─────────────────────┘
          │                       │                         │
┌─────────▼───────────┐ ┌─────────▼─────────────┐ ┌─────────▼─────────────────────┐
│ Firebase Auth       │ │ Firestore Database    │ │ v2 Callable Cloud Functions   │
│ - Identity provider │ │ - Real-time sync      │ │ - Order generation            │
│ - Password resets   │ │ - Multi-tenant rules  │ │ - Atomic checkout             │
│ - Token claims      │ │ - Analytics snapshots │ │ - Merchant registration       │
└─────────────────────┘ └───────────────────────┘ └───────────────────────────────┘
```

* **Frontend Framework**: Preact `10.29.7` running on Vite `8.1.1` with React aliases.
* **Routing**: Wouter `3.10.0` with prefix-stripping subrouters (`ZoneRouter`).
* **Backend Infrastructure**: Firebase Auth, Firestore, Firebase Storage, and Firebase Functions v2 (`onCall`).
* **Design System**: Vanilla CSS design tokens (`src/index.css` & `src/platform/pages/LandingPage.css`) formatted for Arabic-first RTL rendering (`dir="rtl"`).

---

## 2. Technology Stack Verification

| Component | Technology | Version | Audit Verdict |
| :--- | :--- | :--- | :--- |
| **Core UI** | Preact | `^10.29.7` | ✅ Light, fast, compatible with React ecosystem. |
| **Build Tool** | Vite | `^8.1.1` | ✅ Fast HMR, clean ESM bundle generation. |
| **Language** | TypeScript | `~6.0.2` | ✅ Strict type checking passes (`tsc -b`). |
| **Router** | Wouter | `^3.10.0` | ⚠️ Custom `ZoneRouter` wrapper works, but query parameters break nested slug loading. |
| **Backend** | Firebase Admin & Functions | `v2` (`firebase-functions`) | ✅ Clean callable functions in `functions/src/index.ts`. |
| **Database** | Firestore | Security Rules `v2` | ⚠️ Rules exist, but staff scoping contains unused/loose helper functions. |
| **Linter** | Oxlint | `^1.71.0` | ⚠️ 11 minor lint warnings detected. |

---

## 3. Comprehensive Route Map

```
/                             → HomeRedirect (Shows LandingPage or redirects logged-in user)
├── /login                    → Universal Login (role query param: platform | merchant | customer)
├── /register                 → Merchant Onboarding (accepts optional ?plan=<planId>)
├── /platform/*               → Platform Admin Console (Role: superAdmin)
│   ├── /                     → Dashboard (KPIs, Store counts, Revenue metrics)
│   ├── /merchants            → Merchant & Store Management
│   ├── /stores/:id           → Store Detail View
│   ├── /products             → Platform-wide Product Overview
│   ├── /orders               → Platform-wide Orders
│   ├── /orders/:id           → Order Detail View
│   ├── /customers            → Global Customer Registry
│   ├── /subscriptions        → Subscription Approvals & History
│   ├── /plans                → Subscription Plan Configuration
│   ├── /payments             → Payment Records
│   ├── /transactions         → Financial Transactions
│   ├── /coupons              → Platform Coupons
│   ├── /reports              → Platform Reports
│   ├── /tickets              → Support Tickets
│   ├── /audit                → System Audit Logs
│   ├── /notifications        → Platform Notifications
│   └── /settings             → Platform Configuration
├── /dashboard/*              → Merchant Operations Console (Role: merchant | staff)
│   ├── /                     → Merchant Dashboard (Sales, Stock alerts, Recent orders)
│   ├── /products             → Catalog & Inventory Management
│   ├── /categories           → Product Category Tree
│   ├── /orders               → Order Fulfillment & Status Pipeline
│   ├── /orders/:id           → Order Detail & Tracking updates
│   ├── /customers            → Customer Directory & Order History
│   ├── /coupons              → Store Promotion Coupons
│   ├── /shipping             → Shipping Zones & Fees
│   ├── /reports              → Sales & Export Reports
│   ├── /analytics            → Traffic & Conversion Analytics
│   ├── /team                 → Staff Members & Invitations
│   ├── /roles                → Custom Role Definitions & Permissions
│   ├── /landing-pages        → Marketing Landing Page Builder
│   ├── /store-links          → Sales Links (Referral links) Management
│   ├── /notifications        → Store Alerts & Notifications
│   ├── /tickets              → Merchant Support Center
│   ├── /subscription         → Current Plan & Billing Status
│   └── /settings             → Store Profile & Branding
└── /store/:slug/*            → Public Customer Storefront (Tenant-isolated)
    ├── /                     → Store Homepage (Hero, Featured, Categories)
    ├── /catalog              → Product Catalog with Search & Category Filters
    ├── /product/:id          → Product Details, Variant Selection & Add-to-Cart
    ├── /cart                 → Shopping Cart Management
    ├── /checkout             → Order Checkout Form
    ├── /track                → Order Tracking by Order Number & Phone
    ├── /account              → Customer Account Profile
    └── /login                → Storefront Customer Login / Register
```

---

## 4. Authentication Flow Evaluation

### Current Flow Logic
1. Firebase Auth state initializes via `onAuthStateChanged` in `AuthProvider.tsx`.
2. The user profile document `users/${uid}` is fetched from Firestore.
3. The auth state transitions: `UNINITIALIZED` → `LOADING` → `AUTHENTICATED` / `UNAUTHENTICATED`.

### Critical Vulnerabilities & Flaws Identified
1. **Premature Account Activation**: In `functions/src/index.ts` line 253, `registerMerchant` sets `users/${uid}` to `active: false`, but three lines later updates it to `active: true`. This allows newly registered merchants to log in immediately before platform admin approval, contradicting the UI feedback on `/register` (" طلبك قيد المراجعة ").
2. **Missing Password Reset Route**: The system lacks a dedicated `/forgot-password` route. Password resets are executed solely via admin trigger or email link.
3. **Login Redirect Loop Potential**: `LoginByRole` defaults unparameterized `/login` to `role="platform"`. If a merchant attempts to log in at `/login`, the UI defaults to Platform Admin branding unless `?role=merchant` is explicitly passed.

---

## 5. Role Model Assessment

### Canonical Role Taxonomy
* **`superAdmin`**: Full SaaS platform control (`/platform/*`).
* **`merchant`**: Store owner with full store tenant control (`/dashboard/*`).
* **`staff`**: Employee with store access restricted by assigned permissions (`/dashboard/*`).
* **`customer`**: End buyer with storefront account access (`/store/:slug/*`).

### Issues Identified
* **`ZoneRouter` Staff Lockout**: `ZoneRouter.tsx` line 31 checks `if (user.role !== role)`. When `role` is `'merchant'`, a valid `staff` user is rejected (`'staff' !== 'merchant'`) and redirected to `/`. This completely breaks employee dashboard access.

---

## 6. RBAC (Role-Based Access Control) Status

### Implementation State
* Granular permission strings exist in type definitions (`products:manage`, `orders:manage`, `customers:manage`, `reports:view`, `settings:manage`, `team:manage`, `coupons:manage`, `landing:manage`).
* UI components inside `/dashboard/*` currently display all pages to any user reaching `/dashboard`, regardless of granular staff permissions.
* **Security Rules Enforcement**: Firestore rules check `canAccessStore(storeId)` (`user.storeIds.hasAll([storeId])`), but do not evaluate specific role permissions at the document level.

---

## 7. Multi-Tenancy Isolation

### Tenant Boundaries
* Stores are identified by unique `id` and unique `slug`.
* Firestore security rules enforce `request.auth.uid` store membership via `users/${uid}.storeIds`.
* Cloud Functions (`createOrder`, `generateOrderNumber`) validate store existence and store membership.

### URL Query String Multi-Tenancy Bug
* `StoreSlugLoader.tsx` extracts `slug = loc.split('/')[1]`. When accessing a store with query params (e.g. `/store/demo-store?ref=ahmed`), `loc` is `"/store/demo-store?ref=ahmed"`.
* `segments[1]` resolves to `"demo-store?ref=ahmed"`. The Firestore query `where('slug', '==', 'demo-store?ref=ahmed')` returns empty results, causing a false **"المتجر غير موجود"** (Store Not Found) error page!

---

## 8. Sales Links Architecture & Attribution Analysis

### Expected Product Feature
Merchants can create referral/sales links for affiliate marketers or salespeople (e.g., `/store/demo-store?ref=ahmed`). When a customer purchases through this link, the order must retain referral attribution (`salesLinkId` / `refCode`). Merchant analytics must aggregate Visits, Orders, Delivered Orders, Revenue, and Conversion Rate per Sales Link.

### Current Audit Findings
1. **Link Management**: `StoreLinks.tsx` and `storeLinksService` permit creation and listing of `storeLinks` in Firestore.
2. **Attribution Pipeline**: Completely missing in the storefront. `StoreSlugLoader`, `CartProvider`, and `Checkout.tsx` do not parse, store in `sessionStorage`/`localStorage`, or attach `salesLinkId`/`ref` to the `createOrder` payload.
3. **Visits Counter**: `storeLinks.visits` counter is not incremented upon storefront entry.
4. **Merchant Analytics**: Sales Link performance metrics in `Analytics.tsx` and `Dashboard.tsx` are non-functional or static placeholders.

---

## 9. Subscriptions & Pricing Integration

### Plan Management Architecture
* Collection: `plans` (Managed by `superAdmin` in `PlatformPlans.tsx`).
* Collection: `subscriptions` (Linked to `storeId` and `planId`).

### Deficiencies Found
1. **Landing Page Disconnect**: Landing Page pricing cards are hardcoded mock components instead of dynamically rendering active plans from the `plans` collection.
2. **Lost Plan Selection**: Clicking "ابدأ الآن" on a pricing card navigates to `/register` without passing `?plan=<planId>`.
3. **Broken Approval Button**: `MerchantSubscription.tsx` includes an "Instant Approval" button calling `approveSubscriptionCallable`. This callable requires `superAdmin` privileges and fails with a `permission-denied` error when clicked by a merchant.
4. **Missing Approval Interface**: `PlatformSubscriptions.tsx` displays subscription lists but provides no action button for `superAdmin` to execute `approveSubscriptionCallable`.

---

## 10. Public Landing Page UI/UX Audit

### Design & Layout Deficiencies (`src/platform/pages/LandingPage.tsx`)
* **Layout Narrowness**: Grid structures in `LandingPage.css` compress content awkwardly on standard desktop screens (1440px+).
* **FAQ Component**: Renders with plain styling lacking modern visual accordion polish.
* **Footer**: Contains non-functional dead links (`href="#"`).
* **Visual Hierarchy**: Hero section lacks a high-impact SaaS dashboard mockup asset.

---

## 11. Merchant Dashboard State

* `MerchantDashboard.tsx` renders statistics cards, line charts, inventory alerts, and recent orders.
* **Data Integration**: Successfully reads real Firestore collections when data exists.
* **Empty State Handling**: Works, but requires staff role handling and Sales Links conversion widgets.

---

## 12. Customer Storefront State

* Real e-commerce structure: Hero, Categories, Product Cards, Product View, Shopping Cart drawer, Checkout Form, and Order Tracker.
* **Deficiencies**: Affected by the URL query parameter slug parsing bug; lacks session-persisted referral link tracking; missing customer address book management.

---

## 13. Critical Bug Registry

| Bug ID | Component | Severity | Description |
| :--- | :--- | :--- | :--- |
| **BUG-01** | `StoreSlugLoader.tsx` | **CRITICAL** | URL query strings (e.g. `?ref=ahmed`) break store slug matching. |
| **BUG-02** | `ZoneRouter.tsx` | **CRITICAL** | Staff users (`role: 'staff'`) are rejected from `/dashboard/*` and redirected to `/`. |
| **BUG-03** | `functions/src/index.ts` | **HIGH** | `registerMerchant` immediately sets `users.active = true`, bypassing admin review. |
| **BUG-04** | `PlatformSubscriptions.tsx` | **HIGH** | Platform Admin cannot approve pending subscriptions due to missing UI action buttons. |
| **BUG-05** | `MerchantSubscription.tsx` | **MEDIUM** | Merchant UI includes broken "Instant Approval" button that throws permission errors. |
| **BUG-06** | `LandingPage.tsx` | **MEDIUM** | Hardcoded pricing cards do not connect selected plan to `/register?plan=<planId>`. |
| **BUG-07** | `App.tsx` | **MEDIUM** | Missing dedicated `/forgot-password` route. |

---

## 14. Security Risk Assessment

1. **Plaintext Password Review**: Prior audit flagged plaintext password storage in `approveSubscription`. Current codebase inspection confirms `approveSubscription` now uses `auth.generatePasswordResetLink(user.email)` and does NOT store passwords in Firestore. **Status: RESOLVED**.
2. **Registration Bypass**: `registerMerchant` creates Auth users with `active: true` in Firestore immediately, allowing instant login. **Status: VULNERABLE — REQUIRE FIX**.
3. **Multi-Tenant Data Leakage**: Firestore security rules mandate store ID checking (`canAccessStore`), preventing cross-tenant access in database queries. Callable functions validate store membership for updates. **Status: SECURE**.

---

## 15. Code Cleanup & Obsolete Files Audit

* **Unused Code & Imports**:
  - `src/App.tsx`: Unused imports `Loading`, `PublicOnly`.
  - `src/shared/components/routing/ZoneRouter.tsx`: Unused import `Route`.
  - `src/shared/components/layout/StoreSlugLoader.tsx`: Unused import `Redirect`.
  - `functions/src/index.ts`: Unused variable `resetLink`.
* **Dead Assets**: `.firebaserc.bak` in workspace root.

---

## 16. Consolidated Architecture Verdict

The overall project architecture (Preact + Wouter + Firebase v2) is **fundamentally sound and modular**. The codebase does NOT require a rewrite from scratch. Rebuilding the project would be counterproductive. 

By executing a targeted repair and consolidation plan, all security, routing, attribution, pricing, and UI deficiencies can be completely resolved.
