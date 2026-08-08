import { FunctionalComponent } from 'preact'
import { formatCurrency } from '../../utils/format'
import { Icon } from './Icon'

interface Props {
  title: string
  value: number | string
  currency?: boolean
  change?: number
  changeLabel?: string
  icon: string
  tone?: string
}

export const StatsCard: FunctionalComponent<Props> = ({
  title,
  value,
  currency = false,
  change,
  changeLabel,
  icon,
  tone = 'primary',
}) => (
  <div className={`stat-card stat-${tone}`}>
    <div className="stat-icon">
      <Icon name={icon} />
    </div>
    <div className="stat-body">
      <p className="stat-title">{title}</p>
      <p className="stat-value">{currency ? formatCurrency(Number(value)) : value}</p>
      {(change !== undefined || changeLabel) && (
        <p className="stat-change">
          {change !== undefined && (
            <span className={change >= 0 ? 'text-green' : 'text-red'}>
              {change >= 0 ? '▲' : '▼'} {Math.abs(change)}%
            </span>
          )}
          {changeLabel && <span className="stat-change-label">{changeLabel}</span>}
        </p>
      )}
    </div>
  </div>
)
