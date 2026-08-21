import { FunctionalComponent } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { Link } from 'wouter'
import { useStore } from '../../shared/hooks/useStore'
import { useCollection } from '../../shared/hooks/useCollection'
import { STORE_TEMPLATES, getTemplate } from '../../shared/utils/themes'
import { StoreProductCard } from '../components/StoreProductCard'
import { SmartImage } from '../../shared/components/ui/SmartImage'
import { Icon } from '../../shared/components/ui/Icon'
import type { Product, Category } from '../../shared/types'
import './Home.css'

const TRUST_BADGES = [
  { icon: 'payments', label: 'الدفع عند الاستلام' },
  { icon: 'location_on', label: 'تتبع الطلب' },
  { icon: 'local_shipping', label: 'معلومات الشحن' },
  { icon: 'support_agent', label: 'دعم المتجر' },
] as const

/**
 * Storefront home — structurally rebuilt from the real Stitch home
 * source (desktop: "Premium Consumer Storefront Home"
 * 56916061f03346f78802151c20218370 · mobile: "Refined Mobile
 * Storefront Experience" 46368a57a55d4c4d95b73c89b5dd8680).
 * Section order per Stitch: Hero → Trust band → Category strip →
 * Template personalities (desktop) → Featured products.
 */
export const StoreHome: FunctionalComponent = () => {
  const { store } = useStore()
  const [heroFailed, setHeroFailed] = useState(false)
  useEffect(() => setHeroFailed(false), [store?.id, store?.heroImage])
  const productsRes = useCollection<Product>('products', { storeId: store?.id || '', where: { active: { value: true } } })
  const products = productsRes.data
  const categoriesRes = useCollection<Category>('categories', { storeId: store?.id || '' })
  const categories = categoriesRes.data

  const featured = products.filter((p) => p.featured).slice(0, 4)
  const hasHeroImage = Boolean(store?.heroImage) && !heroFailed
  const categoryNameOf = (id?: string) => categories.find((c) => c.id === id)?.name
  const base = `/store/${store?.slug}`
  const currentTemplate = getTemplate(store?.theme?.template)

  return (
    <div className="storefront-home">
      {/* Hero — Stitch: 600px rounded-3xl scrim card, content start-aligned. */}
      <section className="sf-hero" aria-labelledby="hero-title">
        {hasHeroImage ? (
          <SmartImage
            key={store.heroImage}
            src={store.heroImage}
            alt=""
            className="sf-hero-bg"
            placeholderClassName="sf-hero-bg"
            loading="eager"
            onError={() => setHeroFailed(true)}
          />
        ) : (
          <div className="sf-hero-bg sf-hero-bg--fallback" aria-hidden="true" />
        )}
        <div className="sf-hero-overlay" aria-hidden="true" />
        <div className="sf-hero-content">
          <span className="sf-hero-eyebrow">مجموعة الموسم الجديد</span>
          <h1 id="hero-title" className="sf-hero-title">
            أناقة تعبر عنك
            <br />
            بكل تفاصيلها
          </h1>
          <p className="sf-hero-subtitle">
            اكتشف تشكيلتنا الجديدة المصممة بعناية لتمنحك الإطلالة التي تستحقها. جودة عالية وتصاميم عصرية تناسب كل الأوقات.
          </p>
          {products.length > 0 && (
            <Link href={`${base}/catalog`} className="sf-hero-cta">
              تسوق الآن
              <Icon name="arrow_back" ariaHidden />
            </Link>
          )}
        </div>
      </section>

      {/* Trust band — Stitch: 4-col card grid on desktop, scroll pills on mobile. */}
      <section className="sf-trust" aria-label="مزايا المتجر">
        <div className="sf-trust-grid">
          {TRUST_BADGES.map((badge) => (
            <div key={badge.icon} className="sf-trust-item">
              <Icon name={badge.icon} className="sf-trust-icon" ariaHidden />
              <span className="sf-trust-label">{badge.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Category strip — Stitch: circular snap-scroll items on desktop, chips on mobile. */}
      {categories.length > 0 && (
        <section className="sf-categories" aria-labelledby="categories-title">
          <h2 id="categories-title" className="sf-section-title">تسوق حسب الفئة</h2>
          <div className="sf-cat-strip">
            {categories.slice(0, 8).map((c) => (
              <Link key={c.id} href={`${base}/catalog?cat=${c.id}`} className="sf-cat-item">
                <span className="sf-cat-circle">
                  <Icon name="inventory_2" className="sf-cat-icon" ariaHidden />
                </span>
                <span className="sf-cat-name">{c.name}</span>
              </Link>
            ))}
          </div>
          <div className="sf-cat-chips">
            {categories.slice(0, 8).map((c) => (
              <Link key={c.id} href={`${base}/catalog?cat=${c.id}`} className="sf-cat-chip">
                {c.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Template personalities — Stitch desktop strip (hidden on mobile per mobile source). */}
      <section className="sf-templates" aria-labelledby="templates-title">
        <h2 id="templates-title" className="sf-section-title">أنماط قوالب المتجر</h2>
        <div className="sf-template-grid">
          {STORE_TEMPLATES.map((t) => (
            <div
              key={t.id}
              className={`sf-template-tile${t.id === currentTemplate.id ? ' sf-template-tile--current' : ''}`}
              style={{
                background: `linear-gradient(135deg, ${t.defaultPrimary}, color-mix(in srgb, ${t.defaultSecondary} 70%, ${t.defaultPrimary} 30%))`,
              }}
            >
              <div className="sf-template-tile-overlay" aria-hidden="true" />
              <span className="sf-template-name">{t.name}</span>
              <span className="sf-template-eyebrow">{t.eyebrow}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Featured products — Stitch: 4-col grid, "عرض الكل" link, dashed empty state. */}
      <section className="sf-featured" aria-labelledby="featured-title">
        <div className="sf-section-head">
          <div className="sf-section-head-text">
            <h2 id="featured-title" className="sf-featured-title">المنتجات المميزة</h2>
            <p className="sf-featured-subtitle">أفضل اختياراتنا لك هذا الأسبوع</p>
          </div>
          {products.length > 0 && (
            <Link href={`${base}/catalog`} className="sf-viewall">
              عرض الكل
              <Icon name="arrow_back" ariaHidden />
            </Link>
          )}
        </div>
        {featured.length > 0 ? (
          <div className="sf-featured-grid">
            {featured.map((p) => (
              <StoreProductCard key={p.id} product={p} categoryName={categoryNameOf(p.categoryId)} />
            ))}
          </div>
        ) : (
          <div className="sf-featured-empty">
            <Icon name="inventory_2" className="sf-empty-icon" ariaHidden />
            <h3>لا توجد منتجات حالياً</h3>
            <p>سيتم إضافة منتجات جديدة قريباً، يرجى التحقق مرة أخرى لاحقاً.</p>
          </div>
        )}
      </section>
    </div>
  )
}
export default StoreHome