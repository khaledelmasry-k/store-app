import { FunctionalComponent } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import type { Store } from '../../types'
import { Icon } from '../ui/Icon'
import { SmartImage } from '../ui/SmartImage'
import { presetFromLogo, storeLogoKind } from '../../utils/store-brand'

type BrandVariant = 'header' | 'footer' | 'landing'

const LOGO_CLASS: Record<BrandVariant, string> = {
  header: 'store-logo',
  footer: 'store-footer-logo',
  landing: 'store-logo lp-store-logo',
}

interface Props {
  store: Pick<Store, 'id' | 'name' | 'logo'> | null
  variant?: BrandVariant
}

/**
 * The single place that renders a MERCHANT store's branding (never the M&K
 * platform mark). Rules, applied on every surface (header, footer, landing):
 *   - a valid store logo (uploaded image or preset)  → render the logo ONLY,
 *     the store name is NOT duplicated beside it
 *   - no logo, or the image fails to load             → fall back to the store
 *     name as text
 */
export const MerchantLogo: FunctionalComponent<Props> = ({ store, variant = 'header' }) => {
  const [failed, setFailed] = useState(false)
  const logo = store?.logo
  const kind = storeLogoKind(logo)

  useEffect(() => {
    setFailed(false)
  }, [store?.id, logo])

  const logoClass = LOGO_CLASS[variant]

  // No logo, or the uploaded image failed to load → store-name fallback.
  if (!logo || kind === 'none' || (kind === 'image' && failed)) {
    return <strong className="store-brand-name">{store?.name || 'المتجر'}</strong>
  }

  // A platform-provided preset logo — rendered as an inline mark (persisted key).
  if (kind === 'preset') {
    const preset = presetFromLogo(logo)
    if (preset) {
      return (
        <span className={`${logoClass} store-logo--preset`} role="img" aria-label={store?.name || ''} title={store?.name}>
          <Icon name={preset.icon} />
        </span>
      )
    }
    return <strong className="store-brand-name">{store?.name || 'المتجر'}</strong>
  }

  // An uploaded Firebase Storage image URL.
  return (
    <SmartImage
      key={logo}
      src={logo}
      alt={store?.name || ''}
      className={logoClass}
      placeholderClassName={logoClass}
      onError={() => setFailed(true)}
    />
  )
}

export default MerchantLogo