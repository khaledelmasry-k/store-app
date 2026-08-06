import { FunctionalComponent } from 'preact'
import { Button } from './Button'

interface PaginationProps {
  page: number
  totalPages: number
  total: number
  pageSize: number
  onPageChange: (page: number) => void
}

export const Pagination: FunctionalComponent<PaginationProps> = ({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
}) => {
  if (totalPages <= 1) return null

  const pages: number[] = []
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
      pages.push(i)
    } else if (pages[pages.length - 1] !== -1) {
      pages.push(-1)
    }
  }

  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)

  return (
    <div className="pagination">
      <div className="pagination-info">
        <span className="muted">{start}–{end} من {total}</span>
      </div>
      <div className="pagination-controls">
        <Button variant="outline" size="sm" icon="chevron_right" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>السابق</Button>
        {pages.map((p, i) => (
          p === -1 ? (
            <span key={`ellipsis-${i}`} className="pagination-ellipsis">…</span>
          ) : (
            <button
              key={p}
              type="button"
              className={`btn btn-sm ${p === page ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => onPageChange(p)}
            >
              {p}
            </button>
          )
        ))}
        <Button variant="outline" size="sm" icon="chevron_left" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>التالي</Button>
      </div>
    </div>
  )
}