interface Props {
  values: number[]
  labels?: string[]
  height?: number
  color?: string
  tones?: string[]
}

export function BarChart({ values, labels, height = 220, color = 'var(--primary)', tones }: Props) {
  if (values.length === 0) {
    return (
      <div className="chart-empty">
        <span className="material-symbols-outlined">bar_chart</span>
        <p>لا توجد بيانات</p>
      </div>
    )
  }
  const max = Math.max(...values, 1)
  const padTop = 22
  const padBottom = labels && labels.length ? 24 : 8
  const innerH = height - padTop - padBottom
  const n = values.length
  const barW = 100 / n

  return (
    <div className="chart-bars" style={{ height }}>
      <div className="chart-bars-layer">
        {[0, 0.25, 0.5, 0.75, 1].map((g) => (
          <span
            key={g}
            className={`chart-gridline${g === 0 ? ' chart-gridline-base' : ''}`}
            style={{ bottom: padBottom + g * innerH }}
          />
        ))}
        {values.map((v, i) => {
          const h = Math.max((v / max) * innerH, v > 0 ? 2 : 0)
          return (
            <span
              key={i}
              className="chart-bar"
              style={{
                height: h,
                bottom: padBottom,
                left: `${(i + 0.5) * barW}%`,
                width: `${Math.min(barW * 0.6, 40)}%`,
                background: tones?.[i] || color,
              }}
              title={labels?.[i] ? `${labels[i]}: ${v}` : String(v)}
            >
              {v > 0 && <span className="chart-bar-value">{v}</span>}
            </span>
          )
        })}
      </div>
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
