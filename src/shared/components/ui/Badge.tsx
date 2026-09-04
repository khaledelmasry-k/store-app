import { FunctionalComponent } from 'preact'
import { clsx } from '../../utils/clsx'

interface Props {
  tone?: string
  className?: string
  children?: any
}

export const Badge: FunctionalComponent<Props> = ({ tone = 'slate', className, children }) => (
  <span className={clsx('badge', `badge-${tone}`, className)}>{children}</span>
)