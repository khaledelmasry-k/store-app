# Matjari (متجري) — Product Specification

## Product Vision

Matjari is a multi-tenant SaaS ecommerce platform that allows businesses to create and manage online stores without technical complexity.

## Three System Levels

### A) Platform Admin (`/platform/*`)
- Manages the entire Matjari SaaS platform
- Can create/suspend/activate stores
- Can manage merchants
- Can view subscriptions, plans, payments, transactions
- Can manage coupons, reports, audit logs
- Can manage platform settings

### B) Merchant Dashboard (`/dashboard/*`)
- Manages their own store(s)
- Can add/edit products, manage orders, customers, inventory
- Can create sales links for sellers/marketers
- Can manage team members with configurable permissions
- Can view reports and analytics
- Can manage store settings

### C) Customer Storefront (`/store/:slug/*`)
- Public ecommerce storefront
- Browse products, add to cart, checkout
- Track orders
- Customer account management

### D) Public Marketing Website (`/`)
- Pure marketing landing page
- No login, no dashboard, no platform UI
- Navbar, Hero, Features, How It Works, Pricing, FAQ, CTA, Footer

## Authentication Flow

```
Login Page (/login?role=platform|merchant|customer)
    ↓
Submit Credentials
    ↓
Firebase Authentication
    ↓
Resolve Firebase User
    ↓
Load users/{uid} from Firestore
    ↓
Resolve Role (superAdmin | merchant | staff | customer)
    ↓
Resolve Store Membership (if applicable)
    ↓
Redirect Based on Role
    ↓
superAdmin → /platform/
merchant → /dashboard/
staff → /dashboard/
customer → / (storefront)
```

## Role Model

| Role | Description | Scope |
|---|---|---|
| `superAdmin` | Platform owner | All stores, all data |
| `merchant` | Store owner/operator | Owns `storeIds[]` |
| `staff` | Team member with granular permissions | Per-store via `RoleDef` |
| `customer` | Storefront shopper | Own orders/addresses/wishlist |

## Sales Links Feature

### Business Model
Merchants can create unique tracking links for each seller/marketer. When a customer enters through a sales link, the attribution is preserved throughout the shopping session and stored with the order.

### URL Format
```
/store/:storeSlug?ref=:sellerCode
```

### Attribution Flow
```
Sales Link (/store/:slug?ref=ahmed)
    ↓
Customer visits store
    ↓
Product browsing
    ↓
Add to cart
    ↓
Checkout
    ↓
Order created with SalesLink attribution
```

### Sales Link Dashboard
Merchants can view analytics per sales link:
- Seller name
- Visits
- Orders
- Confirmed orders
- Delivered orders
- Revenue
- Conversion rate

## Multi-Tenancy

Every merchant-owned entity is associated with a store/tenant. Data isolation is enforced at multiple layers:

1. **Firestore Security Rules**: `canAccessStore(storeId)` checks `user.storeIds` array
2. **Backend Functions**: `assertMerchantOf()` verifies store ownership
3. **Client Services**: Accept `storeId` parameter and scope queries

## Key Features

### Merchant Dashboard
- Sales KPIs (revenue, orders, customers)
- Product management (CRUD, variants, inventory)
- Order management (status updates, stock restoration)
- Customer management
- Sales links with attribution
- Team management with RBAC
- Reports and analytics
- Store settings

### Platform Admin
- Merchant management
- Store management
- Subscription management
- Plan management
- Payment and transaction monitoring
- Coupon management
- Platform-wide reports
- Audit logs
- Support tickets
- Platform settings

### Customer Storefront
- Store branding (logo, name, theme, banner)
- Product browsing with categories and search
- Product details with variants
- Shopping cart
- Checkout flow
- Order tracking
- Customer account

## Design System

- **Primary**: Indigo/violet family
- **Supporting**: Slate neutrals
- **Success**: Green
- **Warning**: Amber
- **Danger**: Red
- **Typography**: Noto Sans Arabic (RTL)
- **Layout**: Mobile-first, responsive
- **Components**: Preact + Material Design icons

## Technical Stack

- **Frontend**: Preact 10 + Vite 8 + TypeScript
- **Router**: Wouter 3.10.0
- **Backend**: Firebase (Auth, Firestore, Functions, Hosting, Storage)
- **Database**: Firestore (NoSQL)
- **Authentication**: Firebase Auth
- **Deployment**: Vercel + Firebase Hosting
