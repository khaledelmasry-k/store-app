# Project Roadmap - M&K Store SaaS Transformation

## Current Phase
**Phase E Complete — Merchant Experience**

## Project Overview
Transforming the existing single-merchant e-commerce application into a production-ready Multi-Tenant SaaS platform while preserving all Version 1 functionality. The existing project remains Version 1; everything new prepares Version 2.

---

## Completed Work

### Foundational Phases (A-D)
- [x] Phase A — Cleanup & Foundation (Firebase removed, helpers extracted, tenant isolation)
- [x] Phase B — Tenant & Merchant Management (tenant CRUD, subscriptions, billing)
- [x] Phase C — Onboarding & Multi-Product (registration wizard, multi-product, categories)
- [x] Phase D — Seller System & Marketing Links (seller model, CRUD, UTM tracking, click tracking)

### Phase E — Merchant Experience

#### E1 — Dashboard Completion
- [x] Removed hardcoded `khaledStats`/`mahmoudStats` from server
- [x] Added dynamic per-store stats for super admin dashboard
- [x] Added Recent Orders table (last 10) to dashboard
- [x] Wired up "إضافة منتج جديد" button
- [x] Refactored AdminReports to use dynamic storesStats
- [x] Updated TypeScript types (StoreStat, RecentOrder)
- [x] Stitch prompt: `11-merchant-dashboard-complete.md`

#### E2 — Merchant Settings (Completed)
- [x] Created `/api/merchant/settings` route (GET store+tenant, PUT store info)
- [x] Created `MerchantSettings.tsx` with Store Info / Shipping / Integrations tabs
- [x] Logo upload via raw fetch to `/admin/upload`
- [x] Exposed DB-only fields (tagLine, primaryColor, logo) through API + UI
- [x] Stitch prompt: `12-merchant-settings.md`

#### E3 — Landing Page Builder (Completed)
- [x] Added `LandingPage` model to schema
- [x] Created `/api/merchant/landing-pages` CRUD + publish API
- [x] Created `MerchantLandingPages.tsx` (list + create + publish toggle)
- [x] Created `MerchantLandingEditor.tsx` (section builder: hero, features, products, CTA, footer)
- [x] Sections are reorderable, editable, deletable

#### E4 — Customer-Facing Landing Pages (Completed)
- [x] Created `PublicLanding.tsx` at `/p/:slug`
- [x] Public endpoint `GET /api/merchant/landing-pages/public/:slug`
- [x] Renders sections with store branding (logo, name, tagLine, primaryColor)

#### E5 — Store Theme Customization (Completed)
- [x] Store branding (logo, primaryColor, tagLine, name) returned in `/api/orders/product` response
- [x] CustomerOrder page header uses store's brand instead of hardcoded "M&K Store"
- [x] Store settings (E2) allow merchants to set all theme fields

#### E6 — Products Improvements (Completed)
- [x] Enhanced MerchantProducts form with colors, sizes, variantStock matrix, pricingTiers, image upload per color, active toggle
- [x] Wired up delete button in AdminProduct (DELETE /admin/product)
- [x] Duplicate product functionality
- [x] Server-side pagination + search for merchant products
- [x] Stitch prompt: `16-products-improvements.md`

#### E7 — Customers Management (Completed)
- [x] Created `/api/merchant/customers` route with server-side grouping by phone
- [x] Pagination, search (name/phone), sort (name, phone, orders, total, lastOrder)
- [x] Created `MerchantCustomers.tsx` with summary cards, sortable table, pagination
- [x] Replaced client-side aggregation with server-side API
- [x] Stitch prompt: `17-customers-api.md`

#### E8 — Reports & Analytics (Completed)
- [x] Created `/api/merchant/analytics/overview` (summary stats + top products)
- [x] Created `/api/merchant/analytics/daily` (daily order/revenue trends)
- [x] Created `MerchantAnalytics.tsx` with SVG bar charts, line charts, KPIs
- [x] Added analytics nav item to sidebar
- [x] Stitch prompt: `18-analytics.md`

---

## Remaining Work

### Phase E — Merchant Experience (Complete)
1. ✅ E1 — Dashboard Completion
2. ✅ E2 — Merchant Settings
3. ✅ E3 — Landing Page Builder
4. ✅ E4 — Customer-Facing Landing Pages
5. ✅ E5 — Store Theme Customization
6. ✅ E6 — Products Improvements
7. ✅ E7 — Customers Management
8. ✅ E8 — Reports & Analytics

### Phase F — Team & Access
9. ⬜ F1 — Team Members
10. ⬜ F2 — Roles & Permissions
11. ⬜ F3 — Seller Permissions
12. ⬜ F4 — Invitation System
13. ⬜ F5 — Merchant Notifications

### Phase G — Monetization
14. ⬜ G1 — Subscription Management
15. ⬜ G2 — Billing
16. ⬜ G3 — Plans
17. ⬜ G4 — Coupons

### Phase H — Super Admin
18. ⬜ H1 — Super Admin Analytics
19. ⬜ H2 — Platform Monitoring
20. ⬜ H3 — Merchant Management Improvements

### Phase I — Production
21. ⬜ I1 — CSV Export
22. ⬜ I2 — Activity Logs
23. ⬜ I3 — Audit Logs
24. ⬜ I4 — Production Optimizations

---

## Milestones

| Milestone | Target | Status |
|-----------|--------|--------|
| Phases A-D Complete | Done | ✅ |
| Phase E — Merchant Experience | Complete | ✅ |
| Phase F — Team & Access | Next | ⬜ |
| Phase G — Monetization | Next | ⬜ |
| Phase H — Super Admin | Next | ⬜ |
| Phase I — Production Readiness | Final | ⬜ |
| V2 Launch Ready | Pending | ⬜ |

---

## Priorities

### Current Priority
1. ✅ Phase E — Merchant Experience
2. Next: Phase F — Team & Access (F1-F5)
3. Then Phase G — Monetization (G1-G4)
4. Then Phase H — Super Admin (H1-H3)
5. Then Phase I — Production (I1-I4)

---

*Document created: PROJECT_ROADMAP.md*
*Version: 2.1*
*Last Updated: 2025-07-29*
*Status: Phase E Complete — Phase F Next*
