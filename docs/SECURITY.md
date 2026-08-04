# Security

Security is **declarative** (Firestore & Storage rules) + **imperative** (minimal Cloud Functions).

## 1. Authentication

- **Firebase Authentication** (Email/Password) is the only provider.
- The user's `role` and `storeIds[]` live in the `users/{uid}` **document**, not in a custom claim — so role changes take effect immediately (no token refresh needed).
- A `platformAdmin` may optionally also carry a Firebase **custom claim** `admin=true` as defense-in-depth, but rules read the document field, so claims are not required for correctness.

## 2. Firestore rules — per-store isolation

Every write validates that the caller owns/operates the document's `storeId`:

```js
function canAccessStore(storeId) {
  return isSignedIn()
    && get(/databases/$(database)/documents/users/$(request.auth.uid)).data
       .storeIds.hasAll([storeId]);
}

match /products/{id} {
  allow read: if true;              // public catalog
  allow write: if isAdminOrStore(request.resource.data.storeId);
}

match /orders/{id} {
  allow read: if isAdminOrStore(resource.data.storeId);
  allow create: if false;          // orders created ONLY via createOrder()
  allow update: if isAdminOrStore(resource.data.storeId);
}
```

Key rules:
- **`orders.create` is denied (`false`)** — orders can *only* be created through the `createOrder` callable function, which enforces atomic stock checks. A client can never fabricate an order with arbitrary stock.
- **`auditLogs` and `notifications` writes** are denied to clients (`allow write: if false`); only functions write them.
- **`storeLinks` / `landingPages` / `shipping` / `coupons` reads** are public (the storefront needs them); writes require store ownership.
- A storefront visitor can read products/categories/shipping/landing by `storeId`; `orders` reads require matching the order's `phone` (tracking flow is public-by-URL, validated server-side).

## 3. Storage rules

- `products/{storeId}/*` — public read; write requires an authenticated merchant whose `storeId` matches.
- `stores/{storeId}/*` — public read; write requires store ownership.
- `documents/{storeId}/*` — read/write for the owning merchant only.

## 4. Why Cloud Functions exist

The **six** callable functions are the only server-side surface. They are required because:

1. **`createOrder`** — must atomically check stock **and** write the order. A client-side read-then-write cannot prevent a race that oversells. Uses a Firestore **transaction** + variant-level deduction.
2. **`generateOrderNumber`** — `ORD-00001` global sequence needs a shared counter; only a transaction can assign it safely under concurrency.
3. **`registerMerchant`** — must create `users`, `stores`, and a `subscriptions` doc atomically, and create the Firebase Auth user consistently.
4. **`approveSubscription`** — platform admin action: sets a random one-time password on the merchant's Auth account. This cannot be done client-side.
5. **`updateOrderStatus`** — stock restoration on cancel/return must be atomic; rules alone can't enforce "restore stock when status flips to CANCELLED".
6. **`impersonate`** — issues a short-lived `signInWithCustomToken` for a platform admin to act as a merchant; sensitive token logic that must stay server-side.

Everything else (products, customers, settings, team, roles, coupons, landing pages, notifications read, analytics read) runs **client-direct to Firestore** gated by rules — minimizing function invocations (cheap on Spark).

## 5. Input validation

- Frontend uses `useForm`-style validation (`validators.ts`) for UX.
- Functions re-validate every input (`HttpsError('invalid-argument', ...)`) — **never trust the client**.

## 6. Secrets management

- The only secret the server (Functions) needs is the default service account — no manual secrets.
- Client config in `.env.local` contains **public** keys only.
- `.env`/`.env.local` are gitignored; `.env.example` contains only placeholders.

## 7. Abuse guards

- Rate limiting on `createOrder` (per IP/uid) can be added in Functions via Firestore counters (out of Spark's scope — see DEPLOYMENT.md upgrade path).
- Order numbers and stock are protected at the transaction level regardless of request rate.
