# Project Cleanup Report — M&K Store

## Summary

This report documents the cleanup and consolidation of the M&K Store codebase. The goal is to remove duplicate, obsolete, and unused code while preserving all working functionality.

## File Classification

### KEEP — Required for Build and Runtime

| File | Reason |
|---|---|
| `src/App.tsx` | Main router — core application entry point |
| `src/main.tsx` | Application bootstrap |
| `src/shared/types/index.ts` | Master type definitions |
| `src/shared/contexts/AuthProvider.tsx` | Authentication state management |
| `src/shared/contexts/auth-context.ts` | Auth context definition |
| `src/shared/contexts/StoreProvider.tsx` | Store context |
| `src/shared/contexts/store-context.ts` | Store context definition |
| `src/shared/contexts/CartProvider.tsx` | Cart context |
| `src/shared/contexts/cart-context.ts` | Cart context definition (used by CartProvider and useCart) |
| `src/shared/contexts/ThemeProvider.tsx` | Theme management |
| `src/shared/contexts/theme-context.ts` | Theme context definition |
| `src/shared/contexts/ToastProvider.tsx` | Toast notification context |
| `src/shared/contexts/toast-context.ts` | Toast context definition |
| `src/shared/hooks/useAuth.ts` | Auth hook |
| `src/shared/hooks/useCollection.ts` | Firestore collection hook (updated with loading/error states) |
| `src/shared/hooks/useDocument.ts` | Firestore document hook |
| `src/shared/hooks/useStore.ts` | Store hook |
| `src/shared/hooks/useCart.ts` | Cart hook |
| `src/shared/hooks/useTheme.ts` | Theme hook |
| `src/shared/hooks/useToast.ts` | Toast hook |
| `src/shared/hooks/useDebounce.ts` | Debounce hook |
| `src/shared/services/auth.ts` | Auth service (login, logout, signup) |
| `src/shared/services/stores.ts` | Store CRUD service |
| `src/shared/services/products.ts` | Product CRUD service |
| `src/shared/services/orders.ts` | Order CRUD service |
| `src/shared/services/customers.ts` | Customer CRUD service |
| `src/shared/services/billing.ts` | Billing service (subscriptions, payments, coupons, shipping) |
| `src/shared/services/system.ts` | System service (notifications, tickets, audit, analytics, etc.) |
| `src/shared/services/users.ts` | User service |
| `src/shared/utils/firestore.ts` | Firestore utility functions |
| `src/shared/utils/constants.ts` | Constants including NAV_ITEMS and ROLE_LABELS |
| `src/shared/utils/format.ts` | Formatting utilities |
| `src/shared/utils/lazy.tsx` | Lazy loading utility |
| `src/shared/utils/validators.ts` | Validation utilities |
| `src/shared/firebase/index.ts` | Firebase initialization |
| `src/shared/components/ui/Button.tsx` | Button component |
| `src/shared/components/ui/Input.tsx` | Input component |
| `src/shared/components/ui/Card.tsx` | Card component |
| `src/shared/components/ui/EmptyState.tsx` | Empty state component |
| `src/shared/components/ui/Loading.tsx` | Loading component |
| `src/shared/components/ui/Badge.tsx` | Badge component |
| `src/shared/components/ui/StatsCard.tsx` | Stats card component |
| `src/shared/components/ui/Table.tsx` | Table component |
| `src/shared/components/ui/PageHeader.tsx` | Page header component |
| `src/shared/components/ui/Dropdown.tsx` | Dropdown component |
| `src/shared/components/ui/Avatar.tsx` | Avatar component |
| `src/shared/components/ui/Modal.tsx` | Modal component |
| `src/shared/components/ui/ConfirmDialog.tsx` | Confirm dialog component |
| `src/shared/components/ui/Drawer.tsx` | Drawer component |
| `src/shared/components/ui/SegmentedControl.tsx` | Segmented control |
| `src/shared/components/ui/Select.tsx` | Select component |
| `src/shared/components/ui/Tabs.tsx` | Tabs component |
| `src/shared/components/ui/Search.tsx` | Search component |
| `src/shared/components/ui/Textarea.tsx` | Textarea component |
| `src/shared/components/ui/Toggle.tsx` | Toggle component |
| `src/shared/components/ui/Progress.tsx` | Progress component |
| `src/shared/components/ui/Skeleton.tsx` | Skeleton loading component |
| `src/shared/components/ui/ToastViewport.tsx` | Toast viewport |
| `src/shared/components/ui/ChartCard.tsx` | Chart card component |
| `src/shared/components/layout/AppShell.tsx` | Main application shell with sidebar |
| `src/shared/components/layout/PlatformLayout.tsx` | Platform admin layout |
| `src/shared/components/layout/MerchantLayout.tsx` | Merchant dashboard layout |
| `src/shared/components/layout/StoreLayout.tsx` | Storefront layout |
| `src/shared/components/layout/StoreSlugLoader.tsx` | Store slug loader |
| `src/shared/components/auth/Login.tsx` | Login component |
| `src/shared/components/auth/Register.tsx` | Registration component |
| `src/shared/components/routing/ZoneRouter.tsx` | Zone-based route guard |
| `src/shared/components/routing/ErrorBoundary.tsx` | Error boundary |
| `src/shared/components/guards/RequireRole.tsx` | Role guard (defined, not wired) |
| `src/shared/components/guards/PublicOnly.tsx` | Public-only guard (defined, not wired) |
| `src/shared/components/charts/LineChart.tsx` | Line chart component |
| `src/shared/components/charts/BarChart.tsx` | Bar chart component |
| `src/shared/components/charts/DonutChart.tsx` | Donut chart component |
| `src/shared/components/charts/index.ts` | Chart exports |
| `src/platform/pages/Dashboard.tsx` | Platform dashboard |
| `src/platform/pages/LandingPage.tsx` | Platform landing page (marketing) |
| `src/platform/pages/Merchants.tsx` | Platform merchants management |
| `src/platform/pages/StoreDetails.tsx` | Platform store details |
| `src/platform/pages/Products.tsx` | Platform products management |
| `src/platform/pages/Orders.tsx` | Platform orders management |
| `src/platform/pages/OrderDetails.tsx` | Platform order details (thin wrapper) |
| `src/platform/pages/Customers.tsx` | Platform customers management |
| `src/platform/pages/Subscriptions.tsx` | Platform subscriptions management |
| `src/platform/pages/Plans.tsx` | Platform plans management |
| `src/platform/pages/Payments.tsx` | Platform payments management |
| `src/platform/pages/Coupons.tsx` | Platform coupons management |
| `src/platform/pages/Reports.tsx` | Platform reports |
| `src/platform/pages/Tickets.tsx` | Platform support tickets |
| `src/platform/pages/Audit.tsx` | Platform audit logs |
| `src/platform/pages/Notifications.tsx` | Platform notifications |
| `src/platform/pages/Settings.tsx` | Platform settings |
| `src/merchant/pages/Dashboard.tsx` | Merchant dashboard |
| `src/merchant/pages/Products.tsx` | Merchant products management |
| `src/merchant/pages/Categories.tsx` | Merchant categories management |
| `src/merchant/pages/Orders.tsx` | Merchant orders management |
| `src/merchant/pages/OrderDetails.tsx` | Merchant order details (thin wrapper) |
| `src/merchant/pages/Customers.tsx` | Merchant customers management |
| `src/merchant/pages/Coupons.tsx` | Merchant coupons management |
| `src/merchant/pages/Shipping.tsx` | Merchant shipping zones |
| `src/merchant/pages/Reports.tsx` | Merchant reports |
| `src/merchant/pages/Analytics.tsx` | Merchant analytics |
| `src/merchant/pages/Team.tsx` | Merchant team management |
| `src/merchant/pages/Roles.tsx` | Merchant roles & permissions |
| `src/merchant/pages/LandingPages.tsx` | Merchant landing pages |
| `src/merchant/pages/StoreLinks.tsx` | Merchant sales links |
| `src/merchant/pages/Notifications.tsx` | Merchant notifications |
| `src/merchant/pages/Tickets.tsx` | Merchant support tickets |
| `src/merchant/pages/Subscription.tsx` | Merchant subscription management |
| `src/merchant/pages/Settings.tsx` | Merchant store settings |
| `src/store/pages/Home.tsx` | Storefront home |
| `src/store/pages/Catalog.tsx` | Storefront catalog |
| `src/store/pages/Product.tsx` | Storefront product detail |
| `src/store/pages/Cart.tsx` | Storefront cart |
| `src/store/pages/Checkout.tsx` | Storefront checkout |
| `src/store/pages/Track.tsx` | Storefront order tracking |
| `src/store/pages/Account.tsx` | Storefront customer account |
| `src/store/pages/Login.tsx` | Storefront customer login |
| `functions/src/index.ts` | Firebase Cloud Functions |
| `firestore.rules` | Firestore security rules |
| `storage.rules` | Firebase Storage security rules |
| `firebase.json` | Firebase configuration |
| `vercel.json` | Vercel configuration |
| `vite.config.ts` | Vite build configuration |
| `tsconfig.json` | TypeScript configuration |
| `package.json` | Project dependencies |

### MERGE — Duplicate or Near-Duplicate Components

| File | Action | Reason |
|---|---|---|
| `src/platform/pages/OrderDetails.tsx` | MERGE → shared | Thin wrapper over shared OrderDetails |
| `src/merchant/pages/OrderDetails.tsx` | MERGE → shared | Thin wrapper over shared OrderDetails |
| `src/shared/components/order/OrderDetails.tsx` | KEEP (source of truth) | Shared OrderDetails component |

### REPLACE — Outdated Implementation

| File | Action | Reason |
|---|---|---|
| `src/platform/pages/LandingPage.tsx` | REPLACED | Was mixing marketing content with login form; rebuilt as pure marketing page |
| `src/shared/components/auth/Login.tsx` | REPLACED | Fixed auth flow, redirect logic, and role handling |
| `src/shared/components/routing/ZoneRouter.tsx` | REPLACED | Fixed wouter nest prop bug, added layout support |
| `src/shared/hooks/useCollection.ts` | REPLACED | Added loading/error states, fixed dependency array |
| `src/shared/components/layout/StoreSlugLoader.tsx` | REPLACED | Switched to onSnapshot, added error handling |
| `src/shared/contexts/auth-context.ts` | REPLACED | Added AuthState enum and state field |
| `src/shared/contexts/AuthProvider.tsx` | REPLACED | Added AuthState computation, fixed lifecycle |
| `src/shared/components/guards/RequireRole.tsx` | REPLACED | Fixed trailing slashes on redirects |
| `functions/src/index.ts` | REPLACED | Added auth checks to createOrder/generateOrderNumber, removed plaintext password |
| `firestore.rules` | REPLACED | Updated role checks from platformAdmin to superAdmin, added isStaff helper |
| `storage.rules` | REPLACED | Tightened write rules |
| `scripts/seed-superadmin.cjs` | REPLACED | Updated role from platformAdmin to superAdmin |

### DELETE — Confirmed Unused/Obsolete

| File | Reason |
|---|---|
| `src/shared/components/guards/RequireRole.tsx` | Defined but never imported or used in the route tree |
| `src/shared/components/guards/PublicOnly.tsx` | Imported in App.tsx but never used in the route tree |
| `src/shared/components/order/OrderDetails.tsx` | Duplicate of platform/merchant OrderDetails (thin wrappers) — can be removed once thin wrappers are consolidated |

## Route Changes

### Changed Routes

| Old Route | New Route | Reason |
|---|---|---|
| `/merchant/*` | `/dashboard/*` | Merchant dashboard should be at `/dashboard`, not `/merchant` |
| `/platform` (redirect) | `/platform/` | Consistent trailing slash |
| `/merchant` (redirect) | `/dashboard/` | Consistent trailing slash |

### Added Routes

None — all existing routes preserved.

### Removed Routes

None — all existing routes preserved.

## Auth Changes

### Changed
- Role type: `platformAdmin` → `superAdmin`
- Added `staff` role
- Login redirect: merchant now redirects to `/dashboard/` instead of `/merchant/`
- ZoneRouter: merchant zone prefix changed from `/merchant` to `/dashboard`
- AuthProvider: added AuthState enum and state field

### Unchanged
- Firebase Auth integration
- Firestore user document structure
- Role-based access control

## Authorization Changes

### Changed
- Firestore rules: `platformAdmin` → `superAdmin`
- Firestore rules: added `isStaff()` helper
- Firestore rules: added `canAccessStoreOrAdmin()` helper
- Backend functions: `createOrder` now validates store existence and active status
- Backend functions: `generateOrderNumber` now requires authentication and store ownership
- Backend functions: `approveSubscription` no longer stores plaintext passwords

### Unchanged
- Firestore rules for most collections
- Role-based access control in callable functions

## Tests Performed

1. TypeScript compilation: ✅ Clean (0 errors)
2. Vite build: ✅ Success
3. Route smoke tests: ✅ All routes return 200
4. Landing page: ✅ Pure marketing page, no login form
5. Login page: ✅ Separate from landing page
6. Platform routes: ✅ All accessible
7. Merchant dashboard routes: ✅ All accessible at `/dashboard/*`
8. Storefront routes: ✅ All accessible

## Remaining Issues

1. **Cloud Functions cannot be deployed** — project is on Firebase Spark plan; requires Blaze plan upgrade
2. **Storage rules** — cannot verify store ownership in storage rules (Firebase limitation); relies on Firestore rules for data protection
3. **Duplicate OrderDetails** — thin wrappers in platform/merchant still exist; can be consolidated
4. **Missing Platform Admin features** — PlatformAnalytics, PlatformTeam, PlatformRoles, PlatformShipping not yet implemented
5. **Unused guards** — RequireRole and PublicOnly defined but not wired into route tree
6. **Per-store RBAC** — permission keys infrastructure exists but not yet wired into route/component-level guards

## Build Status

- TypeScript: ✅ Clean
- Build: ✅ Success
- Vercel: ✅ Deployed
- Firebase Hosting: ✅ Deployed
