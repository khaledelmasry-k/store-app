import { FunctionalComponent } from 'preact'
import { useState } from 'preact/hooks'
import { Button } from '../../shared/components/ui/Button'
import { Input } from '../../shared/components/ui/Input'
import { Textarea } from '../../shared/components/ui/Textarea'
import { Badge } from '../../shared/components/ui/Badge'
import { Icon } from '../../shared/components/ui/Icon'
import { formatDate, timeAgo } from '../../shared/utils/format'
import { FOLLOW_UP_STATUS_LABELS, FOLLOW_UP_STATUS_TONES } from '../../shared/utils/crm'
import type { CustomerFollowUp } from '../../shared/types'
import './CrmFollowUps.css'

interface Props {
  followUps: CustomerFollowUp[]
  loading?: boolean
  onCreate: (data: { dueAt: string; notes: string }) => Promise<void>
  onUpdateStatus: (id: string, status: string, result?: string) => Promise<void>
}

export const CrmFollowUps: FunctionalComponent<Props> = ({ followUps, loading, onCreate, onUpdateStatus }) => {
  const [dueAt, setDueAt] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [actionId, setActionId] = useState<string | null>(null)

  const handleCreate = async () => {
    if (!dueAt) return
    setSaving(true)
    try { await onCreate({ dueAt, notes }); setDueAt(''); setNotes('') } finally { setSaving(false) }
  }

  if (loading) return <div className="crm-followups-loading"><span className="spinner spinner-sm" /> جاري التحميل...</div>

  return (
    <div className="crm-followups">
      <div className="crm-followups-form">
        <h4>متابعة جديدة</h4>
        <div className="crm-followups-form-row">
          <Input type="datetime-local" label="تاريخ المتابعة" value={dueAt} onChange={setDueAt} />
        </div>
        <Textarea label="ملاحظات المتابعة" value={notes} onChange={setNotes} rows={2} placeholder="سبب المتابعة، ماذا يجب قوله..." />
        <Button size="sm" icon="calendar_today" loading={saving} disabled={!dueAt} onClick={handleCreate}>إضافة متابعة</Button>
      </div>

      <div className="crm-followups-list">
        {followUps.length === 0 ? (
          <p className="muted small" style={{ padding: 8 }}>لا توجد متابعات. أضف متابعة لتذكير الفريق بالتواصل.</p>
        ) : followUps.map((f) => {
          const isPending = f.status === 'pending' || f.status === 'overdue'
          const dueMs = f.dueAt?.seconds ? f.dueAt.seconds * 1000 : 0
          const isOverdue = dueMs && dueMs < Date.now() && isPending
          const displayStatus = isOverdue ? 'overdue' : f.status
          return (
            <div key={f.id} className={`crm-followup-row ${isOverdue ? 'is-overdue' : ''}`}>
              <div className="crm-followup-head">
                <span className="crm-followup-due">
                  <Icon name="schedule" ariaHidden /> {formatDate(f.dueAt)} <small>({timeAgo(f.dueAt)})</small>
                </span>
                <Badge tone={FOLLOW_UP_STATUS_TONES[displayStatus as keyof typeof FOLLOW_UP_STATUS_TONES] || 'slate'}>{FOLLOW_UP_STATUS_LABELS[displayStatus as keyof typeof FOLLOW_UP_STATUS_LABELS] || displayStatus}</Badge>
              </div>
              {f.notes && <p className="crm-followup-notes">{f.notes}</p>}
              {f.assignedToName && <span className="crm-followup-assignee">مسؤول: {f.assignedToName}</span>}
              {isPending && (
                <div className="crm-followup-actions">
                  <Button size="sm" variant="ghost" icon="check_circle" loading={actionId === f.id} onClick={async () => { setActionId(f.id); await onUpdateStatus(f.id, 'done'); setActionId(null) }}>تمت</Button>
                  <Button size="sm" variant="ghost" icon="cancel" loading={actionId === f.id} onClick={async () => { setActionId(f.id); await onUpdateStatus(f.id, 'cancelled'); setActionId(null) }}>إلغاء</Button>
                </div>
              )}
              {f.result && <p className="crm-followup-result">النتيجة: {f.result}</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
