# Master Architecture - M&K Store SaaS Platform

## Complete System Architecture

### Overview
The M&K Store platform is a Multi-Tenant SaaS e-commerce solution built on a modern full-stack architecture. The existing application (Version 1) serves as the foundation, with all new features extending it to prepare Version 2.

### Architecture Diagram
```
┌─────────────────────────────────────────────────────────────┐
│                    Client Layer                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Landing     │  │  Admin Panel │  │  Customer     │      │
│  │  Page        │  │  (Dashboard) │  │  Store        │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────┬──────────────────────────────────┘
                          │
┌─────────────────────────┴──────────────────────────────────┐
│                    API Gateway                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Auth        │  │  Tenant      │  │  Public      │      │
│  │  Middleware  │  │  Middleware  │  │  Routes      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────┬──────────────────────────────────┘
                          │
┌─────────────────────────┴──────────────────────────────────┐
│                    Application Layer                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Admin       │  │  Orders      │  │  Product     │      │
│  │  Routes      │  │  Routes      │  │  Routes      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Store       │  │  Settings    │  │  Upload      │      │
│  │  Routes      │  │  Routes      │  │  Routes      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────┬──────────────────────────────────┘
                          │
┌─────────────────────────┴──────────────────────────────────┐
│                    Data Layer                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Prisma      │  │  SQLite      │  │  Uploads     │      │
│  │  ORM        │  │  Database    │  │  Storage     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

---

## Database Models

### Current Schema (`server/prisma/schema.prisma`)

#### Admin
```prisma
model Admin {
  id           String   @id @default(uuid())
  username     String   @unique
  email        String   @unique
  passwordHash String
  createdAt    DateTime @default(now())

  tenantUsers   TenantUser[]   @relation("TenantUsersOnAdmin")
  subscriptions Subscription[] @relation("SubscriptionsOnAdmin")

  @@map("admins")
}
```
- **Purpose**: Platform-wide admin users (super admin)
- **Relationships**: Has many TenantUser (named relation), has many Subscription (named relation)

#### Tenant
```prisma
model Tenant {
  id          String   @id @default(uuid())
  name        String
  subdomain   String   @unique
  domain      String?
  email       String
  phone       String?
  address     String
  status      String   @default("ACTIVE")
  plan        String   @default("STARTER")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  tenantUsers     TenantUser[]
  subscriptions   Subscription[]
  roles           Role[]
  invitations     Invitation[]
  products       Product[]
  orders         Order[]
  stores         Store[]
}
```
- **Purpose**: Merchant workspace
- **Relationships**: Has many TenantUser, Subscription, Role, Invitation, Product, Order, Store

#### TenantUser
```prisma
model TenantUser {
  id         String   @id @default(uuid())
  tenantId   String
  adminId    String
  role       String   @default("ADMIN")
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  tenant   Tenant   @relation(fields: [tenantId], references: [id])
  admin    Admin    @relation("TenantUsersOnAdmin", fields: [adminId], references: [id])

  @@unique([tenantId, adminId])
  @@map("tenant_users")
}
```
- **Purpose**: Links admins to tenants (many-to-many with role)
- **Relationships**: Belongs to Tenant, belongs to Admin (named relation)

#### Subscription
```prisma
model Subscription {
  id            String   @id @default(uuid())
  tenantId      String
  adminId       String
  plan          String
  price         Float
  status        String   @default("ACTIVE")
  currentPeriod DateTime
  nextBilling   DateTime
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  tenant        Tenant   @relation(fields: [tenantId], references: [id])
  admin         Admin    @relation("SubscriptionsOnAdmin", fields: [adminId], references: [id])

  @@map("subscriptions")
}
```
- **Purpose**: Tenant subscription management
- **Relationships**: Belongs to Tenant, belongs to Admin (named relation)

#### Role
```prisma
model Role {
  id          String   @id @default(uuid())
  tenantId    String
  name        String
  description String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  permissions Permission[]

  @@unique([tenantId, name])
}
```
- **Purpose**: Role-based access control within tenant
- **Relationships**: Belongs to Tenant, has many Permission

#### Permission
```prisma
model Permission {
  id         String   @id @default(uuid())
  roleId     String
  resource   String
  action     String
  createdAt  DateTime @default(now())

  role       Role     @relation(fields: [roleId], references: [id])

  @@unique([roleId, resource, action])
}
```
- **Purpose**: Individual permissions assigned to roles
- **Relationships**: Belongs to Role

#### Invitation
```prisma
model Invitation {
  id         String   @id @default(uuid())
  tenantId   String
  email      String
  role       String   @default("EDITOR")
  token      String   @unique
  expiresAt  DateTime
  createdAt  DateTime @default(now())
  acceptedAt DateTime?

  tenant     Tenant   @relation(fields: [tenantId], references: [id])
}
```
- **Purpose**: User invitation system
- **Relationships**: Belongs to Tenant

#### Product
```prisma
model Product {
  id           String   @id @default(uuid())
  tenantId     String?
  name         String
  description  String
  price        Float
  oldPrice     Float?
  pricingTiers String   @default("{}")
  variantStock String   @default("{}")
  images       String   @default("{}")
  colors       String   @default("[]")
  sizes        String   @default("[]")
  active       Boolean  @default(true)
  updatedAt    DateTime @updatedAt

  tenant       Tenant?   @relation(fields: [tenantId], references: [id])

  @@map("products")
}
```
- **Purpose**: Product catalog (multi-product support)
- **Relationships**: Belongs to Tenant (optional)
- **Note**: `tenantId` is optional for backward compatibility with Version 1 single-product flow

#### Order
```prisma
model Order {
  id          String     @id @default(uuid())
  orderNumber String     @unique
  customerName String
  phone       String
  governorate String
  city        String
  address     String
  notes       String?
  totalPrice  Float      @default(0)
  status      String     @default("NEW")
  tenantId    String?
  createdBy   String?
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
  items       OrderItem[]

  tenant       Tenant?     @relation(fields: [tenantId], references: [id])

  @@map("orders")
}
```
- **Purpose**: Customer orders
- **Relationships**: Belongs to Tenant (optional), has many OrderItem
- **Note**: `tenantId` and `createdBy` are optional for backward compatibility with Version 1

#### OrderItem
```prisma
model OrderItem {
  id        String @id @default(uuid())
  color     String
  size      String
  quantity  Int
  unitPrice Float?
  orderId   String
  order     Order  @relation(fields: [orderId], references: [id], onDelete: Cascade)
}
```
- **Purpose**: Order line items
- **Relationships**: Belongs to Order

#### Store
```prisma
model Store {
  id          String   @id @default(uuid())
  ref         String   @unique
  name        String
  tagLine     String?
  primaryColor String?
  logo        String?
  tenantId    String?
  active      Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  visitors    Int      @default(0)
  conversions Int      @default(0)

  tenant      Tenant?   @relation(fields: [tenantId], references: [id])
  storeLinks  StoreLink[]

  @@unique([tenantId, name])
  @@map("stores")
}
```
- **Purpose**: Store configurations for tenants
- **Relationships**: Belongs to Tenant (optional), has many StoreLink
- **Note**: `tenantId` is optional for backward compatibility with Version 1; `ref` field used for store links

#### StoreLink
```prisma
model StoreLink {
  id          String   @id @default(uuid())
  storeId     String
  slug        String   @unique
  customTitle String?
  customLogo  String
  customColor String
  productIds  String
  stats       Json
  createdAt  DateTime @default(now())

  store       Store    @relation(fields: [storeId], references: [id])
}
```
- **Purpose**: Marketing links with tracking
- **Relationships**: Belongs to Store

---

## Relationships

### Entity Relationship Diagram
```
Admin (1) ────< TenantUser >──── (1) Tenant
Admin (1) ────< Subscription >──── (1) Tenant
Tenant (1) ────< Role >──── (1) Tenant
Tenant (1) ────< Invitation >──── (1) Tenant
Tenant (1) ────< Product >──── (1) Tenant
Tenant (1) ────< Order >──── (1) Tenant
Tenant (1) ────< Store >──── (1) Tenant
Store (1) ────< StoreLink >──── (1) Store
Role (1) ────< Permission >──── (1) Role
Order (1) ────< OrderItem >──── (1) Order
```

### Multi-Tenant Isolation
- All tenant-specific data is filtered by `tenantId`
- Admin users are linked to tenants via `TenantUser` junction table
- Super admins manage tenants from the platform level

---

## APIs

### Backend Routes (`server/src/routes/`)

#### Admin Routes (`/api/admin`)
| Route | Method | Description | Auth |
|-------|--------|-------------|------|
| `/login` | POST | Admin authentication | No |
| `/settings/stores` | GET | List all stores | Yes |
| `/settings/stores` | POST | Create a store | Yes |
| `/settings/stores/:id` | PATCH | Update a store | Yes |
| `/settings/stores/:id` | DELETE | Delete a store | Yes |
| `/settings/admins` | GET | List all admins | Yes |
| `/settings/admins` | POST | Create an admin | Yes |
| `/settings/admins/:id` | DELETE | Delete an admin | Yes |

#### Orders Routes (`/api/admin/orders`)
| Route | Method | Description | Auth |
|-------|--------|-------------|------|
| `/dashboard` | GET | Orders analytics dashboard | Yes |
| `/` | GET | List orders (paginated) | Yes |
| `/` | POST | Create order | Yes |
| `/:id` | GET | Get order by ID | Yes |
| `/:id` | PATCH | Update order | Yes |
| `/:id` | DELETE | Delete order | Yes |

#### Product Routes (`/api/admin/product`)
| Route | Method | Description | Auth |
|-------|--------|-------------|------|
| `/` | GET | Get product | Yes |
| `/` | POST | Create product | Yes |
| `/` | PUT | Update product | Yes |

#### Upload Routes (`/api/admin/upload`)
| Route | Method | Description | Auth |
|-------|--------|-------------|------|
| `/` | POST | Upload image | Yes |

#### Merchant Settings Routes (`/api/merchant/settings`)
| Route | Method | Description | Auth |
|-------|--------|-------------|------|
| `/` | GET | Get store + tenant settings | Yes |
| `/store` | PUT | Update store info (name, tagLine, logo, primaryColor) | Yes |

#### Landing Pages Routes (`/api/merchant/landing-pages`)
| Route | Method | Description | Auth |
|-------|--------|-------------|------|
| `/` | GET | List landing pages | Yes |
| `/` | POST | Create landing page | Yes |
| `/public/:slug` | GET | Public landing page by slug | No |
| `/:id` | GET | Get landing page | Yes |
| `/:id` | PUT | Update landing page | Yes |
| `/:id` | DELETE | Delete landing page | Yes |
| `/:id/publish` | PATCH | Toggle publish status | Yes |

#### Customers Routes (`/api/merchant/customers`)
| Route | Method | Description | Auth |
|-------|--------|-------------|------|
| `/` | GET | List customers (paginated, grouped by phone) | Yes |

#### Analytics Routes (`/api/merchant/analytics`)
| Route | Method | Description | Auth |
|-------|--------|-------------|------|
| `/overview` | GET | Summary stats + top products | Yes |
| `/daily` | GET | Daily order/revenue trends | Yes |
| `/top-products` | GET | All products ranked by sales | Yes |

#### Store Routes (`/api/orders`)
| Route | Method | Description | Auth |
|-------|--------|-------------|------|
| `/product` | GET | Get product for customer view (includes store branding) | No |
| `/` | POST | Submit order | No |

#### Settings Routes (`/api/admin/settings`)
| Route | Method | Description | Auth |
|-------|--------|-------------|------|
| `/stores` | GET | List stores | Yes |
| `/stores` | POST | Create store | Yes |
| `/stores/:id` | PATCH | Update store | Yes |
| `/stores/:id` | DELETE | Delete store | Yes |
| `/admins` | GET | List admins | Yes |
| `/admins` | POST | Create admin | Yes |
| `/admins/:id` | DELETE | Delete admin | Yes |

### API Response Types

#### PaginatedResponse<T>
```typescript
interface PaginatedResponse<T> {
  orders: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

#### DashboardStats
```typescript
interface DashboardStats {
  totalOrders: number;
  newOrders: number;
  contactedOrders: number;
  processingOrders: number;
  shippedOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  returnedOrders: number;
  expectedRevenue: number;
  confirmedRevenue: number;
  confirmedOrders?: number;
  storesStats?: StoreStat[];
  totalQuantity?: number;
  storeName?: string;
  isSuperAdmin: boolean;
  totalStock: number;
  variantStock: Record<string, Record<string, number>>;
  recentOrders?: RecentOrder[];
}
```

---

## Services

### Authentication Service
- **JWT-based**: Bearer token authentication
- **Password hashing**: bcryptjs
- **Token storage**: localStorage
- **Middleware**: `authMiddleware` in `server/src/middleware/auth.ts`

### Authorization Service
- **Role-based access control (RBAC)**
- **Roles**: ADMIN, EDITOR (within tenant)
- **Permissions**: Resource-action pairs
- **Future**: Super admin role for platform management

### File Storage Service
- **Upload directory**: `server/uploads/`
- **Static serving**: `/uploads` endpoint
- **Image URL helper**: `getImageUrl()` in `src/services/api.ts`

### API Client Service
- **Base URL**: `import.meta.env.VITE_API_URL || "http://localhost:3001/api"`
- **Image base**: `import.meta.env.VITE_IMG_URL || API_BASE.replace("/api", "")`
- **Methods**: get, post, put, patch, delete
- **Error handling**: Throws errors with messages

---

## Authentication

### Current Implementation
1. Admin logs in via `/admin/login`
2. POST to `/api/admin/login` with username/password
3. Server validates credentials, returns JWT token
4. Token stored in localStorage
5. Token sent as Bearer header for authenticated requests

### Future Authentication (V2)
- Multi-tenant authentication
- Role-based access control
- Invitation-based user onboarding
- OAuth integration (Google, Microsoft)
- SSO support

---

## Authorization

### Current Authorization
- Simple token-based auth
- All authenticated users have same access

### Future Authorization (V2)
- **Super Admin**: Platform-wide access
- **Tenant Admin**: Full tenant access
- **Tenant Editor**: Limited tenant access
- **Role-based permissions**: Granular resource-action control

---

## Multi-Tenant Structure

### Tenant Isolation Strategy
- **Database-level**: All tenant data filtered by `tenantId`
- **API-level**: Tenant context from authenticated user
- **UI-level**: Tenant-specific branding and data

### Tenant Hierarchy
```
Platform (Super Admin)
├── Tenant 1 (Store Owner)
│   ├── Admin User
│   ├── Editor User
│   ├── Products
│   ├── Orders
│   └── Store Links
├── Tenant 2 (Store Owner)
│   ├── Admin User
│   ├── Products
│   ├── Orders
│   └── Store Links
└── ...
```

### Store Mapping (Version 1)
- `ref=1` → بنطلون الساحل (khaledStats)
- `ref=2` → مالك ستور (mahmoudStats)

---

## Folder Structure

```
/home/khaled/store/
├── docs/
│   ├── PROJECT_ROADMAP.md          # Project roadmap
│   ├── MASTER_ARCHITECTURE.md      # This file
│   ├── STITCH_INDEX.md             # Stitch prompts index
│   ├── phase-1-analysis.md         # Phase 1 analysis
│   ├── stitch-prompts/             # Google Stitch prompts
│   │   ├── 01-landing-page.md
│   │   ├── 02-super-admin.md
│   │   ├── 03-merchant-dashboard.md
│   │   ├── 04-products.md
│   │   ├── 05-orders.md
│   │   ├── 06-customers.md
│   │   ├── 07-reports.md
│   │   ├── 08-settings.md
│   │   ├── 09-billing.md
│   │   ├── 10-subscriptions.md
│   │   ├── 11-merchant-dashboard-complete.md
│   │   ├── 12-merchant-settings.md
│   │   ├── 13-landing-page-builder.md
│   │   ├── 14-public-landing-pages.md
│   │   ├── 15-store-theme-customization.md
│   │   ├── 16-products-improvements.md
│   │   ├── 17-customers-api.md
│   │   └── 18-analytics.md
│   ├── landing-page-stitch.md      # Legacy (to be moved)
│   ├── super-admin-stitch.md       # Legacy (to be moved)
│   ├── merchant-dashboard-stitch.md # Legacy (to be moved)
│   ├── subscription-stitch.md      # Legacy (to be moved)
│   ├── billing-stitch.md           # Legacy (to be moved)
│   └── store-links-stitch.md       # Legacy (to be moved)
├── server/
│   ├── prisma/
│   │   ├── schema.prisma           # Database schema
│   │   └── dev.db                  # SQLite database
│   ├── src/
│   │   ├── routes/
│   │   │   ├── admin.ts
│   │   │   ├── orders.ts
│   │   │   ├── product.ts
│   │   │   ├── store.ts
│   │   │   ├── upload.ts
│   │   │   ├── settings.ts
│   │   │   ├── auth.ts
│   │   │   ├── categories.ts
│   │   │   ├── customers.ts
│   │   │   ├── analytics.ts
│   │   │   ├── tenants.ts
│   │   │   ├── subscriptions.ts
│   │   │   ├── sellers.ts
│   │   │   ├── merchantProducts.ts
│   │   │   ├── merchantSettings.ts
│   │   │   ├── landingPages.ts
│   │   │   └── seller/
│   │   ├── middleware/
│   │   │   ├── auth.ts
│   │   │   └── errorHandler.ts
│   │   ├── utils/
│   │   │   └── prisma.ts
│   │   ├── config.ts
│   │   └── index.ts
│   ├── uploads/                    # Uploaded files
│   ├── package.json
│   └── tsconfig.json
├── src/
│   ├── pages/
│   │   ├── AdminLogin.tsx
│   │   ├── AdminDashboard.tsx
│   │   ├── AdminOrders.tsx
│   │   ├── AdminProduct.tsx
│   │   ├── AdminSettings.tsx
│   │   ├── AdminCustomers.tsx
│   │   ├── AdminReports.tsx
│   │   ├── AdminStoreLinks.tsx
│   │   ├── AdminSubscriptions.tsx
│   │   ├── AdminBilling.tsx
│   │   ├── AdminSuperAdmin.tsx
│   │   ├── SuperAdminTenants.tsx
│   │   ├── CustomerOrder.tsx
│   │   ├── SellerLogin.tsx
│   │   ├── SellerDashboard.tsx
│   │   ├── Landing.tsx
│   │   ├── PublicPricing.tsx
│   │   ├── Onboarding.tsx
│   │   ├── MerchantProducts.tsx
│   │   ├── MerchantSellers.tsx
│   │   ├── MerchantStoreLinks.tsx
│   │   ├── MerchantLandingPages.tsx
│   │   ├── MerchantLandingEditor.tsx
│   │   ├── MerchantSettings.tsx
│   │   ├── MerchantCustomers.tsx
│   │   ├── MerchantAnalytics.tsx
│   │   ├── PublicLanding.tsx
│   │   └── StoreLinkRedirect.tsx
│   ├── components/
│   │   └── Sidebar.tsx
│   ├── services/
│   │   └── api.ts
│   ├── types/
│   │   └── index.ts
│   ├── hooks/
│   ├── utils/
│   ├── index.css
│   ├── main.tsx
│   ├── App.tsx
│   └── preact-shims.d.ts
├── functions/                      # Firebase functions
├── .firebase/                      # Firebase config
├── firebase.json                   # Firebase hosting config
├── package.json
├── tsconfig.json
├── vite.config.ts
└── index.html
```

---

## Google Stitch Mapping

| Stitch Prompt | Page/Route | Status |
|---------------|------------|--------|
| `01-landing-page.md` | `/` (landing page) | ✅ Created |
| `02-super-admin.md` | `/super-admin/*` | ✅ Created |
| `03-merchant-dashboard.md` | `/merchant` (dashboard) | ✅ Created |
| `04-products.md` | `/merchant/products` (multi-product) | ✅ Created |
| `05-orders.md` | `/merchant/orders` | ✅ Created |
| `06-customers.md` | `/merchant/customers` | ✅ Created |
| `07-reports.md` | `/merchant/reports` | ✅ Created |
| `08-settings.md` | `/merchant/settings` | ✅ Created |
| `09-billing.md` | `/admin/billing` | ✅ Created |
| `10-subscriptions.md` | `/admin/subscriptions` | ✅ Created |
| `11-merchant-dashboard-complete.md` | Dashboard dynamic + recent orders | ✅ Created |
| `12-merchant-settings.md` | `/merchant/settings` (store info, logo, colors) | ✅ Created |
| `13-landing-page-builder.md` | `/merchant/landing-pages` + editor | ✅ Created |
| `14-public-landing-pages.md` | `/p/:slug` (public render) | ✅ Created |
| `15-store-theme-customization.md` | `CustomerOrder.tsx` branding | ✅ Created |
| `16-products-improvements.md` | `/merchant/products` form enhancements | ✅ Created |
| `17-customers-api.md` | `/merchant/customers` server API + page | ✅ Created |
| `18-analytics.md` | `/merchant/analytics` charts + API | ✅ Created |

---

## Future Architecture Decisions

### Scalability
- **Horizontal scaling**: Container-ready architecture
- **Database sharding**: Tenant-based sharding strategy
- **Caching**: Redis for session and data caching
- **Load balancing**: Multiple server instances

### Extensibility
- **Plugin system**: Modular architecture for extensions
- **API-first**: All features exposed via REST APIs
- **Webhooks**: Event-driven integrations
- **Public API**: Developer API for third-party integrations

### Multi-Tenancy Evolution
- **Database-per-tenant**: Future option for enterprise tenants
- **Shared database**: Current approach with tenantId filtering
- **Hybrid approach**: Mix of both based on plan tier

### Internationalization
- **Arabic (RTL)**: Current primary language
- **English (LTR)**: Future support
- **Multi-currency**: SAR, EGP, USD support
- **Regional compliance**: VAT, tax calculations

### Technology Stack Evolution
- **Frontend**: Preact → React (if needed for ecosystem)
- **Backend**: Express → NestJS (for enterprise features)
- **Database**: SQLite → PostgreSQL (for production)
- **Hosting**: Firebase → Kubernetes (for scale)

### Payment Integration
- **Current**: Braintree (mentioned in stitch prompts)
- **Future**: Stripe, PayPal, local payment methods
- **Subscription billing**: Recurring payments
- **Multi-currency**: SAR, EGP, USD

### Analytics & Tracking
- **Google Analytics**: Web analytics
- **Facebook Pixel**: Conversion tracking
- **TikTok Pixel**: Social media tracking
- **WhatsApp**: Business API integration
- **SMS**: Twilio or local provider
- **Email**: SMTP or email service provider

---

## Design System

### Colors
- **Primary**: `#FF9900` (Amazon Orange)
- **Dark**: `#131921` (Amazon Dark)
- **Accent**: `#FEBD69` (Light Orange)
- **Text**: `#B0B8C1` (Gray)
- **Success**: `#067D62` (Green)
- **Error**: `#B12704` (Red)

### Typography
- **Headings**: Plus Jakarta Sans
- **Arabic**: Noto Sans Arabic
- **Body**: Inter

### Iconography
- **Material Symbols**: All UI elements use Material Design icons

### Responsiveness
- **Mobile-first**: 320px+ breakpoints
- **Grid**: CSS Grid and Flexbox
- **Media queries**: Defined in `index.css`

---

*Document created: MASTER_ARCHITECTURE.md*
*Version: 1.2*
*Last Updated: 2025-07-29*
*Status: Phase E Complete — All Merchant Features Live*