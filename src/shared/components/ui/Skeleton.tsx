import { FunctionalComponent } from 'preact'

interface Props {
  rows?: number
}

export const Skeleton: FunctionalComponent<Props> = ({ rows = 3 }) => (
  <div className="skeleton-wrap">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="skeleton" style={{ width: `${100 - i * 12}%` }} />
    ))}
  </div>
)
