// Storefront theme templates. Templates are real, code-defined design presets
// persisted on the store document (`store.theme.template`). The storefront
// renders the template via a `theme-*` class + the store's saved color tokens.
export interface StoreTemplate {
  id: string
  name: string
  description: string
  /** Accent used when the merchant has not picked a color yet. */
  defaultPrimary: string
  defaultSecondary: string
  darkMode: boolean
  /** Class applied to the storefront shell (theme-<id>). */
  cssClass: string
  /** Eyebrow label shown on the theme gallery card. */
  eyebrow: string
  /** Canonical V2 themes are shown first in the selector. */
  canonical?: boolean
  /** Legacy presets remain available for existing stores. */
  legacy?: boolean
  /** Structural composition slots. Data and commerce actions remain shared. */
  layout: { header: string; hero: string; categories: string; productGrid: string; productCard: string; homeSections: string; footer: string; productPage: string }
}

const layouts = {
  minimal: { header: 'minimal', hero: 'editorial', categories: 'tiles', productGrid: 'four', productCard: 'minimal', homeSections: 'featured-categories-products', footer: 'minimal', productPage: 'gallery-first' },
  bold: { header: 'bold', hero: 'campaign', categories: 'visual', productGrid: 'three', productCard: 'bold', homeSections: 'promo-hero-offers-products', footer: 'contrast', productPage: 'offer-first' },
  elegant: { header: 'elegant', hero: 'split-editorial', categories: 'editorial', productGrid: 'three', productCard: 'elegant', homeSections: 'hero-collections-products', footer: 'editorial', productPage: 'editorial-detail' },
  market: { header: 'market', hero: 'compact-promo', categories: 'dense', productGrid: 'five', productCard: 'market', homeSections: 'categories-promos-products', footer: 'directory', productPage: 'dense-info' },
  showcase: { header: 'showcase', hero: 'immersive', categories: 'collections', productGrid: 'two', productCard: 'showcase', homeSections: 'hero-story-featured-products', footer: 'visual', productPage: 'immersive-gallery' },
} as const
const legacyLayout = layouts.minimal

export const STORE_TEMPLATES: StoreTemplate[] = [
  {
    id: 'modern',
    name: 'مودرن',
    description: 'تصميم عصري بألوان هادئة ومساحات مريحة — مثالي لمعظم المتاجر.',
    defaultPrimary: '#0b766e',
    defaultSecondary: '#c78a25',
    darkMode: false,
    cssClass: 'theme-modern',
    eyebrow: 'عام',
    legacy: true, layout: legacyLayout,
  },
  {
    id: 'minimal',
    name: 'مينيمال',
    description: 'أسلوب بسيط وأنيق يركز على المنتج مع ألوان محايدة ومساحات واسعة.',
    defaultPrimary: '#0f172a',
    defaultSecondary: '#64748b',
    darkMode: false,
    cssClass: 'theme-minimal',
    eyebrow: 'بسيط',
    canonical: true, layout: layouts.minimal,
  },
  {
    id: 'fashion',
    name: 'أزياء',
    description: 'لمسة راقية بزوايا ناعمة وخطوط أنيقة تناسب الملابس والإكسسوارات.',
    defaultPrimary: '#db2777',
    defaultSecondary: '#0d0d0d',
    darkMode: false,
    cssClass: 'theme-fashion',
    eyebrow: 'موضة',
    legacy: true, layout: layouts.showcase,
  },
  {
    id: 'electronics',
    name: 'إلكترونيات',
    description: 'مظهر تقني حديث بزوايا حادة وتدرجات جريئة للمنتجات الإلكترونية.',
    defaultPrimary: '#075985',
    defaultSecondary: '#0f766e',
    darkMode: true,
    cssClass: 'theme-electronics',
    eyebrow: 'تقني',
    legacy: true, layout: layouts.bold,
  },
  {
    id: 'beauty',
    name: 'جمال',
    description: 'أجواء ناعمة بألوان هادئة وخطوط دائرية تناسب منتجات العناية والجمال.',
    defaultPrimary: '#ec4899',
    defaultSecondary: '#a78bfa',
    darkMode: false,
    cssClass: 'theme-beauty',
    eyebrow: 'عناية',
    legacy: true, layout: layouts.elegant,
  },
  {
    id: 'general',
    name: 'متجر عام',
    description: 'تصميم متعدد الاستخدامات يناسب مجموعة واسعة من المنتجات والبضائع.',
    defaultPrimary: '#16a34a',
    defaultSecondary: '#f59e0b',
    darkMode: false,
    cssClass: 'theme-general',
    eyebrow: 'عام',
    legacy: true, layout: layouts.market,
  },
  {
    id: 'bold',
    name: 'Bold',
    description: 'تجربة تجارية جريئة بصورة أكبر، عروض بارزة وأزرار قوية لتحويل أسرع.',
    defaultPrimary: '#4f46e5',
    defaultSecondary: '#f97316',
    darkMode: false,
    cssClass: 'theme-bold',
    eyebrow: 'جريء',
    canonical: true, layout: layouts.bold,
  },
  {
    id: 'elegant',
    name: 'Elegant',
    description: 'تخطيط تحريري ناعم ببطاقات راقية ومساحات محسوبة للعلامات الفاخرة.',
    defaultPrimary: '#7c3aed',
    defaultSecondary: '#f5e9d8',
    darkMode: false,
    cssClass: 'theme-elegant',
    eyebrow: 'فاخر',
    canonical: true, layout: layouts.elegant,
  },
  {
    id: 'market',
    name: 'Market',
    description: 'واجهة عملية كثيفة تضع الفئات والأسعار والمنتجات في المقدمة.',
    defaultPrimary: '#15803d',
    defaultSecondary: '#facc15',
    darkMode: false,
    cssClass: 'theme-market',
    eyebrow: 'عملي',
    canonical: true, layout: layouts.market,
  },
  {
    id: 'showcase',
    name: 'Showcase',
    description: 'تجربة مرئية تقودها الحملات والصور الكبيرة والمجموعات المميزة.',
    defaultPrimary: '#be123c',
    defaultSecondary: '#fde68a',
    darkMode: false,
    cssClass: 'theme-showcase',
    eyebrow: 'استعراضي',
    canonical: true, layout: layouts.showcase,
  },
]

/** Semantic V2 equivalents for legacy presets; IDs are intentionally not rewritten. */
export const LEGACY_THEME_MAPPING: Record<string, string> = {
  electronics: 'bold',
  beauty: 'elegant',
  general: 'market',
  fashion: 'showcase',
  modern: 'minimal',
}

export function getTemplate(id?: string): StoreTemplate {
  return STORE_TEMPLATES.find((t) => t.id === id) || STORE_TEMPLATES[0]
}
