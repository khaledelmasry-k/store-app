import { FunctionalComponent } from 'preact'
import { useState } from 'preact/hooks'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Badge } from '../../shared/components/ui/Badge'
import { Button } from '../../shared/components/ui/Button'
import { EmptyState } from '../../shared/components/ui/EmptyState'
import { Icon } from '../../shared/components/ui/Icon'
import { useStore } from '../../shared/hooks/useStore'
import { useCollection } from '../../shared/hooks/useCollection'
import { useAuth } from '../../shared/hooks/useAuth'
import { useToast } from '../../shared/hooks/useToast'
import { ticketsService } from '../../shared/services/system'
import { formatDateTime, timeAgo } from '../../shared/utils/format'
import { TICKET_STATUS_TONES } from '../../shared/utils/constants'
import type { Ticket, TicketPriority, TicketStatus } from '../../shared/types'
import './Tickets.css'

const STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'مفتوحة',
  in_progress: 'قيد المعالجة',
  resolved: 'محلولة',
  closed: 'مغلقة',
}

const PRIORITY_LABELS: { value: TicketPriority; label: string }[] = [
  { value: 'low', label: 'عادية' },
  { value: 'medium', label: 'متوسطة' },
  { value: 'high', label: 'عالية' },
]

export const MerchantTickets: FunctionalComponent = () => {
  const { store } = useStore()
  const storeId = store?.id || ''
  const { user } = useAuth()
  const toast = useToast()
  const ticketsRes = useCollection<Ticket>('tickets', { storeId });
  const tickets = ticketsRes.data
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<TicketPriority>('medium')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const filtered = tickets.filter((t) => !query || t.subject.toLowerCase().includes(query.toLowerCase()))

  const submit = async () => {
    if (!subject || !description) {
      toast.push('أدخل الموضوع والوصف', undefined, 'error')
      return
    }
    try {
      await ticketsService.create({
        storeId,
        createdBy: user?.uid || '',
        subject,
        description,
        status: 'open',
        priority,
        replies: [],
      })
      toast.push('تم إنشاء التذكرة')
      setSubject('')
      setDescription('')
    } catch (err: any) {
      toast.push('تعذر إنشاء التذكرة', err?.message || 'حدث خطأ غير متوقع', 'error')
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
              <div className="tickets-search">
                <Icon name="search" ariaHidden />
                <input className="tickets-search-input" placeholder="بحث..." value={query} onInput={(e) => setQuery((e.target as HTMLInputElement).value)} />
              </div>
            </div>
            <div className="tickets-table-wrap">
              {ticketsRes.loading ? (
                <div className="tickets-empty"><EmptyState icon="hourglass" title="جارٍ التحميل" description="يتم جلب التذاكر..." /></div>
              ) : filtered.length === 0 ? (
                <div className="tickets-empty">
                  <EmptyState icon="support_agent" title={query ? 'لا توجد نتائج مطابقة' : 'لا توجد تذاكر بعد'} description={query ? 'جرّب كلمة بحث مختلفة' : 'أنشئ تذكرتك الأولى من النموذج المجاور.'} />
                </div>
              ) : (
                <table className="tickets-table">
                  <thead>
                    <tr>
                      <th>رقم التذكرة</th>
                      <th>الموضوع</th>
                      <th>الحالة</th>
                      <th>تاريخ الإنشاء</th>
                      <th>آخر تحديث</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((t) => (
                      <tr key={t.id} className={selectedId === t.id ? 'is-selected' : ''} onClick={() => setSelectedId(t.id)}>
                        <td className="tickets-no">#TCK-{t.id.slice(0, 4).toUpperCase()}</td>
                        <td className="tickets-subject">{t.subject}</td>
                        <td><Badge tone={(TICKET_STATUS_TONES[t.status] as any) || 'slate'}>{STATUS_LABELS[t.status] || t.status}</Badge></td>
                        <td className="tickets-date">{formatDateTime(t.createdAt)}</td>
                        <td className="tickets-date">{timeAgo(t.updatedAt || t.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
export default MerchantTickets