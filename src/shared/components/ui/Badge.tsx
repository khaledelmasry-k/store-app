import { FunctionalComponent } from 'preact'
import { clsx } from '../../utils/clsx'

interface Props {
  tone?: string
  children?: any
}

export const Badge: FunctionalComponent<Props> = ({ tone = 'slate', children }) => (
  <span className={clsx('badge', `badge-${tone}`)}>{children}</span>
)
