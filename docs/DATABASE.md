# Database Guide — M&K Store

## Engine

**PostgreSQL only.** The schema lives at `server/prisma/schema.prisma` (Prisma ORM).

- SQLite was fully removed; no alternate datasource files remain.
- Datasource is pinned to `postgresql`; the connection string comes from
  `DATABASE_URL`.

## Migrations

Migrations are committed under `server/prisma/migrations/` and applied in production
via `prisma migrate deploy` (see `server/entrypoint.sh`).

| Migration | Purpose |
| --------- | ------- |
| `0_init`  | Baseline — full schema (created from the then-current schema). |
| `20260731203812_add_customer_note_segment` | Adds `merchantNote` and `segment` columns to `orders` (persistent customer notes/segments). |

Workflow for future schema changes:

```bash
cd server
npx prisma migrate dev --name describe_change   # local dev (applies to dev DB + generates)
git add prisma/migrations
```

In production the container runs `npx prisma migrate deploy` on every start, so
deploying the new code also applies the new migration.

Local setup:

```bash
cd server
npx prisma migrate deploy
npx tsx src/seed.ts    # idempotent: creates super admin only if missing
```

## Models

All tables use UUID primary keys and snake_case physical names (`@@map`).

| Model | Table | Notes |
| ----- | ----- | ----- |
| `Admin` | `admins` | Platform users. `role`: `super_admin` or `seller`. |
| `Tenant` | `tenants` | Merchant organization. `subdomain` unique; `status` ACTIVE/SUSPENDED; `plan` FREE/STARTER/PRO. |
| `TenantUser` | `tenant_users` | Membership of an admin in a tenant with `role` OWNER/ADMIN/EDITOR — **the RBAC source of truth**. |
| `Subscription` | `subscriptions` | Admin ↔ tenant subscription records. |
| `Role` | `roles` | Named roles (defined per tenant). |
| `Permission` | `permissions` | Permission matrix (resource + actions). *Not wired to users; RBAC is enforced via `TenantUser.role`.* |
| `Invitation` | `invitations` | Pending team invites (token-based). |
| `Category` | `categories` | Product categories (tenant-scoped). |
| `Product` | `products` | Store products. `pricingTiers`, `variantStock`, `images`, `colors`, `sizes` stored as JSON strings. |
| `Order` | `orders` | Customer orders. `status` NEW/CONTACTED/PROCESSING/SHIPPED/DELIVERED/CANCELLED/RETURNED. `merchantNote`/`segment` are merchant-side annotations. |
| `OrderItem` | `order_items` | Line items: product ref, color, size, quantity, unit price. |
| `Seller` | `sellers` | Sales team members assigned to a store (with own tracking). |
| `Store` | `stores` | Storefront; unique `ref` (public reference), `adminId` owner, `tenantId`. |
| `StoreLink` | `store_links` | Marketing links with unique `slug`; click counter. |
| `LandingPage` | `landing_pages` | Published landing pages (unique slug, store-scoped). |
| `Notification` | `notifications` | In-app notifications. |
| `SubscriptionRequest` | `subscription_requests` | Plan-change requests pending super-admin approval. |

## Key fields

- **`Store.ref`** — the public identifier used to resolve a store on the storefront
  (`/api/orders`, `POST /api/orders`). Orders are linked to a store only through a
  valid `ref` (prevents arbitrary store selection).
- **`Order.orderNumber`** — unique human-readable number (`ORD-00001`). Generated
  inside a transaction using a `pg_advisory_xact_lock` to guarantee uniqueness under
  concurrency (`server/src/utils/orderNumber.ts`).
- **JSON columns** (`Product.pricingTiers`, `Product.variantStock`, `Product.images`,
  `Product.colors`, `Product.sizes`) are stored as text/JSON strings and parsed with
  `parseJsonField` — they are not native Postgres `jsonb` to keep the baseline simple.
- **Stock** lives in `Product.variantStock` (map `color → size → qty`). Order creation
  deducts stock atomically inside the order transaction; cancel/return/delete restore it.

## Indexes & uniqueness

- Unique: `admins.username`, `admins.email`, `tenants.subdomain`, `orders.orderNumber`,
  `stores.ref`, `store_links.slug`, `landing_pages.slug` (per scope), plus generated
  primary keys.
- Common lookups (orders by store/status, products by store, customers by phone) rely
  on the default B-tree indexes on the FK/status columns via Prisma relations.

## RBAC model

Roles and permissions are enforced at the middleware layer, not through the
`Role`/`Permission` tables:

- `server/src/middleware/permission.ts` — `getTenantRole` resolves the caller's role
  from `TenantUser` scoped to the current tenant (falls back to OWNER for legacy
  `Store.adminId` owners).
- `requirePermission(resource, action)` — SUPER_ADMIN/OWNER/ADMIN full access,
  EDITOR read-only.
- `enforcePlanLimit` — caps products/stores/links per plan (FREE = 1 product/store/link,
  STARTER = 1 store, PRO = unlimited).

## Seeding

`server/src/seed.ts` is idempotent: it creates the super admin
(`admin` / `admin123`) only if no super admin exists. The container runs it on every
start via `server/entrypoint.sh`.

## SQL notes (advisory lock)

`generateOrderNumber` uses `SELECT pg_advisory_xact_lock(727100)` within the same
transaction as order creation so concurrent orders on any store never collide on
`order_number`.
