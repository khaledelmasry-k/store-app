import { FunctionalComponent } from 'preact'
import { getTemplate, type StoreTemplate } from '../../shared/utils/themes'

interface Props { template: StoreTemplate | string; primary: string; secondary: string; storeName?: string; description?: string; mobile?: boolean; mini?: boolean }

/** Presentational storefront composition used by the merchant studio previews.
 * It follows the same composition registry as the live storefront while using
 * inert demo content (no reads or writes). */
export const ThemePreviewStorefront: FunctionalComponent<Props> = ({ template, primary, secondary, storeName = 'متجري', description = 'منتجات مختارة وتجربة شراء سهلة.', mobile, mini }) => {
  const tpl = typeof template === 'string' ? getTemplate(template) : template
  const l = tpl.layout
  return <div className={`theme-preview-frame ${mini ? 'tp-mini' : ''} ${mobile ? 'is-mobile' : ''} ${tpl.cssClass} tp-layout-${l.header}`} style={{ '--tp-primary': primary, '--tp-secondary': secondary } as any}>
    <div className={`tp-bar tp-bar--${l.header}`}><span className="tp-logo" /><span className="tp-name">{storeName}</span><span className="tp-nav"><i /><i /><i /></span><span className="tp-icons"><i className="tp-search" /><i className="tp-cart" /></span></div>
    <div className={`tp-hero tp-hero--${l.hero}`}><b>{l.hero === 'compact-promo' ? 'خصم لفترة محدودة' : storeName}</b><i>{description}</i><em>تسوق الآن</em></div>
    <div className={`tp-categories tp-categories--${l.categories}`}><i /><i /><i /><i /></div>
    <div className={`tp-grid tp-grid--${l.productGrid} tp-cards--${l.productCard}`}><span className="tp-card" /><span className="tp-card" /><span className="tp-card" /><span className="tp-card" /></div>
    {!mini && <><div className={`tp-promo tp-promo--${l.footer}`}><b>اختيارات مميزة لك</b><i>اكتشف المجموعة الجديدة</i></div><div className={`tp-footer tp-footer--${l.footer}`}><span /><span /><span /></div></>}
  </div>
}
