# Stitch Index - Google Stitch Prompts

## Overview
This document indexes all Google Stitch prompts for the M&K Store SaaS platform transformation. Each prompt is designed to extend the existing project without redesigning, rebuilding, or replacing any existing pages, components, routes, or business logic.

## Execution Order

| Order | Prompt File | Title | Dependencies | Status |
|-------|-------------|-------|--------------|--------|
| 1 | `01-landing-page.md` | Landing Page | None | ✅ Created |
| 2 | `02-super-admin.md` | Super Admin Dashboard | 01-landing-page.md | ✅ Created |
| 3 | `03-merchant-dashboard.md` | Merchant Dashboard | 01-landing-page.md | ✅ Created |
| 4 | `04-products.md` | Products Management | 03-merchant-dashboard.md | ✅ Created |
| 5 | `05-orders.md` | Orders Management | 03-merchant-dashboard.md | ✅ Created |
| 6 | `06-customers.md` | Customers Management | 03-merchant-dashboard.md | ✅ Created |
| 7 | `07-reports.md` | Reports & Analytics | 03-merchant-dashboard.md | ✅ Created |
| 8 | `08-settings.md` | Advanced Settings | 03-merchant-dashboard.md | ✅ Created |
| 9 | `09-billing.md` | Billing & Finance | 02-super-admin.md | ✅ Created |
| 10 | `10-subscriptions.md` | Subscriptions Management | 02-super-admin.md | ✅ Created |
| 11 | `11-merchant-dashboard-complete.md` | Dashboard Completion | 03-merchant-dashboard.md | ✅ Created |
| 12 | `12-merchant-settings.md` | Merchant Settings | 03-merchant-dashboard.md | ✅ Created |
| 13 | `13-landing-page-builder.md` | Landing Page Builder | 03-merchant-dashboard.md | ✅ Created |
| 14 | `14-public-landing-pages.md` | Customer-Facing Landing Pages | 13-landing-page-builder.md | ✅ Created |
| 15 | `15-store-theme-customization.md` | Store Theme Customization | 12-merchant-settings.md | ✅ Created |
| 16 | `16-products-improvements.md` | Products Improvements | 04-products.md | ✅ Created |
| 17 | `17-customers-api.md` | Customers Management (V2) | 03-merchant-dashboard.md | ✅ Created |
| 18 | `18-analytics.md` | Analytics & Reports | 03-merchant-dashboard.md | ✅ Created |

---

## Prompt Details

### 01-landing-page.md
**Title**: Landing Page - Google Stitch Prompt
**Status**: ✅ Created
**Source**: `docs/landing-page-stitch.md`
**Description**: Premium SaaS landing page for customer acquisition, showcasing platform capabilities with hero section, features, pricing, testimonials, FAQ, and call-to-action.
**Sections**:
- Header & Navigation
- Hero Section
- Features Section
- Screenshots/Demo Section
- Benefits Section
- Pricing Section
- Testimonials Section
- FAQ Section
- Call to Action Section
- Footer
**Dependencies**: None
**Future-Ready Considerations**: Scalability, extensibility, technology stack readiness
**Design Notes**: Primary colors #FF9900, #131921, #007185, #067D62; Typography: Inter/Plus Jakarta Sans, Noto Sans Arabic; Material Symbols iconography

### 02-super-admin.md
**Title**: Super Admin Dashboard - Google Stitch Prompt
**Status**: ✅ Created
**Source**: `docs/super-admin-stitch.md`
**Description**: Super Admin dashboard interface for managing the entire multi-tenant platform with tenant management, subscriptions, users, analytics, and platform-wide settings.
**Sections**:
- Header & Navigation
- Left Navigation Menu
- Dashboard Overview
- Tenants Management
- Subscription Management
- User & Permission Management
- System Administration
- Right Sidebar (Activity Feed, Quick Actions, System Health)
- Footer
**Dependencies**: 01-landing-page.md
**Future-Ready Considerations**: Scalability, extensibility, container-ready architecture
**Design Notes**: Platform brand colors, Material Design typography, Material Symbols iconography

### 03-merchant-dashboard.md
**Title**: Merchant Dashboard - Google Stitch Prompt
**Status**: ✅ Created
**Source**: `docs/merchant-dashboard-stitch.md`
**Description**: Merchant dashboard interface for individual tenant users with business operations, products, orders, customers, analytics, and marketing link management.
**Sections**:
- Header & Tenant Context
- Left Navigation Menu
- Dashboard Overview (KPIs, Analytics Widgets)
- Quick Access Actions
- Product Management
- Recent Orders
- Right Sidebar (Business Alerts, Quick Reports, System Status)
- Footer
**Dependencies**: 01-landing-page.md
**Future-Ready Considerations**: Scalability, plugin system, ERP/POS integration
**Design Notes**: Tenant business colors, business-focused typography and iconography

### 04-products.md
**Title**: Products Management - Google Stitch Prompt
**Status**: ⬜ To create
**Dependencies**: 03-merchant-dashboard.md
**Description**: Multi-product management interface extending the existing single-product flow to support unlimited products with variants, inventory, media, and categorization.
**Planned Sections**:
- Product Catalog Table
- Product Creation/Edit Form
- Variant Management (colors, sizes, stock)
- Image Upload & Management
- Bulk Operations
- Category Management
- Search & Filtering
**Future-Ready Considerations**: Product variants, bulk import/export, SEO optimization

### 05-orders.md
**Title**: Orders Management - Google Stitch Prompt
**Status**: ✅ Created
**Source**: `docs/landing-page-stitch.md` (referenced in existing analysis)
**Description**: Order management interface for processing, tracking, and managing customer orders with status updates, fulfillment tracking, and analytics.
**Sections**:
- Order List Table
- Order Detail View
- Status Management
- Search & Filtering
- Bulk Operations
- Export Functionality
**Dependencies**: 03-merchant-dashboard.md

### 06-customers.md
**Title**: Customers Management - Google Stitch Prompt
**Status**: ⬜ To create
**Dependencies**: 03-merchant-dashboard.md
**Description**: Customer relationship management interface for storing customer data, segmentation, communication, and order history tracking.
**Planned Sections**:
- Customer Directory
- Customer Profile
- Order History
- Segmentation
- Communication Tools
- Import/Export
**Future-Ready Considerations**: Customer segmentation, CRM integration, communication automation

### 07-reports.md
**Title**: Reports & Analytics - Google Stitch Prompt
**Status**: ⬜ To create
**Dependencies**: 03-merchant-dashboard.md
**Description**: Business intelligence and analytics interface for sales reports, product performance, customer behavior, and trend analysis.
**Planned Sections**:
- Sales Analytics
- Product Performance
- Customer Analytics
- Inventory Reports
- Financial Reports
- Custom Report Builder
**Future-Ready Considerations**: Custom report builder, export capabilities, scheduled reports

### 08-settings.md
**Title**: Advanced Settings - Google Stitch Prompt
**Status**: ✅ Created
**Source**: `docs/billing-stitch.md` (settings section referenced)
**Description**: Advanced settings interface for platform configuration, store settings, user management, and integration configuration.
**Sections**:
- Store Configuration
- User Management
- Integration Settings
- Notification Settings
- Security Settings
- Billing Settings
**Dependencies**: 03-merchant-dashboard.md

### 09-billing.md
**Title**: Billing & Finance - Google Stitch Prompt
**Status**: ✅ Created
**Source**: `docs/billing-stitch.md`
**Description**: Billing and finance management interface for comprehensive financial operations, payment processing, and revenue tracking across all tenants.
**Sections**:
- Dashboard Overview
- Invoice Management
- Payment Processing
- Billing Reports & Analytics
- Tenant Billing Portal
- Compliance & Audit
- Footer
**Dependencies**: 02-super-admin.md
**Future-Ready Considerations**: Scalability, plugin architecture, PCI DSS compliance

### 10-subscriptions.md
**Title**: Subscriptions Management - Google Stitch Prompt
**Status**: ✅ Created
**Source**: `docs/subscription-stitch.md`
**Description**: Subscription management interface for managing tenant subscriptions, plans, billing, and payment processing with comprehensive control over the platform's subscription ecosystem.
**Sections**:
- Header & Navigation
- Main Navigation Tabs
- Dashboard Overview
- Active Subscriptions
- Plan Management
- Billing Interface
- Customer Portal
- Promotional Tools
- Reports & Analytics
- Footer
**Dependencies**: 02-super-admin.md
**Future-Ready Considerations**: Scalability, extensibility, PCI DSS compliance

### 11-merchant-dashboard-complete.md
**Title**: Merchant Dashboard Completion - Google Stitch Prompt
**Status**: ✅ Created
**Source**: `docs/stitch-prompts/11-merchant-dashboard-complete.md`
**Description**: Upgrades merchant dashboard from hardcoded per-person stats to fully dynamic with per-store stats and recent orders table. Removes khaledStats/mahmoudStats and replaces with storesStats array.
**Sections**:
- Dynamic dashboard stats by store
- Recent orders table (last 10)
- Removed hardcoded ref=1/ref=2 logic
**Dependencies**: 03-merchant-dashboard.md

### 12-merchant-settings.md
**Title**: Merchant Settings - Google Stitch Prompt
**Status**: ✅ Created
**Source**: `docs/stitch-prompts/12-merchant-settings.md`
**Description**: Creates merchant settings hub with Store Info tab (name, tagLine, logo upload, primaryColor), Shipping placeholder, and Integrations placeholder.
**Sections**:
- Store Info form
- Logo upload
- Color picker
- Save with toast notifications
**Dependencies**: 03-merchant-dashboard.md

### 13-landing-page-builder.md
**Title**: Landing Page Builder - Google Stitch Prompt
**Status**: ✅ Created
**Source**: `docs/stitch-prompts/13-landing-page-builder.md`
**Description**: Landing page builder for merchants to create, edit, and publish marketing pages with hero, features, products, CTA, and footer sections.
**Sections**:
- Landing page list with create + publish toggle
- Section editor (reorder, edit, delete)
- Public render endpoint
**Dependencies**: 03-merchant-dashboard.md

### 14-public-landing-pages.md
**Title**: Customer-Facing Landing Pages - Google Stitch Prompt
**Status**: ✅ Created
**Source**: `docs/stitch-prompts/14-public-landing-pages.md`
**Description**: Public-facing route at `/p/:slug` that renders a published landing page with merchant's store branding (logo, name, tagLine, primaryColor).
**Sections**:
- Public render component (PublicLanding.tsx)
- 404 handling for unpublished/missing pages
- Store branding integration
**Dependencies**: 13-landing-page-builder.md

### 15-store-theme-customization.md
**Title**: Store Theme Customization - Google Stitch Prompt
**Status**: ✅ Created
**Source**: `docs/stitch-prompts/15-store-theme-customization.md`
**Description**: Returns store branding (name, tagLine, logo, primaryColor) in product API response and renders it in CustomerOrder header.
**Sections**:
- API response enhancement (/api/orders/product)
- Dynamic header in CustomerOrder.tsx
- Graceful fallback when branding is absent
**Dependencies**: 12-merchant-settings.md

### 16-products-improvements.md
**Title**: Products Improvements - Google Stitch Prompt
**Status**: ✅ Created
**Source**: `docs/stitch-prompts/16-products-improvements.md`
**Description**: Enhances merchant products form with colors (chip input), sizes (chip input), variant stock matrix, pricing tiers, image upload per color, and active toggle.
**Sections**:
- Full product form (name, description, price, oldPrice, active)
- Colors chip input
- Sizes chip input
- Variant stock color × size matrix
- Pricing tiers (quantity discounts)
- Image upload per color
- Delete with confirmation
- Duplicate product
**Dependencies**: 04-products.md

### 17-customers-api.md
**Title**: Customers Management V2 - Google Stitch Prompt
**Status**: ✅ Created
**Source**: `docs/stitch-prompts/17-customers-api.md`
**Description**: Server-side customer aggregation endpoint with pagination, search, and sorting replaces client-side grouping of all orders.
**Sections**:
- Server API: GET /api/merchant/customers
- Paginated, searchable, sortable customer table
- Summary cards (total customers, orders, revenue)
- Sort by name, phone, orders, total, lastOrder
**Dependencies**: 03-merchant-dashboard.md

### 18-analytics.md
**Title**: Analytics & Reports - Google Stitch Prompt
**Status**: ✅ Created
**Source**: `docs/stitch-prompts/18-analytics.md`
**Description**: Merchant analytics page with summary KPIs, daily bar charts, trend line charts, and top products table.
**Sections**:
- 4 summary cards (total orders, confirmed orders, revenue, avg order value)
- Daily bar charts with day range selector
- SVG line charts for trends
- Top products table
**Dependencies**: 03-merchant-dashboard.md

---

## Dependencies Graph

```
01-landing-page.md
├── 02-super-admin.md
│   ├── 09-billing.md
│   └── 10-subscriptions.md
└── 03-merchant-dashboard.md
    ├── 04-products.md
    │   └── 16-products-improvements.md
    ├── 05-orders.md
    ├── 06-customers.md
    ├── 07-reports.md
    ├── 08-settings.md
    ├── 11-merchant-dashboard-complete.md
    ├── 12-merchant-settings.md
    │   └── 15-store-theme-customization.md
    ├── 13-landing-page-builder.md
    │   └── 14-public-landing-pages.md
    ├── 17-customers-api.md
    └── 18-analytics.md
```

---

## Stitch Prompt Guidelines

Every Google Stitch prompt must include:

1. **Update the existing project** - All prompts extend the existing codebase
2. **Do NOT redesign existing screens** - Preserve all Version 1 functionality
3. **Do NOT remove components** - Keep all existing components
4. **Do NOT change navigation** - Maintain existing routes and navigation
5. **Do NOT change business logic** - Preserve existing workflows
6. **Only create missing UI** - Add new UI for new features
7. **Keep identical design language** - Match existing design system
8. **Keep RTL** - Maintain Arabic RTL support
9. **Keep responsiveness** - Maintain responsive design

---

## Future-Ready Architecture Preparation

Each stitch prompt prepares the platform for future support of:

- **White Label**: Custom branding and domains
- **Custom Domains**: Tenant-specific domain support
- **Multiple Stores**: Multi-store management per tenant
- **Payment Gateways**: Multiple payment processor integration
- **Shipping Providers**: Integration with shipping services
- **Coupons**: Promotional code system
- **Facebook Pixel**: Conversion tracking
- **TikTok Pixel**: Social media tracking
- **Google Analytics**: Web analytics
- **Meta Conversion API**: Server-side tracking
- **WhatsApp**: Business communication
- **SMS**: Text messaging
- **Email**: Email marketing
- **AI Assistant**: AI-powered features
- **Arabic/English**: Multi-language support
- **Dark Mode**: Dark theme support
- **Offline Mode**: PWA capabilities
- **Public API**: Third-party integrations
- **Developer API**: Developer platform
- **Plugin System**: Extensible architecture

---

## Prompt Organization

All stitch prompts are stored in `docs/stitch-prompts/` with numbered prefixes:

| File | Purpose |
|------|---------|
| `01-landing-page.md` | Landing page for customer acquisition |
| `02-super-admin.md` | Super Admin platform management |
| `03-merchant-dashboard.md` | Merchant business dashboard |
| `04-products.md` | Multi-product management |
| `05-orders.md` | Order processing and management |
| `06-customers.md` | Customer relationship management |
| `07-reports.md` | Business intelligence and analytics |
| `08-settings.md` | Advanced platform settings |
| `09-billing.md` | Billing and financial operations |
| `10-subscriptions.md` | Subscription management |
| `11-merchant-dashboard-complete.md` | Dynamic dashboard + recent orders |
| `12-merchant-settings.md` | Merchant settings UI |
| `13-landing-page-builder.md` | Landing page CRUD + editor |
| `14-public-landing-pages.md` | Public render at `/p/:slug` |
| `15-store-theme-customization.md` | Store branding in customer order |
| `16-products-improvements.md` | Full product form enhancements |
| `17-customers-api.md` | Server-side customer aggregation |
| `18-analytics.md` | Analytics API + chart page |

---

## Migration Status

### Legacy Files (archived)
| File | New Location | Status |
|------|-------------|--------|
| `docs/landing-page-stitch.md` | `docs/stitch-prompts/01-landing-page.md` | ✅ Moved |
| `docs/super-admin-stitch.md` | `docs/stitch-prompts/02-super-admin.md` | ✅ Moved |
| `docs/merchant-dashboard-stitch.md` | `docs/stitch-prompts/03-merchant-dashboard.md` | ✅ Moved |
| `docs/subscription-stitch.md` | `docs/stitch-prompts/10-subscriptions.md` | ✅ Moved |
| `docs/billing-stitch.md` | `docs/stitch-prompts/09-billing.md` | ✅ Moved |

### New Files Created
| File | Status |
|------|--------|
| `docs/stitch-prompts/04-products.md` | ✅ Created |
| `docs/stitch-prompts/05-orders.md` | ✅ Created |
| `docs/stitch-prompts/06-customers.md` | ✅ Created |
| `docs/stitch-prompts/07-reports.md` | ✅ Created |
| `docs/stitch-prompts/08-settings.md` | ✅ Created |

---

*Document created: STITCH_INDEX.md*
*Version: 1.2*
*Last Updated: 2025-07-29*
*Status: Phase E Complete — 18/18 Stitch Prompts*