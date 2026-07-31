# Deployment Guide — M&K Store

Targets: **Northflank** (API + PostgreSQL) and any Docker-capable host.

---

## 1. Prerequisites

- Source repository hosted on GitHub/GitLab.
- A Northflank account (or any container platform).
- For local testing: Docker + Docker Compose.

---

## 2. Environment variables

All variables are runtime (container) environment, except `VITE_*` which are
**build-time** (must be set in the Docker build environment).

| Variable         | Required | Description |
| ---------------- | -------- | ----------- |
| `DATABASE_URL`   | yes      | PostgreSQL connection string. |
| `JWT_SECRET`     | yes      | Long random string (generate with `openssl rand -base64 48`). |
| `NODE_ENV`       | yes      | `production`. |
| `PORT`           | no       | Default `3001`; Northflank injects its own `PORT`. |
| `FRONTEND_URL`   | no       | Comma-separated CORS origins. Leave unset for same-origin. |
| `VITE_API_URL`   | no       | API base path for the frontend bundle (default `/api`). |
| `VITE_IMG_URL`   | no       | Upload base path for the frontend bundle (default `/uploads`). |

> **Security**: the server refuses to start in `NODE_ENV=production` without a strong
> `JWT_SECRET` (`server/src/config.ts`).

---

## 3. Northflank deployment

1. **Add the repo** to Northflank as a *Build Service* (uses `Dockerfile`).
2. **Add a PostgreSQL addon** and link it to the service.
3. **Set environment variables** (see table above). `DATABASE_URL` points at the
   linked PostgreSQL addon.
4. **Ports & domains**: publish port `3001` and attach a domain with TLS.
5. **Deploy.** On first start the container runs `server/entrypoint.sh`:
   1. `prisma migrate deploy` (applies `server/prisma/migrations/*`),
   2. `node dist/seed.js` (creates super admin only if missing),
   3. `exec node dist/index.js`.

Health check: `GET /` returns the SPA; `GET /api/health` returns status (see below).

### Scaling & storage

- The API is stateless — safe to scale horizontally.
- `server/uploads/` is **not** persistent across replicas/restarts. Mount a
  Northflank Volume at `/app/server/uploads` or move uploads to an S3-compatible
  bucket before scaling beyond one replica.

---

## 4. Docker / Docker Compose (local)

```bash
# Option A — docker compose (PostgreSQL + app together)
cp .env.example .env
export JWT_SECRET="$(openssl rand -base64 48)"
docker compose up --build

# Option B — single container against an existing database
docker build -t mk-store .
docker run -p 3001:3001 \
  -e DATABASE_URL="postgresql://user:pass@host:5432/db" \
  -e JWT_SECRET="$(openssl rand -base64 48)" \
  -e NODE_ENV=production \
  mk-store
```

`docker-compose.yml` includes a `db` (PostgreSQL 16) with a health check and an
`app` service with `wget`-based health check. The app waits for the database via
`depends_on.condition: service_healthy`.

---

## 5. Container health check

- Northflank / compose health check command: `wget -qO- http://localhost:3001/ || exit 1`
- Dedicated endpoint: `GET /api/health` → `{"status":"ok"}` when the server is up.

---

## 6. First-run credentials

The seed script creates the super admin **only if it does not exist** (idempotent):

| Role        | Username | Password  |
| ----------- | -------- | --------- |
| Super Admin | `admin`  | `admin123`|

Change this password immediately after first login.

---

## 7. Frontend-only deployment (Firebase Hosting)

If the frontend is served separately (not from the same container):

1. Build with the API URL baked in:
   ```bash
   VITE_API_URL=https://api.example.com/api npm run build
   ```
2. Deploy `dist/` to Firebase Hosting (or any static host).
3. Ensure the API server's `FRONTEND_URL` includes the static host origin
   (e.g. `https://mk-store-app.web.app`), since the browser calls the API cross-origin.
