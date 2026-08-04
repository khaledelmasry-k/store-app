# Changelog

All notable changes to this project. Format based on [Keep a Changelog](https://keepachangelog.com/).

## [2.0.0] — Firebase SaaS rewrite (this branch: `firebase-v2`)

### Added
- Complete multi-tenant SaaS architecture on **Firebase** (Auth, Firestore, Storage, Hosting, Functions v2).
- Three fully isolated applications sharing one frontend:
  - **Platform** (`/platform/*`) — global admin dashboard (16 pages).
  - **Merchant** (`/merchant/*`) — per-store merchant dashboard (17 pages).
  - **Customer storefront** (`/store/:slug/*`) — public shop (8 pages).
- Full design system: 19 shared UI primitives, hand-rolled SVG charts (Bar / Line / Donut), `clsx` helper, RTL layout, **light & dark themes** with persistence.
- Shared contexts & hooks: `AuthProvider`, `ThemeProvider`, `ToastProvider`, `StoreProvider`, `CartProvider`; `useAuth`, `useStore`, `useToast`, `useTheme`, `useCart`, `useCollection`, `useDocument`, `useDebounce`.
- Data layer: `src/shared/services/*` covering all 17 Firestore collections, with realtime `useCollection`/`useDocument`.
- **Cloud Functions (v2, callable)** — the only server-side logic:
  - `generateOrderNumber` — transactional `ORD-NNNNN`.
  - `createOrder` — atomic stock deduction + order + customer upsert.
  - `registerMerchant` — atomic users + stores + subscriptions + Auth user.
  - `approveSubscription` — random one-time password, activation, notification.
  - `updateOrderStatus` — stock restoration on cancel/return.
  - `impersonate` — short-lived custom token for support.
- Firestore security rules (`firestore.rules`) + Storage rules + composite indexes (`firestore.indexes.json`).
- Spark-friendly **denormalized daily analytics** (`analytics/{storeId}_{date}`) updated on the write path.
- `firebase.json` (Hosting rewrites, Emulators, Functions runtime), `.firebaserc`, `.env.example`.
- Documentation: README, PROJECT_STRUCTURE, ROUTING, DATABASE, FIREBASE_SETUP, SECURITY, ROLE_MATRIX, CHANGELOG, DEPLOYMENT.

### Removed
- Express server (`server/`), Prisma, PostgreSQL, SQLite, migrations (`migrations/`), `Dockerfile`, `docker-compose.yml`, `entrypoint.sh`, uploads folder.
- All legacy `src/pages/*` (replaced by the three apps under `src/{platform,merchant,store}`).
- Legacy `src/components/Sidebar.tsx`, `src/services/api.ts`, `src/types/index.ts`, `src/hooks/*`, `src/utils/*`.
- Legacy docs (`docs/*`), `HANDOFF.md`.

### Changed
- Routing rewritten on **Wouter**: nested `/platform`, `/merchant`, `/store/:slug` zones with role guards.
- No runtime role switching — three login entry points (`/login?role=platform|merchant|customer`).

### Notes / Decisions
- **Spark Free Plan target:** no scheduled functions, no background triggers. Analytics are written via `FieldValue.increment` on the order/status transactions.
- **Orders cannot be created client-side** — `allow create: if false` in rules; `createOrder` function enforces it.
- **Zero data migration** — V2 starts from an empty Firestore; the legacy Postgres DB held only a super-admin placeholder.

## [1.0.0] — V1 prototype (Express / Prisma / PostgreSQL)

The original production-hardened build. Commit `35b8e9c`. Retained only as git history; **removed in this branch** in favor of the Firebase architecture above.
