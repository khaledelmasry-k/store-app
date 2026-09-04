# Matjari (متجري) — SaaS (Firebase V2)

A multi-tenant **e-commerce SaaS** built on the **Firebase** stack (Auth, Firestore, Storage, Hosting, Cloud Functions) — no Express, no Prisma, no PostgreSQL. Designed to run on the **Spark Free Plan** with a clear upgrade path.

The platform serves three independent, fully isolated applications from a single Preact + TypeScript + Vite frontend:

| App         | Route prefix     | Role required       | Description                          |
| ----------- | ---------------- | ------------------- | ------------------------------------ |
| Platform    | `/platform/*`    | `platformAdmin`     | Admin panel — manage stores, orders, subscriptions, reports across all merchants. |
| Merchant    | `/merchant/*`    | `merchant`          | Store dashboard — products, orders, customers, analytics for the authenticated store. |
| Storefront  | `/store/:slug/*` | `_public` (customer) | Public storefront — catalog, cart, checkout, order tracking. |

---

## Quick start (local dev)

```bash
# 0. copy the env file (Firebase public keys)
cp .env.example .env.local

# 1. install the frontend
npm install
npm run dev          # http://localhost:5173

# 2. install + serve the Firebase emulators (optional but recommended)
cd functions && npm install
firebase emulators:start
```

Set `VITE_FIREBASE_USE_EMULATOR=true` in `.env.local` to point the frontend at the local emulators.

### Seeding a super-admin (emulator only)

```bash
# In the Auth emulator UI (http://localhost:4000/auth) create a user, then in a
# Cloud Functions shell / Firestore rules test:
firebase emulators:exec 'node scripts/seed-superadmin.mjs'
```

---

## Project structure

```
src/
  App.tsx              # Router — three isolated zones (platform / merchant / store)
  main.tsx             # Bootstrap (providers: Theme, Toast, Auth, Store, Cart)
  index.css            # Full design system + tokens (light/dark, RTL)
  shared/
    firebase/index.ts  # Firebase app + Auth/Firestore/Storage init
    types/index.ts     # All domain types (User, Store, Product, Order, ...)
    contexts/          # AuthContext, ThemeContext, ToastContext, StoreContext, CartContext
    providers/         # Provider components
    hooks/             # useAuth, useStore, useToast, useTheme, useCart, useCollection, useDocument
    utils/             # format, validators, constants, firestore helpers, clsx
    services/          # Firestore data layer (users, stores, products, orders, ...)
    components/
      ui/              # 19 shared UI primitives (Button, Card, Table, Modal, ...)
      charts/          # hand-rolled SVG charts (Bar / Line / Donut)
      layout/          # PlatformLayout, MerchantLayout, StoreLayout
      guards/          # RequireRole, PublicOnly
      auth/            # Login, Register
      nav/             # PlatformSidebar / MerchantSidebar (in AppShell)
      order/           # OrderDetails (shared component)
  platform/pages/      # Platform application (16 pages)
  merchant/pages/      # Merchant application (17 pages)
  store/pages/         # Customer storefront (8 pages)
functions/
  src/index.ts         # 6 callable Cloud Functions (the only server-side logic)
  package.json / tsconfig.json
firebase.json          # Hosting, Functions, Emulators config
firestore.rules        # Security rules (store isolation)
firestore.indexes.json # Composite indexes
storage.rules          # Storage rules
.env.example           # Firebase public config
```

See [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) for the full layout and [ROUTING.md](./ROUTING.md) for the route map.

---

## Architecture principles

- **No backend server.** All data lives in Firestore; all auth in Firebase Auth; all files in Cloud Storage. Cloud Functions are used **only** for atomic, security-critical operations (see SECURITY.md).
- **Multi-tenant by design.** Every document belongs to a `storeId`; every query is filtered by `storeId`; Firestore Rules verify `storeId` ownership. There is no way for a tenant to read another tenant's data.
- **Spark Free Plan friendly.** No scheduled functions or background triggers (Spark has no background triggers). Daily analytics are written to a single `analytics/{storeId}_{date}` document *on the write path* (inside `createOrder`/`updateOrderStatus`) instead of recomputing on read — this keeps daily read counts low.
- **Role isolation.** Three completely separate UIs, three separate logins, three route guards — roles are never swapped at runtime and dashboards are never mixed.
- **Offline-first storefront.** The customer store renders from Firestore directly; Auth persistence enables guest checkout.

---

## Tech stack

- **Preact 10** (hooks) — lightweight, compatible with React tooling.
- **TypeScript** (strict off — pragmatic), **Vite 8** / Rolldown bundler.
- **Wouter** — tiny router with nested routes + `useRoute`.
- **Firebase 11**: Auth, Firestore (v2), Storage, Functions (v2), Hosting.
- **Hand-rolled SVG charts** — zero charting dependencies.
- **oxlint** — linting (exit 0, warnings only).

---

## Testing & quality

```bash
npm run typecheck     # tsc --noEmit (0 errors)
npm run lint          # oxlint
npm run build         # production build
firebase emulators:start   # full local stack: Auth, Firestore, Functions, Storage, Hosting, UI
```

---

## Production deploy

```bash
firebase login
firebase deploy        # hosting + functions + firestore rules + indexes
# first-time only:
firebase deploy --only firestore:indexes
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) and [FIREBASE_SETUP.md](./FIREBASE_SETUP.md).

---

## License

Proprietary — Matjari (متجري).
