import { FunctionalComponent } from 'preact'
import { useState } from 'preact/hooks'
import { Icon } from './Icon'
import productFallback from '../../../assets/brand/matjari-product-placeholder-v2.webp'

interface Props {
  src?: string
  alt?: string
  className?: string
  title?: string
  /** Filled fallback: show a neutral surface with an image icon. */
  placeholderClassName?: string
  loading?: 'lazy' | 'eager'
  decoding?: 'async' | 'sync' | 'auto'
  /** Branded visual used for commerce/product surfaces when no real photo exists. */
  fallback?: 'icon' | 'product'
  /** Called when the image fails to load (lets the parent swap to its own fallback). */
  onError?: () => void
}

/**
 * Image that never renders a broken-image icon. When `src` is missing, empty,
 * or fails to load, it swaps to a styled placeholder block.
 */
export const SmartImage: FunctionalComponent<Props> = ({
  src,
  alt = '',
  className = '',
  placeholderClassName = '',
  title,
  loading = 'lazy',
  decoding = 'async',
  fallback = 'icon',
  onError,
}) => {
  const [failed, setFailed] = useState(false)
  const usable = src && !failed

  if (!usable) {
    if (fallback === 'product') {
      return <img src={productFallback} alt={alt} title={title} className={className || placeholderClassName} loading={loading} decoding={decoding} />
    }
    return (
      <span
        className={`image-fallback ${placeholderClassName}`.trim()}
        role="img"
        aria-label={alt || 'صورة غير متوفرة'}
        title={title}
      >
        <Icon name="image" />
      </span>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      title={title}
      className={className}
      loading={loading}
      decoding={decoding}
      onError={() => {
        setFailed(true)
        onError?.()
      }}
    />
  )
}
