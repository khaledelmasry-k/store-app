interface Slice {
  label: string
  value: number
  color: string
}

interface Props {
  data: Slice[]
  size?: number
}

export function DonutChart({ data, size = 160 }: Props) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) {
    return (
      <div className="chart-empty">
        <span className="material-symbols-outlined">donut_small</span>
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
  return (
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
          />
        ))}
      </svg>
      <div className="donut-center">
        <strong>{total}</strong>
        <span>إجمالي</span>
      </div>
    </div>
  )
}
