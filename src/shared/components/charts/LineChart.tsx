interface Props {
  values: number[]
  labels?: string[]
  height?: number
  color?: string
}

export function LineChart({ values, height = 220, color = 'var(--primary)' }: Props) {
  if (values.length < 2) {
    return (
      <div className="chart-empty">
        <span className="material-symbols-outlined">show_chart</span>
        <p>بيانات غير كافية</p>
      </div>
    )
  }
  const max = Math.max(...values, 1)
  const min = Math.min(...values)
  const range = max - min || 1
  const w = values.length - 1
  const points = values.map((v, i) => {
    const x = (i / w) * 100
    const y = height - 16 - ((v - min) / range) * (height - 32)
    return [x, y] as const
  })
  const path = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const area = `${path} L 100 ${height} L 0 ${height} Z`
  const gradId = 'lcgrad'

  return (
    <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="chart-svg">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      {points.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="1.6" fill={color} />
      ))}
    </svg>
  )
}
