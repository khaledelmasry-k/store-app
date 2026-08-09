import { FunctionalComponent } from 'preact'
import { Icon } from '../../shared/components/ui/Icon'

interface Props {
  storeName?: string
  reason?: string
}

/**
 * Professional "subscription required" page shown to customers when a store is
 * not purchasable (expired / suspended / cancelled). Never exposes technical
 * errors or internal state — the merchant's data stays intact.
 */
export const StoreUnavailable: FunctionalComponent<Props> = ({ storeName, reason }) => {
  const title =
    reason === 'suspended'
      ? 'المتجر متوقف مؤقتاً'
      : 'المتجر غير متاح للشراء حالياً'
  const body =
    reason === 'suspended'
      ? 'نعتذر، هذا المتجر متوقف مؤقتاً. يرجى المحاولة لاحقاً.'
      : 'المتجر يقوم حالياً بترتيب اشتراكه. منتجات المتجر محفوظة وستتوفر قريباً.'

  return (
    <div className="store-coming-soon">
      <Icon name="storefront" className="store-brand-mark" />
      <h1>{storeName || 'المتجر'}</h1>
      <p className="store-unavailable-title">{title}</p>
      <p>{body}</p>
      <a href="/" className="btn btn-invert btn-lg">العودة للرئيسية</a>
    </div>
  )
}
