import { useId } from 'preact/hooks'
import { Icon } from '../ui/Icon'

interface Props {
  values: number[]
  labels?: string[]
  height?: number
  color?: string
}

export function LineChart({ values, height = 220, color = 'var(--primary)', labels }: Props) {
  const gradId = useId()
  if (values.length < 2) {
    return (
      <div className="chart-empty">
        <Icon name="show_chart" />
        <p>بيانات غير كافية</p>
      </div>
    )
  }
  const max = Math.max(...values, 1)
  const min = Math.min(...values)
  const range = max - min || 1
  const padTop = 26
  const padBottom = labels && labels.length ? 24 : 8
  const innerH = height - padTop - padBottom
  const w = values.length - 1

  const points = values.map((v, i) => {
    const x = (i / w) * 100
    const y = padTop + innerH - ((v - min) / range) * innerH
    return [x, y] as const
  })
  const path = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`).join(' ')
  const area = `${path} L 100 ${height} L 0 ${height} Z`
  const last = points[points.length - 1]

  return (
    <div className="chart-line" style={{ height }}>
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="chart-svg">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((g) => (
          <line
            key={g}
            x1="0"
            x2="100"
            y1={padTop + innerH - g * innerH}
            y2={padTop + innerH - g * innerH}
            stroke="var(--border)"
            strokeWidth="0.4"
            strokeDasharray={g === 0 ? undefined : '2 3'}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <path d={area} fill={`url(#${gradId})`} />
        <path d={path} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
        {points.map(([x, y], i) => (
          <g key={i}>
            <title>{labels?.[i] ? `${labels[i]} — ${values[i]}` : values[i]}</title>
            <circle cx={x} cy={y} r="6" fill="transparent" />
          </g>
        ))}
      </svg>
      <span className="chart-last-dot" style={{ left: `${last[0]}%`, top: last[1], background: color }} />
      <span className="chart-last-value" style={{ left: `${last[0]}%`, top: last[1], background: color }}>
        {values[values.length - 1]}
      </span>
      {labels && labels.length > 0 && (
        <div className="chart-labels-row">
          {labels.map((l, i) => (
            <span key={i}>{l}</span>
          ))}
        </div>
      )}
    </div>
  )
}
