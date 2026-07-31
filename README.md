# M&K Store

Multi-tenant e-commerce SaaS platform (storefront + merchant dashboard + super-admin panel).
Built with **Preact + Vite** (frontend) and **Express + Prisma** (backend) on **PostgreSQL**.

| Area | Stack |
| ---- | ----- |
| Frontend | Preact, TypeScript, Vite, wouter (RTL Arabic) |
| Backend | Express 5, TypeScript, Prisma ORM |
| Database | PostgreSQL |
| Auth | JWT (bcrypt password hashing), role + tenant isolation |
| Security | Helmet, CORS allow-list, rate limiting, RBAC middleware, CSV-injection guard |

---

## Quick start

Requirements: Node 20+, PostgreSQL.

```bash
# 1. Configure environment
cp .env.example .env
#    set DATABASE_URL, JWT_SECRET (and FRONTEND_URL for cross-origin dev)

# 2. Install + build + verify
npm ci && cd server && npm ci && cd ..
npm run build:all
npx tsc --noEmit            # root typecheck
cd server && npx tsc --noEmit

# 3. Migrate + seed default admin
cd server
npx prisma migrate deploy
npx tsx src/seed.ts         # creates super admin admin / admin123 (only if missing)

# 4. Run
npm start                   # http://localhost:3001 (serves API + built frontend)
```

Development mode (hot reload):

```bash
cd server && npx tsx src/index.ts   # API on :3001
npm run dev                          # Vite dev server (proxies /api → :3001)
```

---

## Default credentials

| Role        | Username | Password  | Login route        |
| ----------- | -------- | --------- | ------------------ |
| Super Admin | `admin`  | `admin123`| `/api/admin/login` |

> ⚠️ Change the password and `JWT_SECRET` before going live. Merchants register via
> the public registration flow (`/api/auth/register`).

---

## Environment variables

| Variable        | Required | Description |
| --------------- | -------- | ----------- |
| `DATABASE_URL`  | yes      | PostgreSQL connection string. |
| `JWT_SECRET`    | yes      | Long random string; server **fails to boot** in production without a strong value. |
| `PORT`          | no       | Server port (default `3001`). |
| `NODE_ENV`      | no       | `production` in containers. |
| `FRONTEND_URL`  | no       | Comma-separated CORS allow-list. Defaults to `http://localhost:5173,http://localhost:3000,https://mk-store-app.web.app`. |
| `VITE_API_URL`  | no       | Frontend build-time API base path (default `/api`). |
| `VITE_IMG_URL`  | no       | Frontend build-time image base path (default `/uploads`). |

See `.env.example` and `docs/DEPLOYMENT.md`.

---

## Project layout

```
├── src/                # Frontend (Preact + Vite)
│   ├── pages/          # Storefront, merchant dashboard, super-admin panel
│   ├── components/     # Shared UI components
│   ├── services/       # API client
│   └── ...
├── server/             # Backend (Express + Prisma)
│   ├── src/routes/     # API routes (admin, seller, merchant, public)
│   ├── src/middleware/ # auth, RBAC, error handler
│   ├── src/utils/      # order numbers, store helper, CSV safety
│   ├── prisma/         # schema.prisma + migrations
│   └── uploads/        # product images (local)
├── Dockerfile          # multi-stage production build
├── docker-compose.yml  # local PostgreSQL + app
└── docs/               # architecture, deployment, API, database docs
```

See `docs/PROJECT_STRUCTURE.md`.

---

## Documentation

- `docs/DEPLOYMENT.md` — Northflank + Docker deployment guide
- `docs/API.md` — REST API reference
- `docs/DATABASE.md` — database schema and migrations
- `docs/PROJECT_STRUCTURE.md` — codebase walkthrough
- `docs/MASTER_ARCHITECTURE.md` — architecture overview
- `HANDOFF.md` — deployment handoff notes

---

## Known limitations

- Uploads are stored on the local filesystem (`server/uploads/`); use a volume or
  S3-compatible bucket for horizontal scaling.
- `Role`/`Permission` tables exist but RBAC is enforced via `tenant_users.role`
  (OWNER / ADMIN / EDITOR) at the middleware layer.
- Analytics are simple counters; attribution is captured via UTM query params.
