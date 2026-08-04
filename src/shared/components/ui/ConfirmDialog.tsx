import { FunctionalComponent } from 'preact'
import { Modal } from './Modal'
import { Button } from './Button'

interface Props {
  open: boolean
  onCancel: () => void
  onConfirm: () => void
  title: string
  description?: string
  confirmLabel?: string
  loading?: boolean
  tone?: 'danger' | 'primary'
}

export const ConfirmDialog: FunctionalComponent<Props> = ({
  open,
  onCancel,
  onConfirm,
  title,
  description,
  confirmLabel = 'تأكيد',
  loading,
  tone = 'danger',
}) => (
  <Modal open={open} onClose={onCancel} title={title} size="sm">
    {description && <p className="confirm-desc">{description}</p>}
    <div className="confirm-actions">
      <Button variant="ghost" onClick={onCancel}>
        إلغاء
      </Button>
      <Button variant={tone} onClick={onConfirm} loading={loading}>
        {confirmLabel}
      </Button>
    </div>
  </Modal>
)
