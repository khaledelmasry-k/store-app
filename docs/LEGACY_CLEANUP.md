# LEGACY CLEANUP

> Created during P0/P1. This inventory documents the current working-tree state and the
> legacy areas. **Nothing in this list has been permanently deleted in this phase.**
> The entries below marked "Deleted in working tree, uncommitted" are already removed from
> disk but their removal is **not yet committed**; they are pending a dedicated commit (P1/before P8).
>
> Status legend:
> - `WORKING_TREE_DEL` — deleted on disk, deletion NOT committed.
> - `ACTIVE` — present and used; keep.
> - `PLANNED` — scheduled for removal in a later phase after reference confirmation.

## A. Legacy backend — `server/**` (Express + Prisma + PostgreSQL)

| PATH | WHY IT IS LEGACY | CURRENT REPLACEMENT | USED BY | SAFE TO DELETE? | CONFIDENCE |
|---|---|---|---|---|---|
| `server/api/` `server/check-db.ts` `server/entrypoint.sh` `server/init-db.sh` `server/use-db.sh` | Old Express API server | Firebase Cloud Functions (`functions/src/index.ts`) | none | YES (commit deletion) | HIGH |
| `server/src/**` (routes/middleware/models) | REST endpoints superseded by Firestore rules + onCall functions | `functions/` + `firestore.rules` | none | YES (commit deletion) | HIGH |
| `server/prisma/**` | PostgreSQL ORM/schema; stack is now Firestore | `firestore.rules` + Firestore collections | none | YES (commit deletion) | HIGH |
| `server/package*.json`, `server/tsconfig.json` | Old node deps | `functions/package.json` | none | YES (commit deletion) | HIGH |
| `server/seed.ts` | Old DB seeding | emulator `seed.mjs` (test harness) | none | YES (commit deletion) | HIGH |

## B / Legacy docs

| PATH | WHY IT IS LEGACY | CURRENT REPLACEMENT | USED BY | SAFE TO DELETE? | CONFIDENCE |
|---|---|---|---|---|---|
| `docs/stitch-prompts/**`, `docs/*stitch*.md`, `docs/phases/**`, `docs/phase-1-analysis.md` | One-shot generative prompts from the previous architecture | `docs/ARCHITECTURE_AUDIT.md`, `docs/MK_FINAL_ARCHITECTURE.md` | none | YES (commit deletion) | HIGH |
| `docs/FINAL_GAP_ANALYSIS.md`, `docs/FINAL_REPORT.md`, `docs/MASTER_ARCHITECTURE.md`, `docs/NEXT_PHASE_STATUS.md`, `docs/PRODUCTION_READINESS_REPORT.md`, `docs/PROJECT_ROADMAP.md` | Manuals flags from superseded stack | audit docs (see above) | none | YES (commit deletion) | HIGH |
| `docs/API.md` | Documented a deleted REST API | Firestore + functions doc | none | YES (commit deletion) | HIGH |
| `docs/landing-page-stitch.md`, `docs/billing-stitch.md`, `docs/subscription-stitch.md`, `docs/super-admin-stitch.md`, `docs/merchant-dashboard-stitch.md` | Old implementation prompts | present pages | none | YES (commit deletion) | HIGH |
| `docs/DATABASE.md`, `docs/DEPLOYMENT.md`, `docs/PROJECT_STRUCTURE.md` | Modified/rewritten → superseded or stale | consolidate into `docs/MK_FINAL_ARCHITECTURE.md` | docs consumers | REVIEW (P8) | MEDIUM |
| `docs/ANTIGRAVITY_*.md`, `ARCHITECTURE_AUDIT.md`, `ROUTE_MAP.md`, `ROLE_MATRIX.md`, `PERMISSION_MATRIX.md`, `SECURITY.md`, `ROUTING.md`, `MIGRATION_REPORT.md`, `CHANGELOG.md`, `PRODUCT_SPEC.md`, `PROJECT_CLEANUP_REPORT.md`, `LANDING_PAGE_FIX_REPORT.md`, `FIREBASE_SETUP.md`, `OPENCODE_AUDIT.md` (untracked) | Redundant overlapping audit docs | single canonical `docs/MK_FINAL_ARCHITECTURE.md` | documentation | CONSOLIDATE (P8) | MEDIUM |

## 3. Legacy frontend — old flat pages under `src/pages/` and `src/components/`

| PATH | WHY IT IS LEGACY | CURRENT REPLACEMENT | USED BY | SAFE TO DELETE? | CONFIDENCE |
|---|---|---|---|---|---|
| `src/pages/Landing.tsx`, `src/pages/PublicLanding.tsx`, `src/pages/PublicPricing.tsx` | Old landing/pricing | `src/platform/pages/LandingPage.tsx` | none | YES (commit deletion) | HIGH |
| `src/pages/Admin*.tsx` (Dashboard, Orders, Products, Customers, Subscriptions, Settings, StoreLinks, Reports, SuperAdmin, Billing, Product) | old flat admin pages | `src/platform/pages/*` | none | YES (commit deletion) | HIGH |
| `src/pages/Merchant*.tsx`, `src/pages/Seller*.tsx`, `src/pages/Onboarding.tsx`, `src/pages/AcceptInvitation.tsx`, `src/pages/CustomerStore.tsx`, `src/pages/StoreLinkRedirect.tsx` | old flat merchant/seller/customer pages | `src/merchant/pages/*`, `src/store/pages/*` | none | YES (commit deletion) | HIGH |
| `src/components/Sidebar.tsx`, `src/components/NotificationBell.tsx` | old layout components | `src/shared/components/layout/AppShell.tsx` | none | YES (commit deletion) | HIGH |
| `src/services/api.ts`, `src/types/index.ts` | old REST API client + old types | `src/shared/services/*`, `src/shared/types/index.ts` | none | YES (commit deletion) | HIGH |
| `src/preact-shims.d.ts` | type shim no longer required | TS config | none | REVIEW | MEDIUM |

## 4. Old project/deploy tooling at root

| PATH | WHY IT IS LEGACY | CURRENT REPLACEMENT | USED BY | SAFE TO DELETE? | CONFIDENCE |
|---|---|---|---|---|---|
| `Dockerfile`, `docker-compose.yml`, `.dockerignore` | Containerised old server | Firebase Hosting + Functions | none | YES (commit deletion) | HIGH |
| `run-tunnel.sh`, `start-tunnel.sh`, `ensure-tunnel-url.sh` | Old ngrok/tunnel scripts | emulators + firebase dev | none | REVIEW (P8) | MEDIUM |
| `HANDOFF.md`, `opencode-prompt-arabic.md`, `stitch-prompt-{arabic,final,v2-fullstack,upgrade}.md` | Old handoff prompts | consolidated to `docs/` | none | YES (commit deletion) | HIGH |

## 5. Current working tree — modified/new files (kept)

- Modified: `.env.example`, `.gitignore`, `README.md`, `package.json`, `package-lock.json`, `vite.config.ts`,
  `docs/DATABASE.md`, `docs/DEPLOYMENT.md`, `docs/PROJECT_STRUCTURE.md`, `src/App.tsx`, `src/main.tsx`, `src/vite-env.d.ts`.
- New (untracked, part of the current implementation): `.firebaserc`, `firebase.json`, `firestore.rules`, `storage.rules`,
  `firestore.indexes.json`, `vercel.json`, `.env.production`, `functions/**`, `src/shared/**`, `src/lib/**`, `scripts/**`,
  `src/platform/pages/*`, `src/merchant/pages/*`, `src/store/pages/*`, and new `docs/*` audit files.
- `.env.production` is **untracked** — confirm it contains no secrets before any deploy.

## 6. Known documented limitation (multi-store) — verified, NOT to be fixed in P0/P1

`src/shared/components/layout/MerchantLayout.tsx:14-15` currently sets the active store to
`user.storeIds[0]`. There is **no** multi-store selector / `/dashboard/stores`. This is a known gap
tracked for **P4** (multi-store management). Do not implement it during P0/P1.