# Execution Plan - M&K Store SaaS

## Overview
Total phases: 6
Estimated duration: ~18 days
Strategy: Start small, ship fast, preserve backward compatibility.

---

## Phase A — Cleanup & Foundation (Day 1-2)

### Goal
Prepare the codebase for SaaS transformation. Remove dead code, extract duplicates, fix bugs.

### Tasks

**A1 — Remove Firebase Functions**
- Delete: `functions/index.js`
- Remove: `.firebase/`, `.firebaserc`, `firebase.json` (if no longer needed)
- Remove: Firebase dependencies from `package.json` if any

**A2 — Extract duplicate helpers**
- Create: `server/src/utils/parseJson.ts`
  - Move `parseJsonField<T>()` here (currently duplicated in 5 files)
- Create: `server/src/utils/stock.ts`
  - Move `computeTotalStock()` here (currently duplicated in 5 files)
- Update: All route files import from these utils instead of redefining

**A3 — Add confirmedOrders to dashboard endpoint**
- File: `server/src/routes/orders.ts` (line 131-148)
- Add: `confirmedOrders` count alongside `confirmedRevenue` in response
- Frontend: `AdminDashboard.tsx` already reads `confirmedOrders` — fix confirmed.

**A4 — Fix useEffect in AdminOrders**
- File: `src/pages/AdminOrders.tsx`
- Wrap `fetchOrders` in `useCallback` or use refs
- Add proper dependency array: `[page, statusFilter, storeFilter, nameFilter, phoneFilter]`

**A5 — Sidebar uses api service**
- File: `src/components/Sidebar.tsx`
- Replace raw `fetch("/api/admin/settings/stores")` with `api.get<Store[]>("settings/stores")`
- Add error handling

**A6 — Fix getStoreBadge hardcoded names**
- File: `src/pages/AdminOrders.tsx`
- Fetch store list from API and map `ref → name`
- Fallback: use ref value if store not found

**A7 — Tenant Isolation Middleware**
- Create: `server/src/middleware/tenant.ts`
  - Reads `tenantId` from `req.admin` (via JWT)
  - Injects `req.tenantId` for all downstream routes
  - Super admin bypass (null = all tenants)
- Update: `server/src/middleware/auth.ts` — add tenantId to JWT payload
- Update: `server/src/routes/admin.ts` — include tenantId in login response

### Files Changed
```
DEL functions/index.js
DEL .firebase/
DEL .firebaserc
MOD server/src/config.ts
ADD server/src/utils/parseJson.ts
ADD server/src/utils/stock.ts
MOD server/src/middleware/auth.ts
ADD server/src/middleware/tenant.ts
MOD server/src/index.ts
MOD server/src/routes/orders.ts
MOD server/src/routes/product.ts
MOD server/src/routes/store.ts
MOD server/src/routes/settings.ts
MOD server/src/routes/subscriptions.ts
MOD server/src/routes/seller/dashboard.ts
MOD server/src/routes/seller/orders.ts
MOD server/src/routes/seller/products.ts
MOD server/src/routes/seller/stores.ts
MOD server/src/routes/seller/storeLinks.ts
MOD server/src/routes/admin.ts
MOD src/pages/AdminOrders.tsx
MOD src/pages/AdminDashboard.tsx
MOD src/components/Sidebar.tsx
MOD src/types/index.ts
```

---

## Phase B — Tenant & Merchant Management (Day 3-5)

### Goal
Super Admin can manage tenants (merchants), approve subscription requests, and view platform analytics.

### Tasks

**B1 — Tenant API (Super Admin)**
- Add to: `server/src/routes/settings.ts` or new `server/src/routes/tenants.ts`
- `GET /api/admin/tenants` — list all tenants with stats (orders, revenue, store count)
- `GET /api/admin/tenants/:id` — single tenant detail
- `PATCH /api/admin/tenants/:id` — update status (ACTIVE/SUSPENDED), change plan
- `DELETE /api/admin/tenants/:id` — soft-delete tenant

**B2 — Subscription Requests UI**
- File: `server/src/routes/subscriptions.ts`
- `GET /api/admin/subscriptions` — list all subscriptions with tenant info
- Update: `AdminSubscriptions.tsx` — fetch from API instead of hardcoded data
- Add: Approve/Decline UI with modal confirmation

**B3 — AdminBilling from API**
- Update: `AdminBilling.tsx` — fetch invoices/subscriptions from API
- Add: Invoice list, payment history, current plan display

**B4 — Super Admin Tenant Management Page**
- New page: `src/pages/SuperAdminTenants.tsx`
- Route: `/super-admin/tenants`
- Features: search, filter by status/plan, activate/suspend, change plan

**B5 — Route Breakout (Part 1)**
- Add new route structure alongside existing:
  - `/super-admin/*` → SuperAdmin pages (RequireSuperAdmin)
  - `/merchant/*` → Merchant pages (RequireAuth)
  - `/store/*` → Customer/public pages (no auth)
- Keep existing `/admin/*` routes as redirects or deprecated

### Files Changed
```
ADD server/src/routes/tenants.ts
MOD server/src/index.ts
MOD src/pages/AdminSubscriptions.tsx
MOD src/pages/AdminBilling.tsx
ADD src/pages/SuperAdminTenants.tsx
MOD src/App.tsx
MOD src/components/Sidebar.tsx
MOD docs/MASTER_ARCHITECTURE.md
```

---

## Phase C — Onboarding & Multi-Product (Day 6-8)

### Goal
New merchants can self-register, create stores, and manage multiple products.

### Tasks

**C1 — Onboarding Flow**
- New page: `src/pages/Onboarding.tsx`
  - Step 1: Choose plan (from API)
  - Step 2: Account details (email, password, company name)
  - Step 3: First store setup (name, subdomain)
  - Step 4: First product (name, price, image)
  - Step 5: Generate first seller link
  - Step 6: Success + copy link
- API: `POST /api/auth/register` — creates admin + tenant + first store
- API: skips payment for MVP (just creates records)

**C2 — Multi-Product**
- New page: `src/pages/MerchantProducts.tsx`
- Route: `/merchant/products`
- Product list table with search + pagination
- Create product modal/form (reuse AdminProduct logic)
- Edit product, delete product, duplicate product
- API additions:
  - `GET /api/merchant/products` — list with pagination
  - `POST /api/merchant/products` — create
  - `DELETE /api/merchant/products/:id` — delete
  - `POST /api/merchant/products/:id/duplicate` — duplicate

**C3 — Product Categories**
- Add `categoryId` to Product schema (optional for backward compat)
- New model: Category (id, name, tenantId)
- API: CRUD for categories
- Frontend: category filter in product list, category selector in product form

### Files Changed
```
MOD server/prisma/schema.prisma
ADD server/src/routes/auth.ts
MOD server/src/index.ts
ADD src/pages/Onboarding.tsx
ADD src/pages/MerchantProducts.tsx
MOD src/App.tsx
MOD src/components/Sidebar.tsx
MOD docs/MASTER_ARCHITECTURE.md
```

---

## Phase D — Seller System & Marketing Links (Day 9-11)

### Goal
Merchant can create sellers, generate marketing links, track sales per seller.

### Tasks

**D1 — New Seller Model**
- Add to schema: `Seller` model
  - id, storeId, name, phone, email, commission (%), active, createdAt
  - Relation: Store → has many Sellers
- Migration: update StoreLink to reference sellerId

**D2 — Seller Management UI**
- New page: `src/pages/MerchantSellers.tsx`
- Route: `/merchant/sellers`
- List sellers with stats (orders, revenue, conversion)
- Create/edit seller with commission percentage
- Toggle active/inactive

**D3 — Marketing Links v2**
- New page: `src/pages/MerchantLinks.tsx`
- Route: `/merchant/links`
- Create link: select product → select seller → generate slug
- Link detail: clicks, orders, revenue, conversion rate
- UTM parameters support (source, medium, campaign)
- Quick copy button with preview

**D4 — Seller Stats API**
- Add to seller dashboard: per-seller stats
- `GET /api/merchant/sellers/:id/stats` — total orders, revenue, commission earned
- Orders count by seller in merchant dashboard

### Files Changed
```
MOD server/prisma/schema.prisma
ADD server/src/routes/sellers.ts
MOD server/src/index.ts
ADD src/pages/MerchantSellers.tsx
ADD src/pages/MerchantLinks.tsx
MOD src/App.tsx
MOD src/components/Sidebar.tsx
MOD docs/MASTER_ARCHITECTURE.md
```

---

## Phase E — Landing Builder & Team (Day 12-15)

### Goal
Merchant can customize landing pages and invite team members with roles.

### Tasks

**E1 — Landing Page Model**
- Add to schema: `LandingPage` model
  - id, storeId, name, slug (unique), sections (JSON), published, createdAt, updatedAt
  - Relation: Store → has many LandingPages

**E2 — Landing Page Builder API**
- CRUD for landing pages
- `GET /api/merchant/landing-pages`
- `POST /api/merchant/landing-pages`
- `PUT /api/merchant/landing-pages/:id`
- `DELETE /api/merchant/landing-pages/:id`
- `POST /api/merchant/landing-pages/:id/publish`

**E3 — Landing Page Builder UI**
- New page: `src/pages/MerchantLandingPages.tsx`
- Route: `/merchant/landing-pages`
- List pages with publish status
- Simple editor with sections: hero, features, products, CTA, footer
- Each section: drag to reorder, toggle visibility, edit content

**E4 — Team & Invitations**
- New page: `src/pages/MerchantTeam.tsx`
- Route: `/merchant/team`
- List team members with roles
- Invite form: email + role select
- Role management: predefined roles (Owner, Manager, Editor, Viewer)
- Accept invitation flow via token link

**E5 — RBAC Middleware**
- Create: `server/src/middleware/rbac.ts`
- Check permission before route execution
- Fallback for existing routes (allow all authenticated users)

### Files Changed
```
MOD server/prisma/schema.prisma
ADD server/src/routes/landingPages.ts
ADD server/src/routes/invitations.ts
ADD server/src/middleware/rbac.ts
MOD server/src/index.ts
ADD src/pages/MerchantLandingPages.tsx
ADD src/pages/MerchantTeam.tsx
MOD src/App.tsx
MOD src/components/Sidebar.tsx
MOD docs/MASTER_ARCHITECTURE.md
```

---

## Phase F — Settings, Analytics & Production (Day 16-18)

### Goal
Complete merchant settings, add charts/analytics, and prepare for production.

### Tasks

**F1 — Merchant Settings Hub**
- New page: `src/pages/MerchantSettings.tsx`
- Route: `/merchant/settings`
- Tabs:
  - Store Info: name, logo, tagline, primary color, subdomain
  - Shipping: shipping methods, rates, delivery areas
  - Payment: payment gateway config (placeholder for now)
  - Integration: WhatsApp, Facebook Pixel, TikTok Pixel, Google Analytics
  - Notifications: email/SMS templates (placeholder)

**F2 — Charts & Analytics**
- New page: `src/pages/MerchantAnalytics.tsx`
- Route: `/merchant/analytics`
- Revenue chart (last 30 days, line chart using canvas/SVG)
- Orders pie chart (by status)
- Top products bar chart
- Seller performance table
- Date range selector

**F3 — CSV Export Complete**
- Connect export buttons to API
- `GET /api/merchant/orders/export?dateFrom=&dateTo=&status=`
- Download as CSV file

**F4 — Pagination on Customers**
- Add `GET /api/merchant/customers` with pagination + search
- Update `AdminCustomers.tsx` to use paginated API

**F5 — Activity Log**
- New page: `src/pages/SuperAdminActivity.tsx`
- Route: `/super-admin/activity`
- Log: user actions, store changes, order status changes
- Filter by user, action type, date range

### Files Changed
```
ADD server/src/routes/analytics.ts
ADD server/src/routes/customers.ts
ADD server/src/routes/activity.ts
MOD server/src/index.ts
ADD src/pages/MerchantSettings.tsx
ADD src/pages/MerchantAnalytics.tsx
ADD src/pages/SuperAdminActivity.tsx
MOD src/pages/AdminCustomers.tsx
MOD src/pages/AdminOrders.tsx
MOD src/pages/AdminReports.tsx
MOD src/App.tsx
MOD src/components/Sidebar.tsx
MOD docs/MASTER_ARCHITECTURE.md
MOD docs/PROJECT_ROADMAP.md
```

---

## Route Map — Final State

### Super Admin (`/super-admin/*`)
| Route | Page | Permission |
|-------|------|------------|
| `/super-admin` | Dashboard (platform stats) | super_admin |
| `/super-admin/tenants` | Tenant Management | super_admin |
| `/super-admin/merchants` | Merchant Management | super_admin |
| `/super-admin/subscriptions` | Subscription Plans | super_admin |
| `/super-admin/billing` | Invoices & Revenue | super_admin |
| `/super-admin/settings` | Platform Settings | super_admin |
| `/super-admin/activity` | Activity Log | super_admin |

### Merchant (`/merchant/*`)
| Route | Page | Permission |
|-------|------|------------|
| `/merchant` | Dashboard | merchant |
| `/merchant/products` | Product List | merchant |
| `/merchant/products/new` | Create Product | merchant |
| `/merchant/products/:id` | Edit Product | merchant |
| `/merchant/orders` | Order Management | merchant |
| `/merchant/customers` | Customers | merchant |
| `/merchant/sellers` | Sellers | merchant |
| `/merchant/links` | Marketing Links | merchant |
| `/merchant/landing-pages` | Landing Page Builder | merchant |
| `/merchant/team` | Team & Roles | merchant |
| `/merchant/analytics` | Reports & Analytics | merchant |
| `/merchant/settings` | Settings | merchant |

### Customer / Public
| Route | Page |
|-------|------|
| `/` | Landing / Home |
| `/store` | Customer Store (product view) |
| `/pricing` | Public Pricing |
| `/login` | Login |
| `/register` | Merchant Onboarding |

### Legacy (Deprecated — redirect to new routes)
| Route | Redirects To |
|-------|-------------|
| `/admin` | `/merchant` |
| `/admin/orders` | `/merchant/orders` |
| `/admin/product` | `/merchant/products` |
| `/admin/customers` | `/merchant/customers` |
| `/admin/reports` | `/merchant/analytics` |
| `/admin/stores` | `/merchant/links` |
| `/admin/subscriptions` | `/super-admin/subscriptions` |
| `/admin/settings` | `/super-admin/settings` |
| `/admin/billing` | `/super-admin/billing` |
| `/admin/store-links` | `/merchant/links` |
| `/admin/super-admin` | `/super-admin` |
| `/seller/dashboard` | `/merchant` |

---

## Stitch Prompts to Create

| # | File | For Phase |
|---|------|-----------|
| 11 | `11-super-admin-tenants.md` | B |
| 12 | `12-merchant-onboarding.md` | C |
| 13 | `13-seller-management.md` | D |
| 14 | `14-marketing-links.md` | D |
| 15 | `15-landing-builder.md` | E |
| 16 | `16-team-invitations.md` | E |
| 17 | `17-merchant-analytics.md` | F |

---

## Stitch Prompts to Update

| # | File | What to Add |
|---|------|-------------|
| 01 | `01-landing-page.md` | Already done ✅ |
| 02 | `02-super-admin.md` | Add tenant management section, activity log |
| 04 | `04-products.md` | Add multi-product, categories, bulk operations |
| 08 | `08-settings.md` | Add shipping, payment, integrations tabs |

---

## Verification Steps

After each phase:

```bash
npm run lint        # No errors
npm run typecheck   # No TypeScript errors  
npm run build       # Builds successfully
```

Start server and verify:
- Login works (admin/admin123)
- Dashboard loads with correct stats
- Orders page loads with pagination
- Product page loads and saves
- Customer store page loads and submits orders

---

## Document Updates

After each phase, update:
1. `docs/MASTER_ARCHITECTURE.md` — add new routes, models, architecture decisions
2. `docs/PROJECT_ROADMAP.md` — mark completed phases, update remaining work
3. `docs/STITCH_INDEX.md` — add new stitch prompts, update status
4. This file: `.opencode/plans/EXECUTION_PLAN.md` — mark completed tasks
