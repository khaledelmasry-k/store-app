# M&K Store — Deployment Handoff

Multi-tenant e-commerce SaaS (storefront + merchant dashboard + super-admin).
Built with **Preact + Vite** (frontend), **Express + Prisma** (backend), **PostgreSQL**.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Browser (SPA)  ── /store/:ref (customer storefront)    │
│                 ── /admin (super admin)                  │
│                 ── /merchant (merchant dashboard)        │
└──────────────────────┬──────────────────────────────────┘
                       │  same-origin, single container
┌──────────────────────▼──────────────────────────────────┐
│  Express server (PORT, default 3001)                    │
│  - serves built SPA from server/dist/public             │
│  - API under /api/*                                     │
│  - JWT auth (admin/seller), RBAC middleware             │
│  - tenant isolation via X-Store-Id + requireStore       │
└───────┬──────────────────────────────┬──────────────────┘
        │                              │
┌───────▼──────────┐        ┌──────────▼──────────────┐
│  PostgreSQL      │        │  server/uploads/        │
│  (Northflank DB) │        │  product images         │
└──────────────────┘        └─────────────────────────┘
```

- **Frontend** (repo root): `src/`, Vite + Preact + wouter (browser router).
- **Backend**: `server/src/`, Express + Prisma.
- **Auth**: two roles both stored in `admins` table — `super_admin` and `seller`.
  - Super admin logs in at `/api/admin/login` (username + password).
  - Merchants self-register at `/api/auth/register` (email → username), seeded as `seller`.
- **RBAC**: `server/src/middleware/permission.ts` — `requireStore` resolves the store
  from `X-Store-Id` header (or first accessible store); `requirePermission` enforces
  OWNER/ADMIN full access, EDITOR read-only; `enforcePlanLimit` caps FREE/STARTER usage.
- **Plans**: FREE (1 product, 1 store, 1 link), STARTER (1 store), PRO (unlimited).
  Suspended stores get 403.

### Key files
- `server/src/middleware/permission.ts` — tenant isolation + RBAC + plan limits.
- `server/src/utils/storeHelper.ts` — tenant-aware store resolution.
- `server/src/routes/*` — per-domain routes (orders, products, stores, subscriptions…).
- `src/services/api.ts` — attaches `X-Store-Id`; `getCurrentStoreId/setCurrentStoreId`.
- `src/components/Sidebar.tsx` — multi-store switcher.
- `server/prisma/schema.prisma` — PostgreSQL schema (single source of truth).

---

## Environment variables

| Variable      | Required | Description                                             |
| ------------- | -------- | ------------------------------------------------------- |
| `DATABASE_URL`| yes      | PostgreSQL connection string, e.g. `postgresql://user:pass@host:5432/db` |
| `JWT_SECRET`  | yes      | Long random string. Server **fails to boot** in `NODE_ENV=production` without it. |
| `PORT`        | no       | Server port. Default `3001`. Northflank injects this automatically. |
| `NODE_ENV`    | no       | Set `production` in the container. |
| `FRONTEND_URL`| no       | CORS origin. Leave empty for same-origin (default `*`). |

See `.env.example` for a template.

---

## Default credentials

| Role         | Username | Password  | Login route               |
| ------------ | -------- | --------- | ------------------------- |
| Super Admin  | `admin`  | `admin123`| `/api/admin/login`        |

The seed creates this account **only if it does not already exist** (it never resets
an existing password). Merchants sign up through the public registration flow.

> ⚠️ Change `admin123` before going live, and set a strong `JWT_SECRET`.

---

## Database setup (Northflank)

1. Create a **PostgreSQL** addon in Northflank.
2. Copy its connection string into the service's `DATABASE_URL` variable.
3. On first start, `server/entrypoint.sh` runs `prisma migrate deploy` (applies
   `prisma/migrations/0_init`), then seeds the default admin.

The baseline migration was generated from the current schema
(`prisma/migrations/0_init/migration.sql`). For future schema changes:
`cd server && npx prisma migrate dev --name <change>` and commit the new migration.

Local dev against Postgres (port 5433):
```bash
cd server && npx prisma migrate deploy && npx tsx src/seed.ts
```

---

## Deployment steps (Northflank)

1. Push this repo to GitHub and add it to Northflank as a **Build Service**.
   - The multi-stage `Dockerfile` builds frontend → bundles into `server/dist/public`
     → builds & runs the server.
2. Add a **PostgreSQL** addon and link it to the service.
3. Set environment variables (`DATABASE_URL`, `JWT_SECRET`, `NODE_ENV=production`).
4. Set **PORT** to `3001` (or let Northflank inject it; config default is 3001).
5. Add a public port and domain; attach TLS.
6. Deploy. The container runs `server/entrypoint.sh`:
   - `prisma migrate deploy` (or `db push` if no migrations),
   - seed default admin,
   - `exec node dist/index.js`.

Container health check: `GET /api/health`.

Build locally to verify:
```bash
docker build -t mk-store .
docker run -p 3001:3001 -e DATABASE_URL=... -e JWT_SECRET=... -e NODE_ENV=production mk-store
```

---

## Local development

```bash
# server on :3001
cd server && npx tsx src/index.ts
# frontend dev server (proxy → :3001)
npm run dev
```

- Frontend build: `npm run build` → `dist/`
- Full build: `npm run build:all` (builds frontend, copies into `server/dist/public`, builds server)
- Lint: `npm run lint`
- Typecheck: `npx tsc --noEmit` (repo root) and `cd server && npx tsc --noEmit`

> Note: the dev server (`tsx`) does not serve the frontend; use `npm run dev` (Vite)
> for the UI during development. Production (`node dist/index.js`) serves both.

---

## Documentation

- `README.md` — overview + quick start
- `docs/DEPLOYMENT.md` — Northflank + Docker deployment
- `docs/API.md` — REST API reference
- `docs/DATABASE.md` — database schema, migrations, RBAC
- `docs/PROJECT_STRUCTURE.md` — codebase walkthrough
- `docs/FINAL_REPORT.md` — delivery summary for this release

---

## Known limitations

- **Uploads are local-only** (`server/uploads/`). Not persisted across container
  restarts/scale-out on Northflank — consider an object store (e.g. Northflank
  Volume or S3-compatible bucket) for production.
- **Editor invitations / team management** are MVP: `Role`/`Permission` tables exist
  but are not wired to users; RBAC is enforced via `tenant_users.role`
  (OWNER/ADMIN/EDITOR) at the middleware layer.
- **Analytics/visitor counters** are simple counters; no attribution beyond UTM
  query params captured on orders.
- No rate limiting on public storefront endpoints (auth endpoints are limited via
  `authLimiter`).
- Frontend `useEffect` lint warnings (`exhaustive-deps`) are pre-existing and
  harmless; `npm run lint` reports no errors.
- Multi-store creation for merchants is restricted by plan limits
  (FREE=1 store, STARTER=1 store, PRO unlimited); merchant registration creates a
  single store automatically.
