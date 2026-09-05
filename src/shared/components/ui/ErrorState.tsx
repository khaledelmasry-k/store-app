import { FunctionalComponent } from 'preact'
import { Button } from './Button'
import { Icon } from './Icon'

interface Props {
  title?: string
  description?: string
  onRetry?: () => void
}

export const ErrorState: FunctionalComponent<Props> = ({
  title = 'تعذر تحميل المحتوى',
  description = 'حدث خطأ مؤقت. حاول مرة أخرى.',
  onRetry,
}) => (
  <div className="error-state" role="alert">
    <div className="error-state-icon"><Icon name="error" ariaHidden /></div>
    <h2>{title}</h2>
    <p>{description}</p>
    {onRetry && <Button variant="outline" icon="refresh" onClick={onRetry}>إعادة المحاولة</Button>}
  </div>
)
