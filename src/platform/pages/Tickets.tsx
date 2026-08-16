import { FunctionalComponent } from 'preact'
import { useState } from 'preact/hooks'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { Table } from '../../shared/components/ui/Table'
import { Badge } from '../../shared/components/ui/Badge'
import { Button } from '../../shared/components/ui/Button'
import { Modal } from '../../shared/components/ui/Modal'
import { Textarea } from '../../shared/components/ui/Textarea'
import { useCollection } from '../../shared/hooks/useCollection'
import { useAuth } from '../../shared/hooks/useAuth'
import { useToast } from '../../shared/hooks/useToast'
import { ticketsService } from '../../shared/services/system'
import { formatDateTime } from '../../shared/utils/format'
import { TICKET_STATUS_TONES, TICKET_PRIORITY_TONES } from '../../shared/utils/constants'
import type { Ticket } from '../../shared/types'

export const PlatformTickets: FunctionalComponent = () => {
  const ticketsRes = useCollection<Ticket>('tickets', { orderBy: { field: 'createdAt' } });
  const tickets = ticketsRes.data
  const { user } = useAuth()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [reply, setReply] = useState('')
  const [selected, setSelected] = useState<Ticket | null>(null)

  const submitReply = async () => {
    if (!selected || !reply.trim()) return
    await ticketsService.update(selected.id, {
      replies: [...(selected.replies || []), { by: user?.uid || 'admin', body: reply.trim(), at: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 } }],
    })
    toast.push('تم إرسال الرد')
    setReply('')
    setOpen(false)
  }

  return (
    <div className="platform-operations platform-tickets-page">
      <PageHeader title="تذاكر الدعم" subtitle={`${tickets.length} تذكرة`} />
      <Card>
        <Table cardMode
          columns={[
            { key: 'subject', header: 'الموضوع' },
            { key: 'createdBy', header: 'المُنشئ', render: (t: Ticket) => <span className="monospace">{t.createdBy.slice(0, 8)}</span> },
            { key: 'priority', header: 'الأولوية', render: (t: Ticket) => <Badge tone={(TICKET_PRIORITY_TONES[t.priority] as any) || 'slate'}>{t.priority}</Badge> },
            { key: 'status', header: 'الحالة', render: (t: Ticket) => <Badge tone={(TICKET_STATUS_TONES[t.status] as any) || 'slate'}>{t.status}</Badge> },
            { key: 'createdAt', header: 'التاريخ', render: (t: Ticket) => <span className="muted">{formatDateTime(t.createdAt)}</span> },
          ]}
          rows={tickets}
          onRowClick={(t) => { setSelected(t); setOpen(true) }}
        />
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title={selected?.subject || 'التذكرة'} size="lg">
        <p className="muted mb-2">{selected?.description}</p>
        <div className="mb-2">
          {(selected?.replies || []).map((r, i) => (
            <div key={i} className="card mb-1" style={{ padding: 12 }}>
              <p className="small">{r.body}</p>
              <p className="muted small mt-1">{r.by}</p>
            </div>
          ))}
        </div>
        <Textarea label="رد جديد" value={reply} onChange={setReply} rows={3} />
        <div className="flex flex-end">
          <Button variant="ghost" onClick={() => setOpen(false)}>إغلاق</Button>
          <Button onClick={submitReply} disabled={!reply.trim()}>إرسال الرد</Button>
        </div>
      </Modal>
    </div>
  )
}
export default PlatformTickets
