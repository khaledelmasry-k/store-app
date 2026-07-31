# Project Structure — M&K Store

Monorepo: frontend (Preact + Vite) at the root, backend (Express + Prisma) under
`server/`. The production Docker image builds the frontend and serves it from the
Express server (`server/dist/public`), so a single container serves both the SPA and
the API.

```
├── src/                          # Frontend (Preact + TypeScript + Vite + wouter)
│   ├── main.tsx                  # App bootstrap
│   ├── App.tsx                   # Router + route guards (auth/store redirection)
│   ├── index.css                 # Global styles (RTL)
│   ├── pages/                    # Route components
│   ├── components/               # Shared UI (Sidebar, NotificationBell)
│   ├── services/api.ts           # API client (fetch wrapper, token, X-Store-Id)
│   ├── hooks/                    # React hooks
│   ├── utils/                    # Frontend helpers
│   ├── types/                    # Shared TypeScript types
│   └── preact-shims.d.ts         # Preact JSX type shims
│
├── server/                       # Backend (Express 5 + Prisma)
│   ├── src/
│   │   ├── index.ts              # App entry: middleware, CORS, routes, static SPA
│   │   ├── config.ts             # Env config; fails fast on weak JWT_SECRET
│   │   ├── seed.ts               # Idempotent super-admin seed
│   │   ├── middleware/
│   │   │   ├── auth.ts           # authMiddleware, requireSuperAdmin, JWT verify
│   │   │   ├── permission.ts     # getTenantRole, requireStore, requirePermission, enforcePlanLimit
│   │   │   └── errorHandler.ts   # Central error → JSON
│   │   ├── routes/
│   │   │   ├── admin.ts          # Super-admin login, /me
│   │   │   ├── auth.ts           # Merchant register, /me
│   │   │   ├── store.ts          # Public storefront: products, orders, tracking, links
│   │   │   ├── orders.ts         # Admin/merchant order list, dashboard, status, delete
│   │   │   ├── product.ts        # Store product CRUD (legacy single-store)
│   │   │   ├── merchantProducts.ts # Multi-store product CRUD + low-stock + duplicate
│   │   │   ├── categories.ts     # Category CRUD
│   │   │   ├── customers.ts      # Customers aggregated by phone; notes + segment
│   │   │   ├── analytics.ts      # Overview/daily/top-products/sellers/campaigns/sources
│   │   │   ├── reports.ts        # Summary/period/export-csv (injection-safe)
│   │   │   ├── settings.ts       # Super-admin store & admin management
│   │   │   ├── merchantSettings.ts # Store info, settings, integrations
│   │   │   ├── tenants.ts        # Tenant CRUD
│   │   │   ├── subscriptions.ts  # Plans, requests, admin approval
│   │   │   ├── landingPages.ts   # Landing page CRUD + publish + public slug
│   │   │   ├── sellers.ts        # Sales-team members & permissions
│   │   │   ├── team.ts           # Team members
│   │   │   ├── roles.ts          # Roles & RBAC resources
│   │   │   ├── invitations.ts    # Team invites (token accept)
│   │   │   ├── notifications.ts  # In-app notifications
│   │   │   ├── upload.ts         # Image upload (multer → server/uploads)
│   │   │   └── seller/           # Store-scoped seller endpoints
│   │   │       ├── dashboard.ts
│   │   │       ├── orders.ts
│   │   │       ├── products.ts
│   │   │       ├── stores.ts
│   │   │       └── storeLinks.ts
│   │   └── utils/
│   │       ├── prisma.ts         # Prisma client singleton
│   │       ├── orderNumber.ts    # Unique order numbers (pg advisory lock)
│   │       ├── parseJson.ts      # parseJsonField helper
│   │       ├── stock.ts          # computeTotalStock
│   │       └── storeHelper.ts    # Tenant-aware store resolution
│   ├── prisma/
│   │   ├── schema.prisma         # PostgreSQL schema (single source of truth)
│   │   └── migrations/           # Committed migrations (0_init, ...)
│   ├── uploads/                  # Product images (local storage)
│   ├── entrypoint.sh             # Container entrypoint: migrate + seed + start
│   ├── init-db.sh                # Local DB bootstrap (migrate + generate + seed)
│   ├── Dockerfile (root)         # Multi-stage build (frontend → server/dist/public)
│   ├── docker-compose.yml        # PostgreSQL + app local stack
│   └── .env.example              # Env template
│
├── docs/                         # Architecture, deployment, API, database docs
├── HANDOFF.md                    # Deployment handoff
├── README.md                     # Overview + quick start
├── package.json                  # Frontend deps/scripts (root)
└── tsconfig.json                 # Root TS config (frontend + references)
```

## Routing map (frontend)

| Path | Page | Access |
| ---- | ---- | ------ |
| `/`, `/home` | `Landing.tsx` | public |
| `/login` | `SellerLogin.tsx` | public |
| `/register` | `Onboarding.tsx` | public (registration) |
| `/store`, `/store/:ref` | `CustomerStore.tsx` | public storefront |
| `/go/:slug` | `StoreLinkRedirect.tsx` | public (marketing link → store w/ attribution) |
| `/p/:slug` | `PublicLanding.tsx` | public landing page |
| `/pricing` | `PublicPricing.tsx` | public |
| `/merchant/*` | merchant dashboard pages | `RequireAuth` |
| `/super-admin/*` | super-admin pages | `RequireSuperAdmin` |
| `/admin/*` | super-admin pages | `RequireAuth` |
| `/admin/settings` | `AdminSettings.tsx` | super admin (stores + admins) |
| `/accept-invitation/:token` | `AcceptInvitation.tsx` | invited user |

Route guards (`src/App.tsx`): `RequireAuth` allows `seller`/`super_admin` roles;
`RequireSuperAdmin` requires `super_admin`.

## API client

`src/services/api.ts` wraps `fetch`, attaches `Authorization: Bearer <token>` and the
`X-Store-Id` header, and normalizes errors. Store switching is handled via
`getCurrentStoreId`/`setCurrentStoreId` (used by `Sidebar.tsx`).

## Server entry flow

1. `config.ts` loads env and validates `JWT_SECRET`.
2. `index.ts` applies Helmet, CORS (allow-list from `FRONTEND_URL`), JSON body limit,
   rate limiters, then mounts `/api/*` routers.
3. If the built frontend exists (`server/dist/public/index.html`), it is served
   statically with an SPA fallback for non-API GET routes.
4. `GET /api/health` returns `{ status: "ok" }`.

## Build & quality commands

```bash
npm run build          # typecheck + Vite build (frontend) → dist/
npm run build:all      # frontend → server/dist/public → server tsc
cd server && npm run build   # server tsc → server/dist
npx tsc --noEmit       # root typecheck
cd server && npx tsc --noEmit  # server typecheck
npm run lint           # oxlint (frontend)
```
