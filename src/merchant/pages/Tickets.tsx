import { FunctionalComponent } from 'preact'
import { useState } from 'preact/hooks'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Badge } from '../../shared/components/ui/Badge'
import { Button } from '../../shared/components/ui/Button'
import { EmptyState } from '../../shared/components/ui/EmptyState'
import { Icon } from '../../shared/components/ui/Icon'
import { Modal } from '../../shared/components/ui/Modal'
import { Textarea } from '../../shared/components/ui/Textarea'
import { Drawer } from '../../shared/components/ui/Drawer'
import { useStore } from '../../shared/hooks/useStore'
import { useCollection } from '../../shared/hooks/useCollection'
import { useToast } from '../../shared/hooks/useToast'
import { createTicketCallable } from '../../shared/services/auth'
import { formatDateTime, timeAgo } from '../../shared/utils/format'
import { TICKET_STATUS_TONES, TICKET_PRIORITY_TONES } from '../../shared/utils/constants'
import type { Ticket, TicketPriority, TicketStatus } from '../../shared/types'
import './Tickets.css'

const STATUS_LABELS: Record<string, string> = {
  open: 'مفتوحة',
  in_progress: 'قيد المعالجة',
  waiting_merchant: 'بانتظار التاجر',
  waiting_support: 'بانتظار الدعم',
  resolved: 'محلولة',
  closed: 'مغلقة',
}

const PRIORITY_LABELS: { value: TicketPriority; label: string }[] = [
  { value: 'low', label: 'عادية' },
  { value: 'medium', label: 'متوسطة' },
  { value: 'high', label: 'عالية' },
  { value: 'urgent', label: 'عاجلة' },
]

export const MerchantTickets: FunctionalComponent = () => {
  const { store } = useStore()
  const storeId = store?.id || ''
  const toast = useToast()
  const ticketsRes = useCollection<Ticket>('tickets', { storeId });
  const tickets = ticketsRes.data
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<TicketPriority>('medium')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [priorityFilter, setPriorityFilter] = useState<string>('')
  const [selected, setSelected] = useState<Ticket | null>(null)
  const [replyBody, setReplyBody] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)

  const filtered = tickets.filter((t) => {
    if (query && !`${t.subject} ${t.description}`.toLowerCase().includes(query.toLowerCase())) return false
    if (statusFilter && t.status !== statusFilter) return false
    if (priorityFilter && t.priority !== priorityFilter) return false
    return true
  })

  const submit = async () => {
    if (!subject || !description) {
      toast.push('أدخل الموضوع والوصف', undefined, 'error')
      return
    }
    try {
      await createTicketCallable({ storeId, subject, description, priority })
      toast.push('تم إنشاء التذكرة')
      setSubject('')
      setDescription('')
    } catch (err: any) {
      toast.push('تعذر إنشاء التذكرة', err?.message || 'حدث خطأ غير متوقع', 'error')
    }
  }

  const openTicket = (t: Ticket) => {
    setSelected(t)
    setDrawerOpen(true)
  }

  // These will be wired to backend callables once implemented
  const handleReply = async () => {
    if (!selected || !replyBody.trim()) return
    try {
      const { replyTicket } = await import('../../shared/services/tickets')
      await replyTicket(selected.id, replyBody.trim())
      toast.push('تم إرسال الرد')
      setReplyBody('')
      // Optimistically update local
      setSelected({ ...selected, replies: [...(selected.replies || []), { by: 'me', body: replyBody.trim(), at: { seconds: Math.floor(Date.now()/1000), nanoseconds: 0 } }] } as any)
    } catch (err: any) {
      toast.push('تعذر إرسال الرد', err?.message, 'error')
    }
  }

  const handleClose = async () => {
    if (!selected) return
    try {
      const { closeTicket } = await import('../../shared/services/tickets')
      await closeTicket(selected.id)
      toast.push('تم إغلاق التذكرة')
      setDrawerOpen(false)
    } catch (err: any) {
      toast.push('تعذر الإغلاق', err?.message, 'error')
    }
  }

  const handleReopen = async () => {
    if (!selected) return
    try {
      const { reopenTicket } = await import('../../shared/services/tickets')
      await reopenTicket(selected.id)
      toast.push('تم إعادة فتح التذكرة')
      setDrawerOpen(false)
    } catch (err: any) {
      toast.push('تعذر إعادة الفتح', err?.message, 'error')
    }
  }

  return (
    <div className="merchant-operations merchant-tickets-page">
      <PageHeader title="تذاكر الدعم الفني" subtitle="إدارة ومتابعة طلبات المساعدة الخاصة بمتجرك." />

      <div className="tickets-grid">
        <div className="tickets-aside">
          <section className="tickets-card">
            <h3 className="tickets-card-title"><Icon name="add_circle" ariaHidden /> إنشاء تذكرة جديدة</h3>
            <form className="tickets-form" onSubmit={(e) => { e.preventDefault(); submit() }}>
              <div className="field">
                <label className="field-label">موضوع التذكرة</label>
                <input className="input" value={subject} onInput={(e) => setSubject((e.target as HTMLInputElement).value)} />
              </div>
              <div className="field">
                <label className="field-label">وصف المشكلة</label>
                <textarea className="input tickets-textarea" rows={4} value={description} onInput={(e) => setDescription((e.target as HTMLTextAreaElement).value)} />
              </div>
              <div className="field">
                <label className="field-label">الأولوية</label>
                <select className="input" value={priority} onChange={(e) => setPriority((e.target as HTMLSelectElement).value as TicketPriority)}>
                  {PRIORITY_LABELS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <Button icon="send" className="w-full" disabled={!subject || !description}>إرسال التذكرة</Button>
            </form>
          </section>
        </div>

        <div className="tickets-main">
          <section className="tickets-card tickets-list-card">
            <div className="tickets-list-head">
              <h3 className="tickets-card-title">سجل التذاكر</h3>
              <div className="tickets-filters">
                <div className="tickets-search">
                  <Icon name="search" ariaHidden />
                  <input className="tickets-search-input" placeholder="بحث..." value={query} onInput={(e) => setQuery((e.target as HTMLInputElement).value)} />
                </div>
                <select className="input" value={statusFilter} onChange={(e) => setStatusFilter((e.target as HTMLSelectElement).value)}>
                  <option value="">كل الحالات</option>
                  <option value="open">مفتوحة</option>
                  <option value="in_progress">قيد المعالجة</option>
                  <option value="waiting_merchant">بانتظار التاجر</option>
                  <option value="waiting_support">بانتظار الدعم</option>
                  <option value="closed">مغلقة</option>
                </select>
                <select className="input" value={priorityFilter} onChange={(e) => setPriorityFilter((e.target as HTMLSelectElement).value)}>
                  <option value="">كل الأولويات</option>
                  <option value="low">عادية</option>
                  <option value="medium">متوسطة</option>
                  <option value="high">عالية</option>
                  <option value="urgent">عاجلة</option>
                </select>
              </div>
            </div>
            <div className="tickets-table-wrap">
              {ticketsRes.loading ? (
                <div className="tickets-empty"><EmptyState icon="hourglass" title="جارٍ التحميل" description="يتم جلب التذاكر..." /></div>
              ) : filtered.length === 0 ? (
                <div className="tickets-empty">
                  <EmptyState icon="support_agent" title={query || statusFilter || priorityFilter ? 'لا توجد نتائج مطابقة' : 'لا توجد تذاكر بعد'} description={query || statusFilter ? 'جرّب كلمة بحث مختلفة' : 'أنشئ تذكرتك الأولى من النموذج المجاور.'} />
                </div>
              ) : (
                <table className="tickets-table">
                  <thead>
                    <tr>
                      <th>رقم التذكرة</th>
                      <th>الموضوع</th>
                      <th>الحالة</th>
                      <th>الأولوية</th>
                      <th>تاريخ الإنشاء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((t) => (
                      <tr key={t.id} onClick={() => openTicket(t)} style={{ cursor: 'pointer' }}>
                        <td className="tickets-no">#TCK-{t.id.slice(0, 4).toUpperCase()}</td>
                        <td className="tickets-subject">{t.subject}</td>
                        <td><Badge tone={(TICKET_STATUS_TONES[t.status as TicketStatus] as any) || 'slate'}>{STATUS_LABELS[t.status] || t.status}</Badge></td>
                        <td><Badge tone={(TICKET_PRIORITY_TONES[t.priority] as any) || 'slate'}>{t.priority}</Badge></td>
                        <td className="tickets-date">{formatDateTime(t.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </div>
      </div>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={selected?.subject || 'تفاصيل التذكرة'} size="lg">
        {selected && (
          <div className="tickets-detail">
            <div className="tickets-detail-header">
              <Badge tone={(TICKET_STATUS_TONES[selected.status as TicketStatus] as any) || 'slate'}>{STATUS_LABELS[selected.status] || selected.status}</Badge>
              <Badge tone={(TICKET_PRIORITY_TONES[selected.priority] as any) || 'slate'}>{selected.priority}</Badge>
              <span className="muted small">{formatDateTime(selected.createdAt)}</span>
            </div>
            <p className="tickets-detail-desc">{selected.description}</p>
            <div className="tickets-thread">
              {(selected.replies || []).map((r, i) => (
                <div key={i} className={`tickets-message ${r.by === selected.createdBy ? 'is-merchant' : 'is-support'}`}>
                  <div className="tickets-message-head">
                    <span>{r.by === selected.createdBy ? 'أنت' : 'الدعم الفني'}</span>
                    <span className="muted small">{formatDateTime(r.at as any)}</span>
                  </div>
                  <p>{r.body}</p>
                </div>
              ))}
              {(!selected.replies || selected.replies.length === 0) && <p className="muted small">لا توجد ردود بعد.</p>}
            </div>
            {selected.status !== 'closed' ? (
              <div className="tickets-reply">
                <Textarea label="رد جديد" value={replyBody} onChange={setReplyBody} rows={3} placeholder="اكتب ردك هنا..." />
                <div className="flex flex-gap-sm">
                  <Button onClick={handleReply} disabled={!replyBody.trim()} icon="send">إرسال الرد</Button>
                  <Button variant="outline" onClick={handleClose}>إغلاق التذكرة</Button>
                </div>
              </div>
            ) : (
              <div className="tickets-closed-actions">
                <p className="muted small">التذكرة مغلقة.</p>
                <Button variant="outline" onClick={handleReopen}>إعادة فتح</Button>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  )
}
export default MerchantTickets
