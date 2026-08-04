import { FunctionalComponent } from 'preact'
import { clsx } from '../../utils/clsx'

interface Props {
  value: number
  max: number
  tone?: 'primary' | 'green' | 'amber' | 'red'
}

export const Progress: FunctionalComponent<Props> = ({ value, max, tone = 'primary' }) => {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className="progress">
      <div className={clsx('progress-bar', `progress-${tone}`)} style={{ width: `${pct}%` }} />
    </div>
  )
}
