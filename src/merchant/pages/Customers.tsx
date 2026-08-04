import { FunctionalComponent } from 'preact'
import { useState } from 'preact/hooks'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { Table } from '../../shared/components/ui/Table'
import { Badge } from '../../shared/components/ui/Badge'
import { Button } from '../../shared/components/ui/Button'
import { Modal } from '../../shared/components/ui/Modal'
import { Input } from '../../shared/components/ui/Input'
import { Textarea } from '../../shared/components/ui/Textarea'
import { Search } from '../../shared/components/ui/Search'
import { useStore } from '../../shared/hooks/useStore'
import { useCollection } from '../../shared/hooks/useCollection'
import { useToast } from '../../shared/hooks/useToast'
import { customersService } from '../../shared/services/customers'
import { formatCurrency, formatDate } from '../../shared/utils/format'
import { GOVER_EG as GOVERNORATES } from '../../shared/utils/constants'
import type { Customer } from '../../shared/types'

export const MerchantCustomers: FunctionalComponent = () => {
  const { store } = useStore()
  const storeId = store?.id || ''
  const customersRes = useCollection<Customer>('customers', { storeId, orderBy: { field: 'createdAt' } });
  const customers = customersRes.data
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [segment, setSegment] = useState('')
  const [editTarget, setEditTarget] = useState<Customer | null>(null)
  const [form, setForm] = useState<Partial<Customer>>({})

  const segments = Array.from(new Set(customers.map((c) => c.segment).filter(Boolean))) as string[]

  const filtered = customers.filter(
    (c) =>
      (c.name.includes(query) || c.phone.includes(query)) &&
      (!segment || c.segment === segment),
  )

  const save = async () => {
    if (!editTarget) return
    await customersService.update(editTarget.id, { segment: form.segment || null, note: form.note || null, email: form.email || '' })
    toast.push('تم تحديث بيانات العميل')
    setEditTarget(null)
  }

  const addManual = async () => {
    if (!form.name || !form.phone) {
      toast.push('أدخل اسم ورقم هاتف', undefined, 'error')
      return
    }
    await customersService.create(storeId, {
      name: form.name,
      phone: form.phone,
      email: form.email || '',
      governorate: form.governorate || '',
      city: form.city || '',
      address: form.address || '',
      segment: form.segment || null,
      note: form.note || null,
      totalOrders: 0,
      totalSpent: 0,
    })
    toast.push('تم إضافة العميل')
    setEditTarget(null)
    setForm({})
  }

  return (
    <div>
      <PageHeader title="العملاء" subtitle={`${customers.length} عميل`} actions={<Button icon="person_add" onClick={() => { setForm({}); setEditTarget({ id: 'new' } as Customer) }}>إضافة عميل</Button>} />
      <div className="toolbar">
        <Search value={query} onChange={setQuery} placeholder="بحث بالاسم أو الهاتف..." />
        <select className="input" style={{ width: 160 }} value={segment} onChange={(e) => setSegment((e.target as HTMLSelectElement).value)}>
          <option value="">كل الشرائح</option>
          {segments.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <Card>
        <Table
          columns={[
            { key: 'name', header: 'الاسم' },
            { key: 'phone', header: 'الهاتف' },
            { key: 'segment', header: 'الشريحة', render: (c: Customer) => c.segment ? <Badge tone="violet">{c.segment}</Badge> : '—' },
            { key: 'totalOrders', header: 'الطلبات', render: (c: Customer) => <Badge>{c.totalOrders}</Badge> },
            { key: 'totalSpent', header: 'الإجمالي', render: (c: Customer) => formatCurrency(c.totalSpent) },
            { key: 'lastOrderAt', header: 'آخر طلب', render: (c: Customer) => <span className="muted">{formatDate(c.lastOrderAt)}</span> },
            { key: 'actions', header: '', render: (c: Customer) => <button className="icon-btn" onClick={() => { setForm(c); setEditTarget(c) }}><span className="material-symbols-outlined">edit</span></button> },
          ]}
          rows={filtered}
        />
      </Card>

      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title={editTarget?.id === 'new' ? 'إضافة عميل' : 'تعديل العميل'}>
        <Input label="الاسم" value={form.name || ''} onChange={(v) => setForm({ ...form, name: v })} />
        <Input label="الهاتف" value={form.phone || ''} onChange={(v) => setForm({ ...form, phone: v })} />
        <Input label="البريد" type="email" value={form.email || ''} onChange={(v) => setForm({ ...form, email: v })} />
        <select className="input" value={form.segment || ''} onChange={(e) => setForm({ ...form, segment: (e.target as HTMLSelectElement).value })}>
          <option value="">بدون شريحة</option>
          {['جديد', 'متكرر', 'VIP', 'مهمل'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="input" value={form.governorate || ''} onChange={(e) => setForm({ ...form, governorate: (e.target as HTMLSelectElement).value })}>
          <option value="">المحافظة</option>
          {GOVERNORATES.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <Textarea label="ملاحظة" value={form.note || ''} onChange={(v) => setForm({ ...form, note: v })} rows={2} />
        <div className="flex" style={{ justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={() => setEditTarget(null)}>إلغاء</Button>
          <Button onClick={editTarget?.id === 'new' ? addManual : save}>حفظ</Button>
        </div>
      </Modal>
    </div>
  )
}
export default MerchantCustomers
