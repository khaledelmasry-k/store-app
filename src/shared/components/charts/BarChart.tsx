interface Props {
  values: number[]
  labels?: string[]
  height?: number
  color?: string
}

export function BarChart({ values, height = 220, color = 'var(--primary)' }: Props) {
  const max = Math.max(...values, 1)
  const width = 100
  const bw = 100 / Math.max(values.length, 1)
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="chart-svg">
      {values.map((v, i) => (
        <rect
          key={i}
          x={bw * i + bw * 0.18}
          y={height - (v / max) * (height - 24)}
          width={bw * 0.64}
          height={(v / max) * (height - 24)}
          rx={2}
          fill={color}
        />
      ))}
    </svg>
  )
}
