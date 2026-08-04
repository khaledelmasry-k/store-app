# Route Map

Built on [Wouter](https://github.com/molefrog/wouter) (Preact-compatible). The router lives in `src/App.tsx`.

## Zones

The app has three isolated zones — no page in one zone is ever rendered inside another.

| Zone | Mount Path | Auth Required | Role Required | Layout |
|---|---|---|---|---|
| **Public / Landing** | `/` | No | — | None (LandingPage) |
| **Login** | `/login` | No | — | None (LoginByRole) |
| **Register** | `/register` | No | — | None (Register) |
| **Platform Admin** | `/platform/*` | Yes | `superAdmin` | PlatformLayout |
| **Merchant Dashboard** | `/dashboard/*` | Yes | `merchant` | MerchantLayout (DashboardLayout) |
| **Storefront** | `/store/:slug/*` | No (customer optional) | — | StoreLayout |

## Route Guards

| Guard | File | Purpose |
|---|---|---|
| `ZoneRouter` | `src/shared/components/routing/ZoneRouter.tsx` | Layout-level guard for `/platform` and `/dashboard` zones. Checks auth, role, and redirects to correct zone. |
| `RequireRole` | `src/shared/components/guards/RequireRole.tsx` | Component-level guard (available, not yet wired into tree) |
| `PublicOnly` | `src/shared/components/guards/PublicOnly.tsx` | Renders children only when user is unauthenticated (available, not wired) |
| `ErrorBoundary` | `src/shared/components/routing/ErrorBoundary.tsx` | Catch-all render error wrapper around `<App />` |
| `StoreSlugLoader` | `src/shared/components/layout/StoreSlugLoader.tsx` | Loads store by slug before rendering storefront; blocks render if store not found |

---

## PUBLIC

| Path | Component | Purpose |
|---|---|---|
| `/` | `LandingPage` | Public marketing landing page — no login, no dashboard |
| `/login` | `LoginByRole` | Reads `role` from `?role=` query param; renders `Login` component |
| `/login?role=platform` | `Login` | Platform admin login form |
| `/login?role=merchant` | `Login` | Merchant login form |
| `/login?role=customer` | `Login` | Customer login form |
| `/register` | `Register` | Merchant self-registration form |

### Login Redirect Behavior

After successful authentication, the `Login` component checks the user's actual role:
- `superAdmin` → `/platform/`
- `merchant` → `/dashboard/`
- `customer` → `/` (storefront home)

---

## PLATFORM (superAdmin)

Requires `role: 'superAdmin'` in the `users/{uid}` Firestore document.

All routes are wrapped in `ZoneRouter` with `prefix="/platform"`, `role="superAdmin"`, `layout={PlatformLayout}`.

| Path | Page Component | Purpose |
|---|---|---|
| `/platform` | `PlatformDashboard` | Platform overview: stores, orders, subscriptions, revenue charts |
| `/platform/merchants` | `PlatformMerchants` | Manage merchants: list, activate/suspend |
| `/platform/stores/:id` | `StoreDetails` | View store details, orders, products |
| `/platform/products` | `PlatformProducts` | Browse all products across all stores |
| `/platform/orders` | `PlatformOrders` | View all orders across all stores |
| `/platform/orders/:id` | `PlatformOrderDetails` | Order detail view |
| `/platform/customers` | `PlatformCustomers` | View all customers across stores |
| `/platform/subscriptions` | `PlatformSubscriptions` | Manage subscription plans |
| `/platform/plans` | `PlatformPlans` | Manage pricing plans |
| `/platform/payments` | `PlatformPayments` | View all payments |
| `/platform/transactions` | `PlatformTransactions` | View all transactions |
| `/platform/coupons` | `PlatformCoupons` | Manage platform-level coupons |
| `/platform/reports` | `PlatformReports` | Platform-wide analytics |
| `/platform/tickets` | `PlatformTickets` | Support tickets across all stores |
| `/platform/audit` | `PlatformAudit` | Audit logs |
| `/platform/notifications` | `PlatformNotifications` | Platform notifications |
| `/platform/settings` | `PlatformSettings` | Platform configuration |

**Sidebar nav items:** Overview, Merchants, Stores, Products, Orders, Customers, Subscriptions, Plans, Payments, Transactions, Coupons, Reports, Support Tickets, Audit Logs, Notifications, Platform Settings.

---

## MERCHANT (`/dashboard/*`)

Requires `role: 'merchant'` in the `users/{uid}` Firestore document AND `storeIds` containing the target store.

All routes are wrapped in `ZoneRouter` with `prefix="/dashboard"`, `role="merchant"`, `layout={MerchantLayout}`.

| Path | Page Component | Purpose |
|---|---|---|
| `/dashboard` | `MerchantDashboard` | Store overview: revenue, orders, analytics, low stock |
| `/dashboard/products` | `MerchantProducts` | Manage store products |
| `/dashboard/categories` | `MerchantCategories` | Manage product categories |
| `/dashboard/orders` | `MerchantOrders` | List store orders |
| `/dashboard/orders/:id` | `MerchantOrderDetails` | Order detail |
| `/dashboard/customers` | `MerchantCustomers` | Manage store customers |
| `/dashboard/coupons` | `MerchantCoupons` | Manage store coupons |
| `/dashboard/shipping` | `MerchantShipping` | Manage shipping zones |
| `/dashboard/reports` | `MerchantReports` | Store-specific reports |
| `/dashboard/analytics` | `MerchantAnalytics` | Store analytics |
| `/dashboard/team` | `MerchantTeam` | Manage team members |
| `/dashboard/roles` | `MerchantRoles` | Define roles & permissions |
| `/dashboard/landing-pages` | `MerchantLandingPages` | Manage storefront landing pages |
| `/dashboard/store-links` | `MerchantStoreLinks` | Manage sales links |
| `/dashboard/notifications` | `MerchantNotifications` | Store notifications |
| `/dashboard/tickets` | `MerchantTickets` | Support tickets |
| `/dashboard/subscription` | `MerchantSubscription` | View/manage subscription |
| `/dashboard/settings` | `MerchantSettings` | Store configuration |

**Sidebar nav items:** Overview, Products, Categories, Orders, Customers, Coupons, Shipping, Reports, Analytics, Team, Roles, Landing Pages, Sales Links, Notifications, Support, Subscription, Store Settings.

**Tenant isolation:** `MerchantLayout` auto-selects the merchant's store from `user.storeIds[0]`. All data queries are scoped to `storeId` via `useCollection` with `storeId` param, or `useStore` context.

---

## STOREFRONT (`/store/:slug/*`)

Storefront pages. The store slug is extracted from the URL by `StoreSlugLoader`, which loads the store from Firestore and provides it via `StoreContext`.

| Path | Page Component | Purpose | Auth | Role |
|---|---|---|---|---|
| `/store/:slug` | `StoreHome` | Store landing: featured products, categories | No | — |
| `/store/:slug/catalog` | `StoreCatalog` | Product listing with filters | No | — |
| `/store/:slug/product/:id` | `StoreProduct` | Product detail page | No | — |
| `/store/:slug/cart` | `StoreCart` | Shopping cart | No | — |
| `/store/:slug/checkout` | `StoreCheckout` | Checkout flow | Optional | `customer` (if logged in) |
| `/store/:slug/track` | `StoreTrack` | Track order by phone + order number | No | — |
| `/store/:slug/account` | `StoreAccount` | Customer account: orders, addresses, wishlist | Yes | `customer` |
| `/store/:slug/login` | `StoreLogin` | Customer login/signup | No | — |

**Storefront nav:** Home, Catalog, Track Order. Plus cart icon, theme toggle, and customer account dropdown (or "تسجيل الدخول" button for guests).