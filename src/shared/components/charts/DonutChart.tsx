import { Icon } from '../ui/Icon'
interface Slice {
  label: string
  value: number
  color: string
}

interface Props {
  data: Slice[]
  size?: number
  showLegend?: boolean
}

export function DonutChart({ data, size = 160, showLegend = true }: Props) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) {
    return (
      <div className="chart-empty">
        <Icon name="donut_small" />
        <p>لا توجد بيانات</p>
      </div>
    )
  }
  const r = 15.915
  let offset = 0
  const segments = data.map((d) => {
    const frac = d.value / total
    const seg = {
      ...d,
      strokeDasharray: `${frac * 100} ${100 - frac * 100}`,
      strokeDashoffset: offset,
    }
    offset -= frac * 100
    return seg
  })

  const donut = (
    <div className="donut-wrap">
      <svg viewBox="0 0 42 42" width={size} height={size}>
        <circle cx="21" cy="21" r={r} fill="none" stroke="var(--border)" strokeWidth="4" />
        {segments.map((s, i) => (
          <circle
            key={i}
            cx="21"
            cy="21"
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth="4"
            strokeDasharray={s.strokeDasharray}
            strokeDashoffset={s.strokeDashoffset}
            strokeLinecap="round"
          >
            <title>{`${s.label} — ${s.value}`}</title>
          </circle>
        ))}
      </svg>
      <div className="donut-center">
        <strong>{total}</strong>
        <span>إجمالي</span>
      </div>
    </div>
  )

  if (!showLegend) return donut

  return (
    <div className="donut-layout">
      {donut}
      <div className="donut-legend">
        {data.map((d) => (
          <div key={d.label} className="donut-legend-item">
            <span className="donut-dot" style={{ background: d.color }} />
            <span>{d.label}</span>
            <strong>{d.value}{d.value > 0 && total > 0 ? ` (${Math.round((d.value / total) * 100)}٪)` : ''}</strong>
          </div>
        ))}
      </div>
    </div>
  )
}
