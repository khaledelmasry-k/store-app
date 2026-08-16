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
}

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
  },
]

export function getTemplate(id?: string): StoreTemplate {
  return STORE_TEMPLATES.find((t) => t.id === id) || STORE_TEMPLATES[0]
}
