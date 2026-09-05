import { FunctionalComponent } from 'preact'
import { Skeleton } from './Skeleton'

interface Props {
  variant?: 'screen' | 'inline' | 'card' | 'table'
  message?: string
}

export const Loading: FunctionalComponent<Props> = ({ variant = 'screen', message }) => {
  const visibleMessage = message || (variant === 'screen' ? 'جارٍ تحميل البيانات...' : undefined)
  if (variant === 'screen') {
    return (
      <div className="loading-screen">
        <span className="spinner spinner-lg" />
        {visibleMessage && <p className="loading-message">{visibleMessage}</p>}
      </div>
    )
  }
  if (variant === 'table') {
    return (
      <div className="table-wrap">
        <table className="table">
          <tbody>
            <tr><td colSpan={99}><Skeleton rows={4} /></td></tr>
          </tbody>
        </table>
      </div>
    )
  }
  if (variant === 'card') {
    return (
      <div className="loading-card">
        <Skeleton rows={3} />
      </div>
    )
  }
  return (
    <div className="loading-inline">
      <span className="spinner spinner-sm" />
      {visibleMessage && <span className="loading-message">{visibleMessage}</span>}
    </div>
  )
}
