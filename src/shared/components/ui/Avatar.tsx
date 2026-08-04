import { FunctionalComponent } from 'preact'
import { initials } from '../../utils/format'

interface Props {
  name: string
  size?: 'sm' | 'md' | 'lg'
  src?: string
}

export const Avatar: FunctionalComponent<Props> = ({ name, size = 'md', src }) =>
  src ? (
    <img className={`avatar avatar-${size}`} src={src} alt={name} />
  ) : (
    <div className={`avatar avatar-${size} avatar-fallback`}>{initials(name)}</div>
  )
