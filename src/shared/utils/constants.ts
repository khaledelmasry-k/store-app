import type { OrderStatus } from '../types'

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
  coupons: { label: 'الكوبونات', icon: 'local_offer', permissions: ['coupons:manage'] },
  landing: { label: 'صفحات الهبوط', icon: 'web', permissions: ['landing:manage'] },
}

export const ROUTE_PERMISSIONS: Record<string, Permission> = {
  '/dashboard/products': 'products:view',
  '/dashboard/inventory': 'inventory:view',
  '/dashboard/categories': 'products:view',
  '/dashboard/orders': 'orders:view',
  '/dashboard/customers': 'customers:view',
  '/dashboard/coupons': 'coupons:manage',
  '/dashboard/shipping': 'settings:edit',
  '/dashboard/reports': 'reports:view',
  '/dashboard/analytics': 'reports:view',
  '/dashboard/team': 'team:view',
  '/dashboard/roles': 'team:manage_roles',
  '/dashboard/landing-pages': 'landing:manage',
  '/dashboard/store-links': 'sales_links:view',
  '/dashboard/notifications': 'settings:view',
  '/dashboard/tickets': 'settings:view',
  '/dashboard/subscription': 'settings:view',
  '/dashboard/settings': 'settings:view',
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
        { to: '/platform/stores', label: 'متاجر التجار', icon: 'store' },
        { to: '/platform/customers', label: 'عملاء التجار', icon: 'groups' },
        { to: '/platform/accounts', label: 'حسابات التجار', icon: 'person' },
      ],
    },
    {
      id: 'subscriptions',
      label: 'الاشتراكات والخطط',
      icon: 'workspace_premium',
      items: [
        { to: '/platform/subscriptions', label: 'الاشتراكات', icon: 'card_membership' },
        { to: '/platform/plans', label: 'الخطط والباقات', icon: 'workspace_premium' },
        { to: '/platform/payments', label: 'المدفوعات', icon: 'payments' },
        { to: '/platform/coupons', label: 'الكوبونات', icon: 'local_offer' },
      ],
    },
    {
      id: 'analytics',
      label: 'إحصائيات المنصة',
      icon: 'bar_chart',
      items: [
        { to: '/platform/reports', label: 'التقارير', icon: 'bar_chart' },
        { to: '/platform/analytics', label: 'الإيرادات', icon: 'trending_up' },
        { to: '/platform/transactions', label: 'المعاملات', icon: 'sync' },
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
        { to: '/platform/roles', label: 'الأدوار والصلاحيات', icon: 'admin_panel_settings' },
      ],
    },
    {
      id: 'platform-settings',
      label: 'إعدادات المنصة',
      icon: 'settings',
      items: [
        { to: '/platform/settings', label: 'إعدادات المنصة', icon: 'settings' },
        { to: '/platform/general', label: 'إعدادات عامة', icon: 'tune' },
      ],
    },
  ],
  dashboard: [
    {
      id: 'main',
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
        { to: '/dashboard/store', label: 'واجهة المتجر', icon: 'store' },
        { to: '/dashboard/store-settings', label: 'إعدادات المتجر', icon: 'settings' },
        { to: '/dashboard/store-links', label: 'روابط المتجر', icon: 'link' },
      ],
    },
    {
      id: 'catalog',
      label: 'الكتالوج',
      icon: 'inventory_2',
      items: [
        { to: '/dashboard/products', label: 'المنتجات', icon: 'inventory_2', permission: 'products:view' },
        { to: '/dashboard/categories', label: 'التصنيفات', icon: 'category', permission: 'products:view' },
        { to: '/dashboard/inventory', label: 'المخزون', icon: 'inventory', permission: 'inventory:view' },
      ],
    },
    {
      id: 'orders',
      label: 'الطلبات',
      icon: 'receipt_long',
      items: [
        { to: '/dashboard/orders', label: 'الطلبات', icon: 'receipt_long', permission: 'orders:view' },
        { to: '/dashboard/shipping', label: 'الشحن والتوصيل', icon: 'local_shipping', permission: 'orders:edit' },
      ],
    },
    {
      id: 'customers',
      label: 'العملاء',
      icon: 'groups',
      items: [
        { to: '/dashboard/customers', label: 'العملاء', icon: 'groups', permission: 'customers:view' },
      ],
    },
    {
      id: 'sales',
      label: 'المبيعات',
      icon: 'trending_up',
      items: [
        { to: '/dashboard/store-links', label: 'روابط البيع', icon: 'link', permission: 'sales_links:view' },
        { to: '/dashboard/analytics', label: 'التحليلات', icon: 'query_stats', permission: 'reports:view' },
      ],
    },
    {
      id: 'marketing',
      label: 'التسويق',
      icon: 'campaign',
      items: [
        { to: '/dashboard/landing-pages', label: 'صفحات الهبوط', icon: 'web', permission: 'landing:manage' },
        { to: '/dashboard/coupons', label: 'الكوبونات', icon: 'local_offer', permission: 'coupons:manage' },
      ],
    },
    {
      id: 'team',
      label: 'الفريق والصلاحيات',
      icon: 'group_add',
      items: [
        { to: '/dashboard/team', label: 'الفريق', icon: 'group_add', permission: 'team:view' },
        { to: '/dashboard/roles', label: 'الأدوار والصلاحيات', icon: 'admin_panel_settings', permission: 'team:manage_roles' },
      ],
    },
    {
      id: 'reports',
      label: 'التقارير',
      icon: 'bar_chart',
      items: [
        { to: '/dashboard/reports', label: 'التقارير', icon: 'bar_chart', permission: 'reports:view' },
      ],
    },
    {
      id: 'subscription',
      label: 'الاشتراك',
      icon: 'card_membership',
      items: [
        { to: '/dashboard/subscription', label: 'الاشتراك الحالي', icon: 'card_membership', permission: 'settings:view' },
      ],
    },
    {
      id: 'support',
      label: 'الدعم',
      icon: 'support_agent',
      items: [
        { to: '/dashboard/tickets', label: 'تذاكر الدعم', icon: 'support_agent', permission: 'settings:view' },
        { to: '/dashboard/notifications', label: 'الإشعارات', icon: 'notifications', permission: 'settings:view' },
      ],
    },
    {
      id: 'store-settings',
      label: 'إعدادات المتجر',
      icon: 'settings',
      items: [
        { to: '/dashboard/settings', label: 'إعدادات عامة', icon: 'settings', permission: 'settings:edit' },
        { to: '/dashboard/shipping', label: 'إعدادات الشحن', icon: 'local_shipping', permission: 'settings:edit' },
        { to: '/dashboard/payments', label: 'إعدادات الدفع', icon: 'payments', permission: 'settings:edit' },
      ],
    },
  ],
}