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
  /** Card mode only: keys to always show collapsed (e.g. name + plan). The
   *  rest render only once the card is tapped open — a dense table with
   *  10+ columns crammed into every mobile card is unreadable otherwise. */
  cardSummaryKeys?: string[]
}

// A tap inside these should navigate/act, not toggle the card open/closed.
const isInteractiveTarget = (el: EventTarget | null) =>
  el instanceof Element && !!el.closest('a, button, input, select, textarea, label')

export function Table<T extends { id: string }>({
  columns,
  rows,
  loading,
  emptyMessage = 'لا توجد بيانات',
  onRowClick,
  cardMode = false,
  cardSummaryKeys,
}: Props<T>) {
  const [mobileCard, setMobileCard] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
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
          {rows.map((row) => {
            const isExpandable = !!cardSummaryKeys?.length
            const isExpanded = !isExpandable || expandedIds.has(row.id)
            const visibleColumns = isExpanded ? columns : columns.filter((c) => cardSummaryKeys!.includes(c.key))
            const toggle = () => setExpandedIds((prev) => {
              const next = new Set(prev)
              if (next.has(row.id)) next.delete(row.id); else next.add(row.id)
              return next
            })
            const handleClick = (e: MouseEvent) => {
              if (isInteractiveTarget(e.target)) return
              if (isExpandable) toggle()
              onRowClick?.(row)
            }
            return (
              <div
                key={row.id}
                className={clsx('card-table-card', isExpandable && 'card-table-card--expandable', isExpandable && isExpanded && 'is-expanded')}
                onClick={(onRowClick || isExpandable) ? handleClick : undefined}
              >
                {visibleColumns.map((c) => (
                  <div key={c.key} className="card-table-cell">
                    <span className="card-table-label">{c.header}</span>
                    <span className="card-table-value">{c.render ? c.render(row) : (row as unknown as Record<string, any>)[c.key]}</span>
                  </div>
                ))}
                {isExpandable && (
                  <button type="button" className="card-table-toggle" onClick={(e) => { e.stopPropagation(); toggle() }}>
                    <Icon name={isExpanded ? 'expand_less' : 'expand_more'} />
                    {isExpanded ? 'إخفاء التفاصيل' : 'عرض كل التفاصيل'}
                  </button>
                )}
              </div>
            )
          })}
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
