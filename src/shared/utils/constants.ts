import type { OrderStatus, OrderUsageLevel, SubscriptionStatus } from '../types'

export const PERMISSIONS = [
  'products:view',
  'products:create',
  'products:edit',
  'products:delete',
  'orders:view',
  'orders:edit',
  'orders:status',
  'orders:cancel',
  'customers:view',
  'customers:create',
  'customers:edit',
  'customers:delete',
  'inventory:view',
  'inventory:adjust',
  'sales_links:view',
  'sales_links:create',
  'sales_links:analytics',
  'reports:view',
  'team:view',
  'team:invite',
  'team:manage_roles',
  'team:delete',
  'settings:view',
  'settings:edit',
  'coupons:manage',
  'landing:manage',
] as const

export type Permission = (typeof PERMISSIONS)[number]

export const PERMISSION_LABELS: Record<Permission, string> = {
  'products:view': 'عرض المنتجات',
  'products:create': 'إضافة منتج',
  'products:edit': 'تعديل منتج',
  'products:delete': 'حذف منتج',
  'orders:view': 'عرض الطلبات',
  'orders:edit': 'تعديل الطلب',
  'orders:status': 'تغيير حالة الطلب',
  'orders:cancel': 'إلغاء الطلب',
  'customers:view': 'عرض العملاء',
  'customers:create': 'إضافة عميل',
  'customers:edit': 'تعديل عميل',
  'customers:delete': 'حذف عميل',
  'inventory:view': 'عرض المخزون',
  'inventory:adjust': 'تعديل المخزون',
  'sales_links:view': 'عرض روابط البيع',
  'sales_links:create': 'إنشاء روابط البيع',
  'sales_links:analytics': 'تحليلات روابط البيع',
  'reports:view': 'عرض التقارير',
  'team:view': 'عرض الفريق',
  'team:invite': 'دعوة عضو',
  'team:manage_roles': 'تعديل الصلاحيات',
  'team:delete': 'حذف عضو',
  'settings:view': 'عرض الإعدادات',
  'settings:edit': 'تعديل الإعدادات',
  'coupons:manage': 'إدارة الكوبونات',
  'landing:manage': 'إدارة صفحات الهبوط',
}

export const PERMISSION_GROUPS: Record<string, { label: string; icon: string; permissions: Permission[] }> = {
  products: { label: 'المنتجات', icon: 'inventory_2', permissions: ['products:view', 'products:create', 'products:edit', 'products:delete'] },
  orders: { label: 'الطلبات', icon: 'receipt_long', permissions: ['orders:view', 'orders:edit', 'orders:status', 'orders:cancel'] },
  customers: { label: 'العملاء', icon: 'groups', permissions: ['customers:view', 'customers:create', 'customers:edit', 'customers:delete'] },
  inventory: { label: 'المخزون', icon: 'inventory', permissions: ['inventory:view', 'inventory:adjust'] },
  salesLinks: { label: 'روابط البيع', icon: 'link', permissions: ['sales_links:view', 'sales_links:create', 'sales_links:analytics'] },
  reports: { label: 'التقارير', icon: 'bar_chart', permissions: ['reports:view'] },
  team: { label: 'الفريق والصلاحيات', icon: 'group_add', permissions: ['team:view', 'team:invite', 'team:manage_roles', 'team:delete'] },
  settings: { label: 'الإعدادات', icon: 'settings', permissions: ['settings:view', 'settings:edit'] },
  coupons: { label: 'الكوبونات', icon: 'sell', permissions: ['coupons:manage'] },
  landing: { label: 'صفحات الهبوط', icon: 'web', permissions: ['landing:manage'] },
}

export const ROUTE_PERMISSIONS: Record<string, Permission> = {
  '/dashboard/products': 'products:view',
  '/dashboard/categories': 'products:view',
  '/dashboard/orders': 'orders:view',
  '/dashboard/customers': 'customers:view',
  '/dashboard/coupons': 'coupons:manage',
  '/dashboard/shipping': 'settings:edit',
  '/dashboard/analytics': 'reports:view',
  '/dashboard/team': 'team:view',
  '/dashboard/landing-pages': 'landing:manage',
  '/dashboard/store-links': 'sales_links:view',
  '/dashboard/notifications': 'settings:view',
  '/dashboard/tickets': 'settings:view',
  '/dashboard/subscription': 'settings:view',
  '/dashboard/themes': 'settings:edit',
  '/dashboard/settings': 'settings:view',
}

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  pending: 'قيد الانتظار',
  trialing: 'تجربة مجانية',
  active: 'نشط',
  expired: 'منتهي',
  suspended: 'موقوف',
  cancelled: 'ملغي',
  rejected: 'مرفوض',
}

export const SUBSCRIPTION_STATUS_TONES: Record<SubscriptionStatus, string> = {
  pending: 'amber',
  trialing: 'indigo',
  active: 'green',
  expired: 'red',
  suspended: 'amber',
  cancelled: 'slate',
  rejected: 'red',
}

export const SUBSCRIPTION_PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'قيد المراجعة',
  approved: 'معتمد',
  rejected: 'مرفوض',
}

export const SUBSCRIPTION_PAYMENT_STATUS_TONES: Record<string, string> = {
  pending: 'amber',
  approved: 'green',
  rejected: 'red',
}

export type { OrderUsageLevel }

export const ORDER_USAGE_LABELS: Record<OrderUsageLevel, string> = {
  none: 'بدون حد',
  normal: 'طبيعي',
  moderate: 'متوسط',
  approaching: 'مرتفع',
  near: 'قريب من الحد',
  reached: 'الحد مستنفذ',
}

export const ORDER_USAGE_TONES: Record<OrderUsageLevel, string> = {
  none: 'slate',
  normal: 'green',
  moderate: 'blue',
  approaching: 'indigo',
  near: 'amber',
  reached: 'red',
}

export const USAGE_LEVELS: OrderUsageLevel[] = ['normal', 'moderate', 'approaching', 'near', 'reached']

// Usage thresholds (%) that classify a subscription's order usage level.
export const USAGE_THRESHOLDS: Record<Exclude<OrderUsageLevel, 'none'>, number> = {
  normal: 60,
  moderate: 80,
  approaching: 90,
  near: 100,
  reached: 101,
}

export function usageLevelFor(percent: number, hasLimit: boolean): OrderUsageLevel {
  if (!hasLimit) return 'none'
  if (percent >= 100) return 'reached'
  if (percent >= 90) return 'near'
  if (percent >= 80) return 'approaching'
  if (percent >= 60) return 'moderate'
  return 'normal'
}

export const ORDER_STATUSES: OrderStatus[] = [
  'NEW',
  'CONTACTED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'RETURNED',
]

export const NOTIFICATION_TONES: Record<string, string> = {
  info: 'blue',
  success: 'green',
  warning: 'amber',
  error: 'red',
  order: 'blue',
  system: 'violet',
  billing: 'amber',
  ticket: 'indigo',
}

export const TICKET_STATUS_TONES: Record<string, string> = {
  open: 'blue',
  in_progress: 'amber',
  resolved: 'green',
  closed: 'slate',
}

export const TICKET_PRIORITY_TONES: Record<string, string> = {
  low: 'slate',
  medium: 'blue',
  high: 'amber',
  urgent: 'red',
}

export const PAYMENT_STATUS_TONES: Record<string, string> = {
  paid: 'green',
  pending: 'amber',
  failed: 'red',
  refunded: 'violet',
  completed: 'green',
}

export const AUDIT_ACTION_TONES: Record<string, string> = {
  create: 'green',
  update: 'blue',
  delete: 'red',
  login: 'violet',
  logout: 'slate',
}

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

export interface NavGroup {
  id: string
  label: string
  icon: string
  items: NavItem[]
}

export interface NavItem {
  to: string
  label: string
  icon: string
  permission?: Permission
}

export const NAV_GROUPS: Record<'platform' | 'dashboard', NavGroup[]> = {
  platform: [
    {
      id: 'overview',
      label: 'نظرة عامة',
      icon: 'space_dashboard',
      items: [
        { to: '/platform', label: 'لوحة المنصة', icon: 'space_dashboard' },
      ],
    },
    {
      id: 'merchants',
      label: 'إدارة التجار',
      icon: 'storefront',
      items: [
        { to: '/platform/merchants', label: 'التجار', icon: 'storefront' },
        { to: '/platform/customers', label: 'عملاء التجار', icon: 'groups' },
      ],
    },
    {
      id: 'subscriptions',
      label: 'الاشتراكات والخطط',
      icon: 'workspace_premium',
      items: [
        { to: '/platform/subscriptions', label: 'الاشتراكات', icon: 'card_membership' },
        { to: '/platform/plans', label: 'الخطط والباقات', icon: 'workspace_premium' },
        { to: '/platform/payments', label: 'المدفوعات والمعاملات', icon: 'payments' },
        { to: '/platform/coupons', label: 'الكوبونات', icon: 'sell' },
      ],
    },
    {
      id: 'analytics',
      label: 'تحليلات المنصة',
      icon: 'bar_chart',
      items: [
        { to: '/platform/reports', label: 'التقارير', icon: 'bar_chart' },
      ],
    },
    {
      id: 'monitoring',
      label: 'الأمان والمراقبة',
      icon: 'shield',
      items: [
        { to: '/platform/audit', label: 'سجل التدقيق', icon: 'fact_check' },
        { to: '/platform/notifications', label: 'الإشعارات', icon: 'notifications' },
        { to: '/platform/tickets', label: 'تذاكر الدعم', icon: 'support_agent' },
      ],
    },
    {
      id: 'platform-settings',
      label: 'إعدادات المنصة',
      icon: 'settings',
      items: [
        { to: '/platform/settings', label: 'إعدادات المنصة', icon: 'settings' },
      ],
    },
  ],
  dashboard: [
    {
      id: 'home',
      label: 'الرئيسية',
      icon: 'space_dashboard',
      items: [
        { to: '/dashboard', label: 'لوحة التحكم', icon: 'space_dashboard' },
      ],
    },
    {
      id: 'store',
      label: 'المتجر',
      icon: 'store',
      items: [
        { to: '/dashboard/products', label: 'المنتجات', icon: 'inventory_2', permission: 'products:view' },
        { to: '/dashboard/categories', label: 'الفئات', icon: 'category', permission: 'products:view' },
        { to: '/dashboard/orders', label: 'الطلبات', icon: 'receipt_long', permission: 'orders:view' },
        { to: '/dashboard/customers', label: 'العملاء', icon: 'groups', permission: 'customers:view' },
      ],
    },
    {
      id: 'marketing',
      label: 'التسويق والمبيعات',
      icon: 'campaign',
      items: [
        { to: '/dashboard/store-links', label: 'روابط البيع', icon: 'link', permission: 'sales_links:view' },
        { to: '/dashboard/landing-pages', label: 'صفحات الهبوط', icon: 'web', permission: 'landing:manage' },
        { to: '/dashboard/coupons', label: 'الكوبونات', icon: 'sell', permission: 'coupons:manage' },
      ],
    },
    {
      id: 'analytics',
      label: 'التحليلات',
      icon: 'bar_chart',
      items: [
        { to: '/dashboard/analytics', label: 'التحليلات والتقارير', icon: 'query_stats', permission: 'reports:view' },
      ],
    },
    {
      id: 'manage',
      label: 'إدارة المتجر',
      icon: 'settings',
      items: [
        { to: '/dashboard/themes', label: 'المظهر والقالب', icon: 'palette', permission: 'settings:edit' },
        { to: '/dashboard/shipping', label: 'الشحن والتوصيل', icon: 'local_shipping', permission: 'settings:edit' },
        { to: '/dashboard/settings', label: 'إعدادات المتجر', icon: 'settings', permission: 'settings:edit' },
      ],
    },
    {
      id: 'team',
      label: 'الفريق',
      icon: 'group_add',
      items: [
        { to: '/dashboard/team', label: 'الفريق والأدوار', icon: 'group_add', permission: 'team:view' },
      ],
    },
    {
      id: 'account',
      label: 'الاشتراك والحساب',
      icon: 'card_membership',
      items: [
        { to: '/dashboard/subscription', label: 'الاشتراك والخطة', icon: 'card_membership', permission: 'settings:view' },
        { to: '/dashboard/notifications', label: 'الإشعارات', icon: 'notifications', permission: 'settings:view' },
        { to: '/dashboard/tickets', label: 'تذاكر الدعم', icon: 'support_agent', permission: 'settings:view' },
      ],
    },
  ],
}