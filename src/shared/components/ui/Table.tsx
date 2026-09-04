import { clsx } from '../../utils/clsx'
import { EmptyState } from './EmptyState'
import { Loading } from './Loading'
import { useEffect, useState } from 'preact/hooks'
import { Icon } from './Icon'

interface Column<T> {
  key: string
  header: string
  render?: (row: T) => any
  className?: string
  responsive?: boolean
}

interface Props<T> {
  columns: Column<T>[]
  rows: T[]
  loading?: boolean
  emptyMessage?: string
  onRowClick?: (row: T) => void
  cardMode?: boolean
}

export function Table<T extends { id: string }>({
  columns,
  rows,
  loading,
  emptyMessage = 'لا توجد بيانات',
  onRowClick,
  cardMode = false,
}: Props<T>) {
  const [mobileCard, setMobileCard] = useState(false)
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768)

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // On small screens every table renders as cards to avoid horizontal page overflow.
  const showCards = isMobile ? true : mobileCard

  return (
    <div className="table-wrap">
      {cardMode && !isMobile && (
        <div className="table-toolbar">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMobileCard(!mobileCard)}>
            <Icon name={mobileCard ? 'table_chart' : 'grid_view'} />
            {mobileCard ? 'جدول' : 'بطاقات'}
          </button>
        </div>
      )}
      {loading ? (
        <Loading variant="table" />
      ) : rows.length === 0 ? (
        <EmptyState icon="table_chart" title={emptyMessage} variant="list" />
      ) : showCards ? (
        <div className="card-grid">
          {rows.map((row) => (
            <div key={row.id} className="card-table-card" onClick={onRowClick ? () => onRowClick(row) : undefined}>
              {columns.map((c) => (
                <div key={c.key} className="card-table-cell">
                  <span className="card-table-label">{c.header}</span>
                  <span className="card-table-value">{c.render ? c.render(row) : (row as unknown as Record<string, any>)[c.key]}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={c.className}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} onClick={onRowClick ? () => onRowClick(row) : undefined} className={clsx(onRowClick && 'row-clickable')}>
                {columns.map((c) => (
                  <td key={c.key} className={c.className}>
                    {c.render ? c.render(row) : (row as unknown as Record<string, any>)[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
