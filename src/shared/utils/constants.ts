import type { OrderStatus } from '../types'

export const PERMISSIONS = [
  'products:manage',
  'orders:manage',
  'customers:manage',
  'reports:view',
  'settings:manage',
  'team:manage',
  'coupons:manage',
  'landing:manage',
] as const

export type Permission = (typeof PERMISSIONS)[number]

export const PERMISSION_LABELS: Record<Permission, string> = {
  'products:manage': 'إدارة المنتجات',
  'orders:manage': 'إدارة الطلبات',
  'customers:manage': 'إدارة العملاء',
  'reports:view': 'عرض التقارير',
  'settings:manage': 'إدارة الإعدادات',
  'team:manage': 'إدارة الفريق',
  'coupons:manage': 'إدارة الكوبونات',
  'landing:manage': 'إدارة صفحات الهبوط',
}

// Permission required per merchant route. Merchants implicitly pass every
// route (they own the store); staff must hold the listed permission.
export const ROUTE_PERMISSIONS: Record<string, Permission> = {
  '/dashboard/products': 'products:manage',
  '/dashboard/categories': 'products:manage',
  '/dashboard/orders': 'orders:manage',
  '/dashboard/customers': 'customers:manage',
  '/dashboard/coupons': 'coupons:manage',
  '/dashboard/shipping': 'settings:manage',
  // Reports/Analytics surface order + customer PII (CSV export, revenue breakdown),
  // so staff need orders:manage to read that data — see firestore.rules L1 fix.
  '/dashboard/reports': 'orders:manage',
  '/dashboard/analytics': 'orders:manage',
  '/dashboard/team': 'team:manage',
  '/dashboard/roles': 'team:manage',
  '/dashboard/landing-pages': 'landing:manage',
  '/dashboard/store-links': 'orders:manage',
  '/dashboard/notifications': 'settings:manage',
  '/dashboard/tickets': 'settings:manage',
  '/dashboard/subscription': 'settings:manage',
  '/dashboard/settings': 'settings:manage',
}

// Dashboard nav filtered by a user's permissions (merchant → all).
export const ORDER_STATUSES: OrderStatus[] = [
  'NEW',
  'CONTACTED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'RETURNED',
]

export const STATUS_LABELS: Record<OrderStatus, string> = {
  NEW: 'جديد',
  CONTACTED: 'تم التواصل',
  PROCESSING: 'قيد التجهيز',
  SHIPPED: 'تم الشحن',
  DELIVERED: 'تم التسليم',
  CANCELLED: 'ملغي',
  RETURNED: 'مرتجع',
}

export const STATUS_COLORS: Record<OrderStatus, string> = {
  NEW: 'blue',
  CONTACTED: 'violet',
  PROCESSING: 'amber',
  SHIPPED: 'indigo',
  DELIVERED: 'green',
  CANCELLED: 'red',
  RETURNED: 'slate',
} as const

export const ROLE_LABELS = {
  superAdmin: 'مدير المنصة',
  merchant: 'تاجر',
  staff: 'موظف',
  customer: 'عميل',
} as const

export const GOVER_EG = [
  'القاهرة',
  'الجيزة',
  'الإسكندرية',
  'الدقهلية',
  'الشرقية',
  'الغربية',
  'المنوفية',
  'القليوبية',
  'كفر الشيخ',
  'البحيرة',
  'دمياط',
  'بورسعيد',
  'الإسماعيلية',
  'السويس',
  'الفيوم',
  'بني سويف',
  'المنيا',
  'أسيوط',
  'سوهاج',
  'قنا',
  'الأقصر',
  'أسوان',
  'البحر الأحمر',
  'الوادي الجديد',
  'مطروح',
  'شمال سيناء',
  'جنوب سيناء',
]

export const NAV_ITEMS = {
  // Super Admin manages the PLATFORM, not a merchant store.
  // Merchant-operational modules (products/orders/customers/inventory/sales-links/
  // team/store-settings) are deliberately NOT exposed here. Merchant inspection
  // happens via "View Store" and "Impersonate" actions on /platform/stores/​:id.
  platform: [
    { to: '/platform', label: 'نظرة عامة', icon: 'space_dashboard' },
    { to: '/platform/merchants', label: 'التجار', icon: 'storefront' },
    { to: '/platform/stores', label: 'المتاجر', icon: 'store' },
    { to: '/platform/plans', label: 'الباقات', icon: 'workspace_premium' },
    { to: '/platform/subscriptions', label: 'الاشتراكات', icon: 'card_membership' },
    { to: '/platform/payments', label: 'المدفوعات', icon: 'payments' },
    { to: '/platform/coupons', label: 'الكوبونات', icon: 'local_offer' },
    { to: '/platform/reports', label: 'التقارير', icon: 'bar_chart' },
    { to: '/platform/notifications', label: 'الإشعارات', icon: 'notifications' },
    { to: '/platform/audit', label: 'سجل التدقيق', icon: 'fact_check' },
    { to: '/platform/settings', label: 'إعدادات المنصة', icon: 'settings' },
  ],
  dashboard: [
    { to: '/dashboard', label: 'لوحة التحكم', icon: 'space_dashboard' },
    { to: '/dashboard/products', label: 'المنتجات', icon: 'inventory_2' },
    { to: '/dashboard/categories', label: 'الفئات', icon: 'category' },
    { to: '/dashboard/orders', label: 'الطلبات', icon: 'receipt_long' },
    { to: '/dashboard/customers', label: 'العملاء', icon: 'groups' },
    { to: '/dashboard/coupons', label: 'الكوبونات', icon: 'local_offer' },
    { to: '/dashboard/shipping', label: 'الشحن والتوصيل', icon: 'local_shipping' },
    { to: '/dashboard/reports', label: 'التقارير', icon: 'bar_chart' },
    { to: '/dashboard/analytics', label: 'التحليلات', icon: 'query_stats' },
    { to: '/dashboard/team', label: 'الفريق', icon: 'group_add' },
    { to: '/dashboard/roles', label: 'الأدوار والصلاحيات', icon: 'admin_panel_settings' },
    { to: '/dashboard/landing-pages', label: 'صفحات الهبوط', icon: 'web' },
    { to: '/dashboard/store-links', label: 'روابط المتجر', icon: 'link' },
    { to: '/dashboard/notifications', label: 'الإشعارات', icon: 'notifications' },
    { to: '/dashboard/tickets', label: 'الدعم', icon: 'support_agent' },
    { to: '/dashboard/subscription', label: 'الاشتراك', icon: 'card_membership' },
    { to: '/dashboard/settings', label: 'إعدادات المتجر', icon: 'settings' },
  ],
}
