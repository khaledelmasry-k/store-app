# Project Structure

```
mk-store-app/
├─ src/
│  ├─ App.tsx                    # Router: 3 isolated zones + login/register
│  ├─ main.tsx                   # Bootstrap: Theme > Toast > Auth > Store > Cart > App
│  ├─ index.css                  # Design tokens (light/dark), 19+ components, layouts
│  ├─ shared/
│  │  ├─ firebase/index.ts       # Firebase init (app, auth, db, storage, emu)
│  │  ├─ types/index.ts         # Domain models (User, Store, Product, Order, Customer,
│  │  │                          #   Subscription, Plan, Payment, Coupon, Ticket, ...)
│  │  ├─ contexts/
│  │  │  ├─ auth-context.ts      # { user, loading, initialized }
│  │  │  ├─ AuthProvider.tsx     # onAuthStateChanged + realtime user sync
│  │  │  ├─ theme-context.ts     # { theme, toggle, setTheme }
│  │  │  ├─ ThemeProvider.tsx    # data-theme on <html>, localStorage persistence
│  │  │  ├─ toast-context.ts
│  │  │  ├─ ToastProvider.tsx    # auto-dismiss queue (3 max)
│  │  │  ├─ store-context.ts     # { store, loading, setStoreId }
│  │  │  ├─ StoreProvider.tsx    # realtime store doc + slug resolution
│  │  │  ├─ cart-context.ts      # { items, add, remove, setQty, clear }
│  │  │  └─ CartProvider.tsx     # persisted in localStorage
│  │  ├─ hooks/
│  │  │  ├─ useAuth.ts
│  │  │  ├─ useStore.ts
│  │  │  ├─ useTheme.ts
│  │  │  ├─ useToast.ts
│  │  ├─ useCart.ts
│  │  │  ├─ useCollection.ts     # realtime collection subscribe (with storeId filter)
│  │  │  ├─ useDocument.ts       # realtime single-doc subscribe
│  │  │  ├─ useDebounce.ts       # value debouncer
│  │  ├─ utils/
│  │  │  ├─ format.ts            # formatCurrency, formatDate, formatDateTime, timeAgo,
│  │  │  │                       #   todayKey, slugify, initials, downloadFile, truncate
│  │  │  ├─ validators.ts        # isPhoneValid, isEmailValid, isPositiveNumber,
│  │  │  │                       #   generatePassword, generateToken, csvEscape, round2
│  │  │  ├─ constants.ts         # ORDER_STATUSES, STATUS_LABELS, STATUS_COLORS, ROLE_LABELS,
│  │  │  │                       #   GOVER_EG, NAV_ITEMS (platform + merchant)
│  │  │  ├─ firestore.ts         # listDocs, getDocById, createDoc, updateDocById,
│  │  │  │                       #   deleteDocById, subscribeCollection, ts(), fromTs(), serverTimestamp
│  │  │  └─ clsx.ts              # className merge helper
│  │  ├� services/
│  │  │  ├─ auth.ts              # login/logout/registerMerchant/signupCustomer +
│  │  │  │                       #   callable wrappers (createOrder, updateOrderStatus,
│  │  │  │                       #   generateOrderNumber, approveSubscription, impersonate)
│  │  │  ├─ users.ts
│  │  │  ├─ stores.ts
│  │  │  ├─ products.ts
│  │  │  ├─ categories.ts
│  │  │  ├─ orders.ts
│  │  │  ├─ customers.ts
│  │  │  ├─ billing.ts           # subscriptionsService, plansService, transactionsService,
│  │  │  │                       #   paymentsService, couponsService, shippingService
│  │  │  ├─ system.ts            # notificationsService, ticketsService, auditService,
│  │  │  │                       #   analyticsService, storeLinksService, landingPagesService,
│  │  │  │                       #   teamService, rolesService, invitationsService,
│  │  │  │                       #   addressesService, wishlistService, settingsService
│  │  ├� components/
│  │  │  ├� ui/                  # Button, Input, Select, Textarea, Card, PageHeader,
│  │  │  │                       #   Badge, StatsCard, ChartCard, Table, EmptyState,
│  │  │  │                       #   Loading, Skeleton, Search, Tabs, Modal, Drawer,
│  │  │  │                       #   Dropdown, ToastViewport, ConfirmDialog, Toggle,
│  │  │  │                       #   Avatar, Progress, SegmentedControl
│  │  │  ├─ charts/             # BarChart, LineChart, DonutChart (pure SVG)
│  │  │  ├─ layout/             # PlatformLayout, MerchantLayout, StoreLayout (+ AppShell)
│  │  │  ├─ guards/             # RequireRole, PublicOnly
│  │  │  ├─ auth/               # Login (3-role single component), Register
│  │  │  └─ order/              # OrderDetails (shared by platform + merchant)
│  ├─ platform/pages/           # 16 platform pages (see ROUTING.md)
│  ├─ merchant/pages/           # 17 merchant pages
│  └─ store/pages/              # 8 storefront pages
├─ functions/
│  ├─ package.json              # firebase-admin, firebase-functions
│  ├─ tsconfig.json
│  └─ src/
│     └─ index.ts              # 6 callable functions:
│                              #   generateOrderNumber, createOrder, registerMerchant,
│                              #   approveSubscription, updateOrderStatus, impersonate
├─ firebase.json               # Hosting / Functions / Emulators config
├─ .firebaserc                 # { projectId: "mk-store-app" }
├─ firestore.rules
├─ firestore.indexes.json
├─ storage.rules
├─ .env.example
├─ tsconfig.json
├─ vite.config.ts
└─ package.json
```

### Naming convention

- `src/shared/*` — code shared across all three apps (UI, services, hooks).
- `src/platform/*`, `src/merchant/*`, `src/store/*` — app-specific pages only.
- No cross-app imports of pages; apps only consume `shared/*`.
