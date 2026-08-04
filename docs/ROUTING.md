# Routing

Built on [Wouter](https://github.com/molefrog/wouter) (Preact-compatible). The router lives in `src/App.tsx`.

## Zones

The app has three **isolated zones** — no page in one zone is ever rendered inside another.

| Zone       | Mount       | Layout          | Guard                         |
| ---------- | ----------- | --------------- | ----------------------------- |
| `/`        | public      | none            | redirects by role             |
| `/login?role=*` | public | none            | `PublicOnly`                  |
| `/register` | public     | none            | `PublicOnly`                  |
| `/platform/*`    | `PlatformLayout` | `RequireRole('platformAdmin')` |
| `/merchant/*`    | `MerchantLayout` | `RequireRole('merchant')`      |
| `/store/:slug/*` | `StoreLayout`   | none (public storefront)       |

## Login

There are three distinct login entry points selected by `?role=`:

```
/login?role=platform   → PlatformLogin
/login?role=merchant   → MerchantLogin
/login?role=customer   → CustomerLogin (storefront login)
```

A single `Login` component renders all three; it reads `role` from the query string and redirects to the correct dashboard once authenticated. **Roles are never swapped at runtime** — logging out and back in through a different login URL is the only way to switch.

## Route map

### Platform (`/platform/*`)
| Route              | Page                          |
| ------------------ | ----------------------------- |
| `/platform`        | `Dashboard`                   |
| `/platform/merchants` | `Merchants`                |
| `/platform/stores/:id` | `StoreDetails`            |
| `/platform/products` | `Products`                   |
| `/platform/orders`   | `Orders`                     |
| `/platform/orders/:id` | `OrderDetails`             |
| `/platform/customers` | `Customers`                 |
| `/platform/subscriptions` | `Subscriptions`         |
| `/platform/plans`    | `Plans`                       |
| `/platform/payments` | `Payments`                    |
| `/platform/transactions` | `Transactions`          |
| `/platform/coupons`  | `Coupons`                      |
| `/platform/reports`  | `Reports`                      |
| `/platform/tickets`  | `Tickets`                      |
| `/platform/audit`    | `Audit`                        |
| `/platform/notifications` | `Notifications`       |
| `/platform/settings` | `Settings`                     |

### Merchant (`/merchant/*`)
| Route              | Page                          |
| ------------------ | ----------------------------- |
| `/merchant`        | `Dashboard`                   |
| `/merchant/products` | `Products` (+ editor)       |
| `/merchant/categories` | `Categories`                |
| `/merchant/orders`   | `Orders`                     |
| `/merchant/orders/:id` | `OrderDetails`             |
| `/merchant/customers` | `Customers` (+ detail editor) |
| `/merchant/coupons`  | `Coupons`                    |
| `/merchant/shipping` | `Shipping`                    |
| `/merchant/reports`  | `Reports`                     |
| `/merchant/analytics` | `Analytics`                  |
| `/merchant/team`     | `Team`                        |
| `/merchant/roles`    | `Roles`                       |
| `/merchant/landing-pages` | `LandingPages`           |
| `/merchant/store-links` | `StoreLinks`               |
| `/merchant/notifications` | `Notifications`          |
| `/merchant/tickets`  | `Tickets`                     |
| `/merchant/subscription` | `Subscription`            |
| `/merchant/settings` | `Settings`                     |

### Customer storefront (`/store/:slug/*`)
| Route              | Page       | Notes                              |
| ------------------ | ---------- | ---------------------------------- |
| `/store/:slug`     | `Home`     | Hero + category filter + products  |
| `/store/:slug/catalog` | `Catalog` | Filter by category + search      |
| `/store/:slug/product/:id` | `Product` | Gallery, variants, add-to-cart |
| `/store/:slug/cart` | `Cart`     | Edit qty / remove                  |
| `/store/:slug/checkout` | `Checkout` | Address, payment method, calls `createOrder` |
| `/store/:slug/track` | `Track`   | Phone + order-number lookup (no auth) |
| `/store/:slug/account` | `Account` | Requires `customer` role — orders, addresses, wishlist |
| `/store/:slug/login` | `Login`   | Customer auth (login/signup toggle)  |

## Lazy loading

Zone route modules are lazy-loaded via `lazy()` + ` Suspense` so each application only ships its own code. Shared components and the Firebase SDK are split into separate vendor chunks (`manualChunks`).
