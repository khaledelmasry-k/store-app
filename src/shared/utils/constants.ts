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
  'customers:export',
  'customers:notes',
  'customers:tags',
  'customers:followups',
  'crm:view',
  'crm:manage',
  'crm:followups',
  'crm:export',
  'crm:analytics',
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
  'customers:export': 'تصدير العملاء',
  'customers:notes': 'إدارة ملاحظات العملاء',
  'customers:tags': 'إدارة وسوم العملاء',
  'customers:followups': 'إدارة متابعات العملاء',
  'crm:view': 'عرض لوحة CRM',
  'crm:manage': 'إدارة CRM',
  'crm:followups': 'إدارة المتابعات',
  'crm:export': 'تصدير CRM',
  'crm:analytics': 'تحليلات CRM',
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

export const PERMISSION_GROUPS: Record<
  string,
  { label: string; icon: string; permissions: Permission[] }
> = {
  products: {
    label: 'المنتجات',
    icon: 'inventory_2',
    permissions: ['products:view', 'products:create', 'products:edit', 'products:delete'],
  },
  orders: {
    label: 'الطلبات',
    icon: 'receipt_long',
    permissions: ['orders:view', 'orders:edit', 'orders:status', 'orders:cancel'],
  },
  customers: {
    label: 'العملاء',
    icon: 'groups',
    permissions: ['customers:view', 'customers:create', 'customers:edit', 'customers:delete', 'customers:export', 'customers:notes', 'customers:tags', 'customers:followups'],
  },
  crm: {
    label: 'إدارة العملاء (CRM)',
    icon: 'groups',
    permissions: ['crm:view', 'crm:manage', 'crm:followups', 'crm:export', 'crm:analytics'],
  },
  inventory: {
    label: 'المخزون',
    icon: 'inventory',
    permissions: ['inventory:view', 'inventory:adjust'],
  },
  salesLinks: {
    label: 'روابط البيع',
    icon: 'link',
    permissions: ['sales_links:view', 'sales_links:create', 'sales_links:analytics'],
  },
  reports: { label: 'التقارير', icon: 'bar_chart', permissions: ['reports:view'] },
  team: {
    label: 'الفريق والصلاحيات',
    icon: 'group_add',
    permissions: ['team:view', 'team:invite', 'team:manage_roles', 'team:delete'],
  },
  settings: {
    label: 'الإعدادات',
    icon: 'settings',
    permissions: ['settings:view', 'settings:edit'],
  },
  coupons: { label: 'الكوبونات', icon: 'sell', permissions: ['coupons:manage'] },
  landing: { label: 'صفحات الهبوط', icon: 'web', permissions: ['landing:manage'] },
}

export const ROUTE_PERMISSIONS: Record<string, Permission> = {
  '/dashboard/products': 'products:view',
  '/dashboard/categories': 'products:view',
  '/dashboard/orders': 'orders:view',
  '/dashboard/customers': 'customers:view',
  '/dashboard/crm': 'crm:view',
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
  pending_approval: 'بانتظار موافقة الإدارة',
  trialing: 'تجربة مجانية',
  active: 'نشط',
  expired: 'منتهي',
  suspended: 'موقوف',
  cancelled: 'ملغي',
  rejected: 'مرفوض',
}

export const SUBSCRIPTION_STATUS_TONES: Record<SubscriptionStatus, string> = {
  pending: 'amber',
  pending_approval: 'amber',
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

export const USAGE_LEVELS: OrderUsageLevel[] = [
  'normal',
  'moderate',
  'approaching',
  'near',
  'reached',
]

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
  waiting_merchant: 'orange',
  waiting_support: 'violet',
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

// المدن المتاحة للاختيار أثناء إعداد مناطق التغطية. يمكن للتاجر لاحقاً استخدام
// حقل المناطق التفصيلية عند احتياجه لحي أو قرية غير مدرجة هنا.
export const EGYPT_CITIES_BY_GOVERNORATE: Record<string, string[]> = {
  القاهرة: [
    'القاهرة',
    'مدينة نصر',
    'مصر الجديدة',
    'المعادي',
    'حلوان',
    'التجمع الخامس',
    'الشروق',
    'بدر',
    'السلام',
    'المرج',
    'عين شمس',
    'الزيتون',
    'السيدة زينب',
    'المقطم',
    'الزمالك',
    'العباسية',
    'روض الفرج',
    'الشرابية',
    'بولاق',
    'دار السلام',
    'المطرية',
    '15 مايو',
  ],
  الجيزة: [
    'الجيزة',
    'الدقي',
    'العجوزة',
    'الهرم',
    'فيصل',
    '6 أكتوبر',
    'الشيخ زايد',
    'حدائق أكتوبر',
    'الحوامدية',
    'البدرشين',
    'أوسيم',
    'كرداسة',
    'منشأة القناطر',
    'الصف',
    'أطفيح',
    'العياط',
    'الواحات البحرية',
  ],
  الإسكندرية: [
    'الإسكندرية',
    'المنتزه',
    'سيدي بشر',
    'العجمي',
    'العامرية',
    'برج العرب',
    'برج العرب الجديدة',
    'الجمرك',
    'محرم بك',
    'كرموز',
    'العطارين',
    'الدخيلة',
  ],
  الدقهلية: [
    'المنصورة',
    'طلخا',
    'ميت غمر',
    'دكرنس',
    'السنبلاوين',
    'بلقاس',
    'أجا',
    'منية النصر',
    'نبروه',
    'شربين',
    'المطرية',
    'الجمالية',
    'تمي الأمديد',
    'بني عبيد',
  ],
  الشرقية: [
    'الزقازيق',
    'العاشر من رمضان',
    'بلبيس',
    'منيا القمح',
    'أبو حماد',
    'فاقوس',
    'الحسينية',
    'ههيا',
    'أبو كبير',
    'كفر صقر',
    'مشتول السوق',
    'الإبراهيمية',
    'ديرب نجم',
    'أولاد صقر',
    'الصالحية الجديدة',
  ],
  الغربية: ['طنطا', 'المحلة الكبرى', 'كفر الزيات', 'زفتى', 'السنطة', 'بسيون', 'قطور', 'سمنود'],
  المنوفية: [
    'شبين الكوم',
    'السادات',
    'منوف',
    'أشمون',
    'الباجور',
    'قويسنا',
    'بركة السبع',
    'تلا',
    'الشهداء',
    'سرس الليان',
  ],
  القليوبية: [
    'بنها',
    'شبرا الخيمة',
    'العبور',
    'قليوب',
    'القناطر الخيرية',
    'الخانكة',
    'كفر شكر',
    'طوخ',
    'شبين القناطر',
    'الخصوص',
  ],
  'كفر الشيخ': [
    'كفر الشيخ',
    'دسوق',
    'بلطيم',
    'الحامول',
    'بيلا',
    'سيدي سالم',
    'فوه',
    'مطوبس',
    'الرياض',
    'قلين',
    'برج البرلس',
  ],
  البحيرة: [
    'دمنهور',
    'كفر الدوار',
    'رشيد',
    'إدكو',
    'أبو المطامير',
    'أبو حمص',
    'الدلنجات',
    'المحمودية',
    'إيتاي البارود',
    'حوش عيسى',
    'شبراخيت',
    'كوم حمادة',
    'وادي النطرون',
    'النوبارية الجديدة',
  ],
  دمياط: [
    'دمياط',
    'دمياط الجديدة',
    'رأس البر',
    'كفر سعد',
    'فارسكور',
    'الزرقا',
    'كفر البطيخ',
    'ميت أبو غالب',
  ],
  بورسعيد: [
    'بورسعيد',
    'بورفؤاد',
    'حي العرب',
    'حي الشرق',
    'حي المناخ',
    'حي الضواحي',
    'حي الزهور',
    'حي الجنوب',
  ],
  الإسماعيلية: [
    'الإسماعيلية',
    'فايد',
    'القنطرة شرق',
    'القنطرة غرب',
    'التل الكبير',
    'أبو صوير',
    'القصاصين',
  ],
  السويس: ['السويس', 'عتاقة', 'الأربعين', 'فيصل', 'الجناين'],
  الفيوم: ['الفيوم', 'سنورس', 'إطسا', 'طامية', 'يوسف الصديق', 'إبشواي'],
  'بني سويف': ['بني سويف', 'الواسطى', 'ناصر', 'إهناسيا', 'ببا', 'الفشن', 'سمسطا'],
  المنيا: [
    'المنيا',
    'المنيا الجديدة',
    'ملوي',
    'مغاغة',
    'بني مزار',
    'سمالوط',
    'أبو قرقاص',
    'دير مواس',
    'العدوة',
    'مطاي',
  ],
  أسيوط: [
    'أسيوط',
    'أسيوط الجديدة',
    'ديروط',
    'القوصية',
    'منفلوط',
    'أبو تيج',
    'الغنايم',
    'صدفا',
    'الفتح',
    'البداري',
    'ساحل سليم',
  ],
  سوهاج: [
    'سوهاج',
    'سوهاج الجديدة',
    'أخميم',
    'البلينا',
    'جرجا',
    'جهينة',
    'ساقلتة',
    'طما',
    'طهطا',
    'المراغة',
    'المنشاة',
    'دار السلام',
  ],
  قنا: ['قنا', 'نجع حمادي', 'دشنا', 'قوص', 'نقادة', 'قفط', 'أبو تشت', 'فرشوط', 'الوقف'],
  الأقصر: ['الأقصر', 'الأقصر الجديدة', 'إسنا', 'أرمنت', 'الطود', 'البياضية', 'الزينية', 'القرنة'],
  أسوان: ['أسوان', 'أسوان الجديدة', 'إدفو', 'كوم أمبو', 'دراو', 'نصر النوبة', 'أبو سمبل'],
  'البحر الأحمر': ['الغردقة', 'رأس غارب', 'سفاجا', 'القصير', 'مرسى علم', 'الشلاتين', 'حلايب'],
  'الوادي الجديد': ['الخارجة', 'الداخلة', 'الفرافرة', 'باريس', 'بلاط'],
  مطروح: [
    'مرسى مطروح',
    'العلمين',
    'الحمام',
    'الضبعة',
    'سيدي براني',
    'السلوم',
    'النجيلة',
    'واحة سيوة',
  ],
  'شمال سيناء': ['العريش', 'بئر العبد', 'الشيخ زويد', 'رفح', 'الحسنة', 'نخل'],
  'جنوب سيناء': [
    'الطور',
    'شرم الشيخ',
    'دهب',
    'نويبع',
    'طابا',
    'سانت كاترين',
    'رأس سدر',
    'أبو رديس',
    'أبو زنيمة',
  ],
}

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
  entitlement?: 'coupons' | 'analytics'
  quota?: 'landingPages' | 'salesLinks' | 'staff'
}

export const NAV_GROUPS: Record<'platform' | 'dashboard', NavGroup[]> = {
  platform: [
    {
      id: 'overview',
      label: 'نظرة عامة',
      icon: 'space_dashboard',
      items: [{ to: '/platform', label: 'لوحة المنصة', icon: 'space_dashboard' }],
    },
    {
      id: 'merchants',
      label: 'إدارة التجار',
      icon: 'storefront',
      items: [
        { to: '/platform/merchants', label: 'التجار', icon: 'storefront' },
        { to: '/platform/crm', label: 'CRM التجار', icon: 'support_agent' },
        { to: '/platform/customers', label: 'عملاء التجار', icon: 'groups' },
      ],
    },
    {
      id: 'operations',
      label: 'الطلبات والعمليات',
      icon: 'monitoring',
      items: [
        { to: '/platform/orders', label: 'الطلبات', icon: 'receipt_long' },
        { to: '/platform/shipping-companies', label: 'شركات الشحن', icon: 'local_shipping' },
      ],
    },
    {
      id: 'subscriptions',
      label: 'الاشتراكات والخطط',
      icon: 'workspace_premium',
      items: [
        { to: '/platform/subscriptions', label: 'الاشتراكات', icon: 'card_membership' },
        { to: '/platform/plans', label: 'الخطط والباقات', icon: 'workspace_premium' },
        { to: '/platform/promotions', label: 'العروض والإعلانات', icon: 'campaign' },
        { to: '/platform/payments', label: 'المدفوعات والمعاملات', icon: 'payments' },
        { to: '/platform/coupons', label: 'كوبونات الاشتراكات', icon: 'sell' },
      ],
    },
    {
      id: 'analytics',
      label: 'تحليلات المنصة',
      icon: 'bar_chart',
      items: [{ to: '/platform/reports', label: 'التقارير', icon: 'bar_chart' }],
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
      items: [{ to: '/platform/settings', label: 'إعدادات المنصة', icon: 'settings' }],
    },
  ],
  dashboard: [
    {
      id: 'home',
      label: 'الرئيسية',
      icon: 'space_dashboard',
      items: [{ to: '/dashboard', label: 'لوحة التحكم', icon: 'space_dashboard' }],
    },
    {
      id: 'store',
      label: 'المتجر',
      icon: 'store',
      items: [
        {
          to: '/dashboard/products',
          label: 'المنتجات',
          icon: 'inventory_2',
          permission: 'products:view',
        },
        {
          to: '/dashboard/categories',
          label: 'الفئات',
          icon: 'category',
          permission: 'products:view',
        },
        {
          to: '/dashboard/orders',
          label: 'الطلبات',
          icon: 'receipt_long',
          permission: 'orders:view',
        },
        {
          to: '/dashboard/customers',
          label: 'العملاء (CRM)',
          icon: 'groups',
          permission: 'customers:view',
        },
        {
          to: '/dashboard/crm',
          label: 'لوحة CRM',
          icon: 'query_stats',
          permission: 'crm:view',
        },
      ],
    },
    {
      id: 'marketing',
      label: 'التسويق والمبيعات',
      icon: 'campaign',
      items: [
        {
          to: '/dashboard/store-links',
          label: 'روابط البيع',
          icon: 'link',
          permission: 'sales_links:view',
          quota: 'salesLinks',
        },
        {
          to: '/dashboard/landing-pages',
          label: 'صفحات الهبوط',
          icon: 'web',
          permission: 'landing:manage',
          quota: 'landingPages',
        },
        {
          to: '/dashboard/coupons',
          label: 'الكوبونات',
          icon: 'sell',
          permission: 'coupons:manage',
          entitlement: 'coupons',
        },
      ],
    },
    {
      id: 'analytics',
      label: 'التحليلات',
      icon: 'bar_chart',
      items: [
        {
          to: '/dashboard/analytics',
          label: 'التحليلات والتقارير',
          icon: 'query_stats',
          permission: 'reports:view',
          entitlement: 'analytics',
        },
      ],
    },
    {
      id: 'manage',
      label: 'إدارة المتجر',
      icon: 'settings',
      items: [
        {
          to: '/dashboard/themes',
          label: 'المظهر والقالب',
          icon: 'palette',
          permission: 'settings:edit',
        },
        {
          to: '/dashboard/shipping',
          label: 'الشحن والتوصيل',
          icon: 'local_shipping',
          permission: 'settings:edit',
        },
        {
          to: '/dashboard/settings',
          label: 'إعدادات المتجر',
          icon: 'settings',
          permission: 'settings:edit',
        },
      ],
    },
    {
      id: 'team',
      label: 'الفريق',
      icon: 'group_add',
      items: [
        {
          to: '/dashboard/team',
          label: 'الفريق والأدوار',
          icon: 'group_add',
          permission: 'team:view',
          quota: 'staff',
        },
      ],
    },
    {
      id: 'account',
      label: 'الاشتراك والحساب',
      icon: 'card_membership',
      items: [
        {
          to: '/dashboard/subscription',
          label: 'الاشتراك والخطة',
          icon: 'card_membership',
          permission: 'settings:view',
        },
        {
          to: '/dashboard/notifications',
          label: 'الإشعارات',
          icon: 'notifications',
          permission: 'settings:view',
        },
        {
          to: '/dashboard/tickets',
          label: 'تذاكر الدعم',
          icon: 'support_agent',
          permission: 'settings:view',
        },
      ],
    },
  ],
}
