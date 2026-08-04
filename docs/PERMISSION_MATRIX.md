# Permission Matrix

M&K Store is a multi-tenant SaaS ecommerce platform with **four user roles**:

| Role | Description | Scope |
|---|---|---|
| `superAdmin` | Platform owner | All stores, all data |
| `merchant` | Store owner/operator | Owns `storeIds[]` |
| `staff` | Team member with granular permissions | Per-store via `RoleDef` |
| `customer` | Storefront shopper | Own orders/addresses/wishlist within a store |

> **Note:** `staff` is also a top-level `User.role` for authenticated staff members who have Firebase Auth accounts. Their store access is determined by membership in `user.storeIds`. Granular permissions are managed via the per-store `RoleDef` + `TeamMember` system (permission keys: `products:manage`, `orders:manage`, etc.).

---

## Feature Access Matrix

| Feature | superAdmin | merchant | staff | customer |
|---|---|---|---|---|
| **Platform dashboard** | ✓ | ✗ | ✗ | ✗ |
| **Platform stores** | ✓ | ✗ | ✗ | ✗ |
| **Platform merchants** | ✓ | ✗ | ✗ | ✗ |
| **Platform subscriptions** | ✓ | ✗ | ✗ | ✗ |
| **Platform plans** | ✓ | ✗ | ✗ | ✗ |
| **Platform payments** | ✓ | ✗ | ✗ | ✗ |
| **Platform transactions** | ✓ | ✗ | ✗ | ✗ |
| **Platform coupons** | ✓ | ✗ | ✗ | ✗ |
| **Platform reports** | ✓ | ✗ | ✗ | ✗ |
| **Platform support tickets** | ✓ | ✗ | ✗ | ✗ |
| **Platform audit logs** | ✓ | ✗ | ✗ | ✗ |
| **Platform notifications** | ✓ | ✗ | ✗ | ✗ |
| **Platform settings** | ✓ | ✗ | ✗ | ✗ |
| **Impersonate merchant** | ✓ | ✗ | ✗ | ✗ |
| **Approve subscriptions** | ✓ | ✗ | ✗ | ✗ |

| Feature | superAdmin | merchant | staff | customer |
|---|---|---|---|---|
| **My dashboard** | via `/platform` | ✓ (`/dashboard`) | configurable* | ✗ |
| **Manage products** (own store) | ✓ | ✓ | configurable | ✗ |
| **Manage categories** | ✓ | ✓ | configurable | ✗ |
| **Manage orders** | ✓ | ✓ | configurable | ✗ |
| **View order details** | ✓ | ✓ | configurable | own only |
| **Manage customers** | ✓ | ✓ | configurable | self only |
| **Manage coupons** | ✓ | ✓ | configurable | ✗ |
| **Manage shipping zones** | ✓ | ✓ | configurable | ✗ |
| **View reports** | ✓ | ✓ | configurable | ✗ |
| **View analytics** | ✓ | ✓ | configurable | ✗ |
| **Manage team members** | ✓ | ✓ | configurable | ✗ |
| **Manage roles & permissions** | ✓ | ✓ | configurable | ✗ |
| **Manage landing pages** | ✓ | ✓ | configurable | ✗ |
| **Manage sales links** | ✓ | ✓ | configurable | ✓ (read) |
| **View notifications** | ✓ | ✓ | configurable | own only |
| **View support tickets** | ✓ | ✓ | configurable | own only |
| **View subscription** | ✓ | ✓ | configurable | ✗ |
| **Store settings** | ✓ | ✓ | configurable | ✗ |

| Feature | superAdmin | merchant | staff | customer |
|---|---|---|---|---|
| **Storefront browsing** | ✓* | ✓* | ✓* | ✓ |
| **Add to cart** | — | — | — | ✓ |
| **Checkout** | — | — | — | ✓ |
| **Order confirmation** | — | — | — | ✓ |
| **Track order** (phone + number) | — | — | — | ✓ |
| **Customer account** | — | — | — | ✓ |
| **View own orders** | — | — | — | ✓ (own store only) |
| **Manage addresses** | — | — | — | ✓ (own) |
| **View wishlist** | — | — | — | ✓ (own) |

\* Platform admin can access as read-only for support purposes  
\* `configurable` = staff permissions are defined per-role via `RoleDef.permissions`

---

## Enforcement Methods

| Layer | What It Enforces | How |
|---|---|---|
| **Route guards** (`ZoneRouter`) | Prevents merchants from seeing platform routes, customers from seeing dashboard | Client-side redirect by `user.role` BEFORE rendering route content |
| **Login redirect** (`HomeRedirect`, `Login`) | Sends each role to the correct dashboard | Role-based navigation after auth state resolves |
| **Sidebar nav** (`NAV_ITEMS` in constants) | Shows only role-appropriate navigation items | Sidebar generated from `NAV_ITEMS[navKey]` where `navKey` is derived from zone |
| **Firestore security rules** (primary) | Prevents cross-tenant data access at the database level | `isPlatformAdmin()`, `isMerchant()`, `canAccessStore(storeId)`, `isStaff()` |
| **Callable functions** | Server-side authorization on mutations | `assertPlatformAdmin()`, `assertMerchantOf()` |

---

## Route Isolation Summary

| Attempt | Result | Mechanism |
|---|---|---|
| Merchant → `/platform` | Redirect to `/platform/` | ZoneRouter role check |
| Merchant → `/platform/stores` | Redirect to `/platform/` | ZoneRouter role check |
| Customer → `/dashboard` | Redirect to `/login?role=customer` | ZoneRouter role check |
| Customer → `/platform` | Redirect to `/` | ZoneRouter role check |
| Merchant A → `/dashboard` (with store B data in URL) | 403/empty data | Firestore `canAccessStore(storeId)` |
| Customer → `/store/:wrongSlug` product data of another store | 404 (store not found) | `StoreSlugLoader` loads correct store; queries scoped by storeId |

---

## Permission Keys (Per-Store RBAC via RoleDef)

For `staff` team members, granular permissions are stored on `RoleDef` documents:

| Permission Key | Scope | Description |
|---|---|---|
| `products:manage` | Store | Create, edit, delete products |
| `orders:manage` | Store | View, update order status |
| `customers:manage` | Store | View, edit, segment customers |
| `reports:view` | Store | View analytics and reports |
| `settings:manage` | Store | Edit store configuration |
| `team:manage` | Store | Invite/remove team members |
| `coupons:manage` | Store | Create/edit/delete coupons |
| `landing:manage` | Store | Edit landing pages |

**Note:** Per-store RBAC enforcement via these permission keys is a **future enhancement**. Currently, `staff` role users inherit `canAccessStore(storeId)` from the Firestore rules, which grants the same access as `merchant`. The permission key infrastructure (`RoleDef`, `TeamMember`, `Roles` page) is in place but not yet wired into route/component-level guards.