import { FunctionalComponent } from 'preact'
import { useState } from 'preact/hooks'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { Badge } from '../../shared/components/ui/Badge'
import { Button } from '../../shared/components/ui/Button'
import { Textarea } from '../../shared/components/ui/Textarea'
import { useStore } from '../../shared/hooks/useStore'
import { useCollection } from '../../shared/hooks/useCollection'
import { useAuth } from '../../shared/hooks/useAuth'
import { useToast } from '../../shared/hooks/useToast'
import { ticketsService } from '../../shared/services/system'
import { formatDateTime } from '../../shared/utils/format'
import { TICKET_STATUS_TONES } from '../../shared/utils/constants'
import type { Ticket } from '../../shared/types'

export const MerchantTickets: FunctionalComponent = () => {
  const { store } = useStore()
  const storeId = store?.id || ''
  const { user } = useAuth()
  const toast = useToast()
  const ticketsRes = useCollection<Ticket>('tickets', { storeId });
  const tickets = ticketsRes.data
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')

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
        priority: 'medium',
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
    <div>
      <PageHeader title="الدعم الفني" subtitle={`${tickets.length} تذكرة`} />
      <div className="grid grid-2">
        <Card title="إنشاء تذكرة جديدة">
          <input className="input" placeholder="الموضوع" value={subject} onInput={(e) => setSubject((e.target as HTMLInputElement).value)} />
          <div className="mt-1">
            <Textarea label="الوصف" value={description} onChange={setDescription} rows={4} />
          </div>
          <div className="flex flex-end">
            <Button onClick={submit} disabled={!subject || !description}>إرسال</Button>
          </div>
        </Card>
        <Card title="تذاكري السابقة">
          {tickets.length === 0 ? (
            <p className="muted">لا توجد تذاكر بعد</p>
          ) : (
            tickets.map((t) => (
              <div key={t.id} className="flex-between mb-1">
                <div>
                  <p className="small"><strong>{t.subject}</strong></p>
                  <p className="muted small">{formatDateTime(t.createdAt)}</p>
                </div>
                <Badge tone={(TICKET_STATUS_TONES[t.status] as any) || 'slate'}>{t.status}</Badge>
              </div>
            ))
          )}
        </Card>
      </div>
    </div>
  )
}
export default MerchantTickets
