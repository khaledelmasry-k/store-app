# Database (Firestore)

The entire persistence layer is **Cloud Firestore (Native mode)**. There is no SQL database.

## Collections (17)

| Collection        | Scope             | Description                                   |
| ----------------- | ----------------- | --------------------------------------------- |
| `users`           | global             | Auth + role profile (`role`, `storeIds`).        |
| `stores`         | global             | Tenant registry (`ref`, `slug`, `ownerId`, `theme`). |
| `products`        | per-store          | Catalog entries (`storeId`, `variants`, `stock`). |
| `categories`      | per-store          | Product groupings.                             |
| `orders`          | per-store          | Customer orders (created via callable only).   |
| `customers`       | per-store          | Customer profiles (`segment`, `note`, `tags`). |
| `subscriptions`   | per-store          | Plan subscription lifecycle.                   |
| `plans`           | global             | Subscription plans (pricing).                   |
| `transactions`    | per-store          | Money movements.                               |
| `payments`        | per-store          | Order payment records.                        |
| `coupons`         | per-store          | Discount codes.                                |
| `shipping`        | per-store          | Shipping zones (`governorates`, `fee`).         |
| `notifications`   | per-store + user   | In-app notifications.                          |
| `tickets`         | per-store          | Support tickets.                                |
| `auditLogs`       | per-store          | Audit trail (written via functions).           |
| `settings`        | platform-wide      | Platform settings (single doc `platform`).      |
| `analytics`       | per-store          | Daily aggregates (denormalized).                |

## Tenant isolation

- **Every** document stores:
  - `storeId` — the owning tenant,
  - `createdAt`, `updatedAt`, `createdBy` (server timestamp / auth uid).
- Every client query is filtered by `storeId` (`useCollection(path, { storeId })`).
- The `users` document stores an array `storeIds[]` — a merchant may own/operate multiple stores.
- Firestore **Security Rules** verify ownership on every write (see SECURITY.md).

## Document example: `orders/{id}`

```jsonc
{
  "storeId": "abc123",
  "orderNumber": "ORD-00012",
  "customerName": "محمد علي",
  "phone": "01000000000",
  "governorate": "القاهرة",
  "city": "القاهرة",
  "address": "...",
  "items": [
    { "productId": "...", "name": "حذاء ورّق", "price": 499, "quantity": 1, "color": "أبيض", "size": "42" }
  ],
  "subtotal": 499,
  "shippingFee": 30,
  "discount": 0,
  "totalPrice": 529,
  "status": "NEW",              // NEW | CONTACTED | PROCESSING | SHIPPED | DELIVERED | CANCELLED | RETURNED
  "paymentMethod": "cod",       // cod | bank | card | wallet
  "couponCode": null,
  "trackingCode": null,
  "customerId": null,
  "createdAt": "timestamp",
  "updatedAt": "timestamp",
  "createdBy": "uid"
}
```

## Denormalized analytics (Spark-friendly)

Spark has a **daily read/write cap** but no background/trigger functions. To avoid recomputing dashboards by scanning every order, a single document per store per day is maintained **on the write path**:

```
analytics/{storeId}_{YYYY-MM-DD} = {
  storeId, date, orders, revenue, newCustomers, byStatus: { ... }
}
```

- `createOrder` increments `analytics/{storeId}_{today}` when an order is created.
- `updateOrderStatus` adjusts `byStatus` counts when status changes.

> Result: dashboard reads = 1 doc per day per tile instead of scanning the whole `orders` collection.

## Composite indexes

Defined in `firestore.indexes.json`. The emulator will report any missing index (error message contains a direct link to create it in the Firebase console). Key indexes:

- `orders`: by `storeId` + `status` + `createdAt`; `storeId` + `customerId` + `createdAt`.
- `products`: `storeId` + `active` + `createdAt`; `storeId` + `categoryId` + `createdAt`.
- `notifications`: `userId` + `createdAt`; `storeId` + `createdAt`.
- `analytics`: `storeId` + `date`.
- `auditLogs`: `storeId` + `createdAt`.
- `wishlist`: `userId` + `productId` (unique enforcement via `set` overwrite).

## Counters

Per-store monotonic counters live under a sub-collection to be safe under concurrency:

```
stores/{storeId}/counters/orders = { value: <next sequence> }
```

`generateOrderNumber` and `createOrder` read-modify-write this inside a Firestore **transaction**, guaranteeing unique `ORD-00001` numbers even under concurrent writes.

## No migrations

V2 starts from a **clean Firestore** — the legacy PostgreSQL data contains only a super-admin placeholder. There is no schema migration: collections are created lazily on first write. See CHANGELOG.md.
