import type { JSX } from 'preact'
import { getIcon, isValidIcon } from '../../utils/icons'

interface IconProps {
  name: string
  className?: string
  ariaHidden?: boolean
  style?: JSX.CSSProperties
  title?: string
}

/**
 * Single icon-rendering primitive for M&K. All icons go through this component
 * so an invalid/unknown name can never leak as raw text into the UI — it falls
 * back to a safe Lucide icon instead.
 *
 * The SVG is sized at 1em so it inherits the surrounding `font-size` tokens used
 * by the design system, and strokes with `currentColor`.
 */
export function Icon({ name, className = '', ariaHidden, style, title }: IconProps) {
  const Comp = getIcon(name)
  if (import.meta.env.DEV && !isValidIcon(name)) {
    console.warn(`[Icon] unknown icon name "${name}" — rendering fallback`)
  }
  const labelled = Boolean(title)
  return (
    <span className={`mk-icon ${className}`.trim()} style={style} title={labelled ? title : undefined}>
      <Comp
        size="1em"
        strokeWidth={2}
        aria-hidden={labelled ? undefined : (ariaHidden ?? true)}
        role={labelled ? 'img' : undefined}
        aria-label={labelled ? title : undefined}
      />
    </span>
  )
}
