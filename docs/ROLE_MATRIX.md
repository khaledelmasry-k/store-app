# Role Matrix

| Action                                  | platformAdmin | merchant | customer | public (anon) | How enforced                      |
| --------------------------------------- | ------------- | -------- | -------- | ------------- | --------------------------------- |
| Platform dashboard                       | ✓            | ✗        | ✗        | ✗             | Route guard `RequireRole`         |
| Manage stores / merchants                | ✓            | ✗        | ✗        | ✗             | Firestore rule + guard            |
| Manage products (any store)              | ✓            | own only | ✗        | ✗             | Rule `canAccessStore`             |
| Create/edit products                     | ✓            | own only | ✗        | ✗             | Rule on `storeId`                 |
| View own orders                          | ✓            | ✓        | via phone | via phone    | Rule + phone match                |
| Update order status                      | ✓            | own only | ✗        | ✗             | `updateOrderStatus` function      |
| Create order (checkout)                  | —            | —        | via cart | via cart     | `createOrder` function (anon ok)  |
| Manage own customers                     | ✓            | own only | self     | ✗             | Rule `storeId`                    |
| Edit customer segment/note               | ✓            | own only | self     | ✗             | Rule                              |
| Plan / subscription admin                | ✓            | ✗        | ✗        | ✗             | Rule                              |
| Approve a subscription                   | ✓            | ✗        | ✗        | ✗             | `approveSubscription` func        |
| Register a new merchant                  | —            | —        | —        | ✓             | `registerMerchant` function       |
| Manage coupons                           | ✓            | own only | ✗        | ✗ (read own)  | Rule                              |
| Validate coupon at checkout              | —            | —        | via cart | via cart     | Client (code read)                |
| Manage shipping zones                    | ✓            | own only | ✗        | ✗             | Rule                              |
| Manage team / members                    | ✓            | own only | ✗        | ✗             | Rule                              |
| Manage roles & permissions               | ✓ (sys)      | own only | ✗        | ✗             | Rule                              |
| Invite team member                       | —            | own only | ✗        | ✗             | `roles:manage` perm / rule        |
| Manage landing pages                     | ✓            | own only | ✗        | ✓ (read)      | Rule                              |
| Manage store links                       | ✓            | own only | ✗        | ✓ (read)      | Rule                              |
| Read analytics dashboard                 | ✓            | own only | ✗        | ✗             | Rule                              |
| View audit log                           | ✓            | own only | ✗        | ✗             | Rule                              |
| Read platform settings                   | ✓            | ✗        | ✗        | ✗             | Rule                              |
| Edit platform settings                   | ✓            | ✗        | ✗        | ✗             | Rule                              |
| View own wishlist                        | —            | —        | self      | ✗             | Rule (`userId`)                    |
| Manage own addresses                     | —            | —        | self      | ✗             | Rule (`userId`/`storeId`)          |
| Impersonate a merchant                   | ✓            | ✗        | ✗        | ✗             | `impersonate` function            |

### How roles are set

- On **registration**, `registerMerchant` creates a `users` document with `role: 'merchant'` (inactive until a subscription is approved).
- `approveSubscription` activates the account.
- The platform seed script creates the first `platformAdmin`.
- A `customer` is anyone who signs up on the storefront (`/store/:slug/login`) — the `signupCustomer` flow writes a `users` doc with `role: 'customer'`.

### Permission scopes (for future RBAC)

Roles defined per store can be granted a subset of these permission keys (stored on the `roles` document):

`products:manage`, `orders:manage`, `customers:manage`, `reports:view`, `settings:manage`, `team:manage`, `coupons:manage`, `landing:manage`.

(Future enhancement: gate UI + rules via these scopes instead of just the account role.)
