# API Reference — M&K Store

Base URL: `http://<host>:3001/api`

All requests use JSON. Protected routes require the JWT returned by the login or
register response in an `Authorization: Bearer <token>` header.

Merchant-scoped routes also resolve the active store via the `X-Store-Id` header
(optional; when omitted the middleware falls back to the caller's first accessible
store — see `server/src/middleware/permission.ts`).

---

## Conventions

- `POST` bodies are validated with Zod. Validation failures return
  `400 { "error": "...", "details": {...} }`.
- Auth failures return `401`. Missing store returns `403 { "error": "Store not found" }`.
- RBAC denial returns `403 { "error": "Forbidden" }`.
- Rate limits: global `100 req/min`, auth `10 req/min`, order creation `30 req/min`.

---

## Public endpoints

### Authentication

| Method | Path                  | Description |
| ------ | --------------------- | ----------- |
| POST   | `/admin/login`        | Login (username + password) → `{ token, admin }`. |
| POST   | `/auth/register`      | Merchant self-registration (atomic: admin + tenant + store + starter product + subscription). |

Register body: `{ name, email, password, companyName, storeName, subdomain, plan? }`.
Username is derived from the email local-part.

### Storefront

| Method | Path                       | Description |
| ------ | -------------------------- | ----------- |
| GET    | `/orders/products`         | Products for a store (query: `ref`). |
| GET    | `/orders/product`          | Single product (query: `ref`, `id`). |
| POST   | `/orders`                  | Create an order (stock deducted atomically in a transaction). |
| GET    | `/orders/track/:orderNumber` | Public order tracking (PII stripped — no customer contact fields). |
| GET    | `/orders/links/resolve/:slug` | Resolve a marketing link slug → landing page/store. |
| GET    | `/merchant/landing-pages/public/:slug` | Published landing page (no auth). |
| GET    | `/subscriptions/plans`     | Available subscription plans. |
| POST   | `/subscriptions/request`   | Request a subscription/plan upgrade. |

`POST /orders` body (ref is the store's public reference):

```json
{
  "ref": "mystore",
  "customerName": "...", "phone": "...", "governorate": "...", "city": "...", "address": "...",
  "notes": "optional",
  "sellerId": "optional", "landingPageId": "optional", "landingPageSlug": "optional",
  "marketingLinkId": "optional", "utmSource": "optional", "utmMedium": "optional", "utmCampaign": "optional",
  "items": [{ "productId": "...", "name": "...", "color": "أحمر", "size": "L", "quantity": 1 }]
}
```

Response: `{ orderNumber, totalPrice, items, message }`.

---

## Super admin (`/api/admin`)

Requires a `super_admin` token.

| Method | Path                  | Description |
| ------ | --------------------- | ----------- |
| GET    | `/admin/me`           | Current admin profile. |
| GET    | `/admin/orders`       | Orders across tenants (filters: status, search, store). |
| GET    | `/admin/orders/dashboard` | Global dashboard stats. |
| GET    | `/admin/orders/seller-stats` | Per-seller stats. |
| PATCH  | `/admin/orders/:id/status` | Update order status (restores stock on CANCELLED/RETURNED). |
| DELETE | `/admin/orders/:id`   | Delete order (restores stock). |
| GET    | `/admin/product`      | Store products. |
| PUT    | `/admin/product`      | Create/update product (enforces plan limit). |
| DELETE | `/admin/product`      | Delete product. |
| POST   | `/admin/upload`       | Upload an image (multipart) → `{ url }`. |
| GET    | `/admin/settings/stores` | List stores. |
| POST   | `/admin/settings/stores` | Create store. |
| PATCH  | `/admin/settings/stores/:id` | Update store. |
| DELETE | `/admin/settings/stores/:id` | Delete store. |
| GET    | `/admin/settings/admins` | List platform admins. |
| POST   | `/admin/settings/admins` | Create platform admin (role: `seller` or `super_admin`). |
| DELETE | `/admin/settings/admins/:id` | Delete platform admin. |
| GET    | `/admin/tenants`      | List tenants. |
| GET    | `/admin/tenants/:id`  | Tenant detail. |
| PATCH  | `/admin/tenants/:id`  | Update tenant. |
| DELETE | `/admin/tenants/:id`  | Delete tenant. |
| GET    | `/subscriptions/admin/requests` | Pending subscription requests. |
| PATCH  | `/subscriptions/admin/requests/:id` | Approve/reject (approval creates an admin with a one-time random password). |

---

## Merchant dashboard (`/api/merchant/*`)

Requires a merchant token (`seller` role) and a store context.

| Method | Path                        | Description |
| ------ | --------------------------- | ----------- |
| GET    | `/merchant/products`        | List products (paginated). |
| GET    | `/merchant/products/low-stock` | Low-stock products. |
| GET    | `/merchant/products/:id`    | Product detail. |
| POST   | `/merchant/products`        | Create product. |
| PUT    | `/merchant/products/:id`    | Update product. |
| DELETE | `/merchant/products/:id`    | Delete product. |
| POST   | `/merchant/products/:id/duplicate` | Duplicate product. |
| GET    | `/merchant/categories`      | List categories. |
| POST   | `/merchant/categories`      | Create category. |
| DELETE | `/merchant/categories/:id`  | Delete category. |
| GET    | `/merchant/customers`       | Customers aggregated by phone (search, segment filter, pagination). |
| GET    | `/merchant/customers/:phone`| Customer detail. |
| POST   | `/merchant/customers/:phone/notes` | Add a note (persisted on the latest order). |
| PUT    | `/merchant/customers/:phone/segment` | Set segment (persisted on the customer's orders). |
| GET    | `/admin/orders`          | Orders (merchant store-scoped; filters: status, page, search). |
| GET    | `/admin/orders/dashboard` | Store dashboard stats. |
| PATCH  | `/admin/orders/:id/status` | Update order status (stock restored on CANCELLED/RETURNED). |
| DELETE | `/admin/orders/:id`      | Delete order. |
| GET    | `/merchant/analytics/overview` | Revenue, orders, conversion, AOV. |
| GET    | `/merchant/analytics/daily` | Daily revenue series. |
| GET    | `/merchant/analytics/top-products` | Top products. |
| GET    | `/merchant/analytics/seller-performance` | Seller performance. |
| GET    | `/merchant/analytics/campaigns` | Campaign performance. |
| GET    | `/merchant/analytics/traffic-sources` | Traffic sources. |
| GET    | `/merchant/settings`       | Store settings + integrations. |
| PUT    | `/merchant/settings/store` | Update store info. |
| PUT    | `/merchant/settings/settings` | Update store settings (pixel, shipping, integrations). |
| GET    | `/merchant/settings/stores` | List accessible stores. |
| GET    | `/merchant/landing-pages`  | List landing pages. |
| GET    | `/merchant/landing-pages/:id` | Landing page detail. |
| POST   | `/merchant/landing-pages`  | Create landing page. |
| PUT    | `/merchant/landing-pages/:id` | Update landing page. |
| DELETE | `/merchant/landing-pages/:id` | Delete landing page. |
| POST   | `/merchant/landing-pages/:id/publish` | Publish/unpublish. |
| GET    | `/merchant/team`           | Team members. |
| DELETE | `/merchant/team/:id`       | Remove team member. |
| GET    | `/merchant/roles`          | Roles. |
| GET    | `/merchant/roles/resources`| RBAC resources. |
| POST   | `/merchant/roles`          | Create role. |
| PUT    | `/merchant/roles/:id`      | Update role. |
| DELETE | `/merchant/roles/:id`      | Delete role. |
| GET    | `/merchant/invitations`    | Team invitations. |
| POST   | `/merchant/invitations`    | Create invitation. |
| DELETE | `/merchant/invitations/:id`| Revoke invitation. |
| GET    | `/merchant/invitations/accept/:token` | Resolve invitation token. |
| POST   | `/merchant/invitations/accept` | Accept invitation. |
| GET    | `/merchant/notifications`  | Notifications. |
| PATCH  | `/merchant/notifications/:id/read` | Mark read. |
| PATCH  | `/merchant/notifications/read-all` | Mark all read. |
| GET    | `/merchant/reports/summary`| Summary report. |
| GET    | `/merchant/reports/period` | Period report (from/to). |
| GET    | `/merchant/reports/export-csv` | CSV export (BOM, quoted, CSV-injection safe). |

---

## Seller endpoints (`/api/seller/*`)

| Method | Path                       | Description |
| ------ | -------------------------- | ----------- |
| GET    | `/seller/dashboard`        | Seller dashboard stats. |
| GET    | `/seller/orders`           | Orders (store-scoped). |
| GET    | `/seller/orders/:id`       | Order detail. |
| PATCH  | `/seller/orders/:id/status`| Update order status (stock restored on CANCELLED/RETURNED). |
| DELETE | `/seller/orders/:id`       | Delete order (restores stock). |
| GET    | `/seller/product`          | Store products. |
| PUT    | `/seller/product`          | Create/update product (plan limit enforced). |
| GET    | `/seller/stores`           | Seller's stores. |
| POST   | `/seller/stores`           | Create store (plan limit enforced). |
| PATCH  | `/seller/stores/:id`       | Update store. |
| DELETE | `/seller/stores/:id`       | Delete store. |
| POST   | `/seller/stores/:id/assign`| Assign store to a seller. |
| GET    | `/seller/store-links`      | List store/marketing links. |
| POST   | `/seller/store-links`      | Create link. |
| PATCH  | `/seller/store-links/:id`  | Update link (slug uniqueness enforced → 409). |
| DELETE | `/seller/store-links/:id`  | Delete link. |
| PATCH  | `/seller/store-links/:id/click` | Increment link click counter. |

---

## Auth

| Method | Path        | Description |
| ------ | ----------- | ----------- |
| GET    | `/auth/me`  | Current admin (token required). |

---

## Health

| Method | Path         | Description |
| ------ | ------------ | ----------- |
| GET    | `/api/health`| `{ "status": "ok" }` when the server is running. |

---

## RBAC

`requirePermission(resource, action)` in `server/src/middleware/permission.ts`:

- `SUPER_ADMIN`, `OWNER`, `ADMIN` → full access.
- `EDITOR` (and unknown roles) → read-only (`view` actions only).

Resources: `products`, `orders`, `customers`, `settings`, `sellers`, `team`,
`store-links`, `landing-pages`, `reports`.
