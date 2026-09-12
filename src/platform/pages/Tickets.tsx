import { FunctionalComponent } from 'preact'
import { useState } from 'preact/hooks'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { Table } from '../../shared/components/ui/Table'
import { Badge } from '../../shared/components/ui/Badge'
import { Button } from '../../shared/components/ui/Button'
import { Modal } from '../../shared/components/ui/Modal'
import { Textarea } from '../../shared/components/ui/Textarea'
import { Input } from '../../shared/components/ui/Input'
import { Select } from '../../shared/components/ui/Select'
import { FilterBar } from '../../shared/components/ui/FilterBar'
import { useCollection } from '../../shared/hooks/useCollection'
import { useToast } from '../../shared/hooks/useToast'
import { formatDateTime, timeAgo } from '../../shared/utils/format'
import { TICKET_STATUS_TONES, TICKET_PRIORITY_TONES } from '../../shared/utils/constants'
import type { Ticket } from '../../shared/types'
import './Tickets.css'

const STATUS_OPTIONS = [
  { value: '', label: 'كل الحالات' },
  { value: 'open', label: 'مفتوحة' },
  { value: 'in_progress', label: 'قيد المعالجة' },
  { value: 'waiting_merchant', label: 'بانتظار التاجر' },
  { value: 'waiting_support', label: 'بانتظار الدعم' },
  { value: 'closed', label: 'مغلقة' },
]

export const PlatformTickets: FunctionalComponent = () => {
  const ticketsRes = useCollection<Ticket>('tickets', { orderBy: { field: 'updatedAt', dir: 'desc' } });
  const tickets = ticketsRes.data
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [reply, setReply] = useState('')
  const [selected, setSelected] = useState<Ticket | null>(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [assignTo, setAssignTo] = useState('')

  const filtered = tickets.filter((t) => {
    if (query && !`${t.subject} ${t.description} ${t.storeId}`.toLowerCase().includes(query.toLowerCase())) return false
    if (statusFilter && t.status !== statusFilter) return false
    if (priorityFilter && t.priority !== priorityFilter) return false
    return true
  })

  const handleReply = async () => {
    if (!selected || !reply.trim()) return
    try {
      const { replyTicket } = await import('../../shared/services/tickets')
      await replyTicket(selected.id, reply.trim())
      toast.push('تم إرسال الرد')
      setReply('')
      setOpen(false)
    } catch (e: any) {
      toast.push('تعذر الإرسال', e?.message, 'error')
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    if (!selected) return
    try {
      const { updateTicketStatus } = await import('../../shared/services/tickets')
      await updateTicketStatus(selected.id, newStatus)
      toast.push('تم تحديث الحالة')
      setOpen(false)
    } catch (e: any) {
      toast.push('تعذر التحديث', e?.message, 'error')
    }
  }

  const handleAssign = async () => {
    if (!selected) return
    try {
      const { assignTicket } = await import('../../shared/services/tickets')
      await assignTicket(selected.id, assignTo || null)
      toast.push('تم التعيين')
      setOpen(false)
    } catch (e: any) {
      toast.push('تعذر التعيين', e?.message, 'error')
    }
  }

  const handleClose = async () => {
    if (!selected) return
    try {
      const { closeTicket } = await import('../../shared/services/tickets')
      await closeTicket(selected.id)
      toast.push('تم الإغلاق')
      setOpen(false)
    } catch (e: any) {
      toast.push('تعذر الإغلاق', e?.message, 'error')
    }
  }

  const handleReopen = async () => {
    if (!selected) return
    try {
      const { reopenTicket } = await import('../../shared/services/tickets')
      await reopenTicket(selected.id)
      toast.push('تم إعادة الفتح')
      setOpen(false)
    } catch (e: any) {
      toast.push('تعذر إعادة الفتح', e?.message, 'error')
    }
  }

  return (
    <div className="platform-operations platform-tickets-page">
      <PageHeader title="تذاكر الدعم" subtitle={`${filtered.length} / ${tickets.length} تذكرة`} />

      <Card>
        <FilterBar
          search={query}
          onSearch={setQuery}
          searchPlaceholder="بحث بالموضوع أو المتجر..."
          actions={
            <div className="flex" style={{ gap: 8, flexWrap: 'wrap' }}>
              <select className="input" style={{ minWidth: 150 }} value={statusFilter} onChange={(e) => setStatusFilter((e.target as HTMLSelectElement).value)}>
                {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <select className="input" style={{ minWidth: 150 }} value={priorityFilter} onChange={(e) => setPriorityFilter((e.target as HTMLSelectElement).value)}>
                <option value="">كل الأولويات</option>
                <option value="low">عادية</option>
                <option value="medium">متوسطة</option>
                <option value="high">عالية</option>
                <option value="urgent">عاجلة</option>
              </select>
            </div>
          }
        />
        <Table cardMode
          columns={[
            { key: 'subject', header: 'الموضوع', render: (t: Ticket) => <span className="font-semibold">{t.subject}</span> },
            { key: 'storeId', header: 'المتجر', render: (t: Ticket) => <span className="monospace small">{t.storeId?.slice(0, 8) || '—'}</span> },
            { key: 'priority', header: 'الأولوية', render: (t: Ticket) => <Badge tone={(TICKET_PRIORITY_TONES[t.priority] as any) || 'slate'}>{t.priority}</Badge> },
            { key: 'status', header: 'الحالة', render: (t: Ticket) => <Badge tone={(TICKET_STATUS_TONES[t.status as any] as any) || 'slate'}>{t.status}</Badge> },
            { key: 'assignedTo', header: 'المسؤول', render: (t: Ticket) => <span className="small">{(t as any).assignedTo ? String((t as any).assignedTo).slice(0, 8) : '—'}</span> },
            { key: 'lastReplyAt', header: 'آخر رد', render: (t: Ticket) => <span className="muted small">{(t as any).lastReplyAt ? timeAgo((t as any).lastReplyAt) : timeAgo(t.updatedAt || t.createdAt)}</span> },
            { key: 'createdAt', header: 'التاريخ', render: (t: Ticket) => <span className="muted small">{formatDateTime(t.createdAt)}</span> },
          ]}
          rows={filtered}
          onRowClick={(t) => { setSelected(t); setOpen(true) }}
        />
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title={selected?.subject || 'التذكرة'} size="lg">
        {selected && (
          <div>
            <p className="muted mb-2">{selected.description}</p>
            <div className="mb-2">
              <span className="small muted">المتجر: {selected.storeId}</span> | <span className="small muted">الحالة: {selected.status}</span> | <span className="small muted">الأولوية: {selected.priority}</span>
            </div>
            <div className="mb-2">
              {(selected.replies || []).map((r, i) => (
                <div key={i} className="card mb-1" style={{ padding: 12, background: (r as any).role === 'superAdmin' ? 'var(--surface)' : 'var(--surface-1)' }}>
                  <p className="small">{r.body}</p>
                  <p className="muted small mt-1">{(r as any).role || r.by} — {formatDateTime(r.at as any)}</p>
                </div>
              ))}
              {(!selected.replies || selected.replies.length === 0) && <p className="muted small">لا توجد ردود بعد.</p>}
            </div>
            <Textarea label="رد جديد" value={reply} onChange={setReply} rows={3} />
            <div className="flex flex-gap-sm flex-wrap mt-2" style={{ gap: 8 }}>
              <Button onClick={handleReply} disabled={!reply.trim()}>إرسال الرد</Button>
              <Select value={selected.status} onChange={handleStatusChange} options={[{ value: 'open', label: 'مفتوحة' }, { value: 'in_progress', label: 'قيد المعالجة' }, { value: 'waiting_merchant', label: 'بانتظار التاجر' }, { value: 'waiting_support', label: 'بانتظار الدعم' }, { value: 'closed', label: 'مغلقة' }]} />
              <Input placeholder="تعيين إلى (UID)" value={assignTo} onChange={setAssignTo} />
              <Button variant="outline" onClick={handleAssign}>تعيين</Button>
              {selected.status !== 'closed' ? <Button variant="ghost" onClick={handleClose}>إغلاق</Button> : <Button variant="ghost" onClick={handleReopen}>إعادة فتح</Button>}
              <Button variant="ghost" onClick={() => setOpen(false)}>إغلاق النافذة</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
export default PlatformTickets
