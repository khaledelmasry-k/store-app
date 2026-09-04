import { FunctionalComponent } from 'preact'
import { useState } from 'preact/hooks'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Badge } from '../../shared/components/ui/Badge'
import { Button } from '../../shared/components/ui/Button'
import { Modal } from '../../shared/components/ui/Modal'
import { Input } from '../../shared/components/ui/Input'
import { Textarea } from '../../shared/components/ui/Textarea'
import { Select } from '../../shared/components/ui/Select'
import { EmptyState } from '../../shared/components/ui/EmptyState'
import { useStore } from '../../shared/hooks/useStore'
import { useCollection } from '../../shared/hooks/useCollection'
import { useToast } from '../../shared/hooks/useToast'
import { customersService } from '../../shared/services/customers'
import { formatCurrency, timeAgo, formatDate } from '../../shared/utils/format'
import { GOVER_EG as GOVERNORATES } from '../../shared/utils/constants'
import { normalizeSegment, segmentLabel, SEGMENT_OPTIONS } from '../../shared/utils/segments'
import { STATUS_LABELS, STATUS_COLORS } from '../../shared/utils/constants'
import type { Customer, Order } from '../../shared/types'
import { Icon } from '../../shared/components/ui/Icon'
import './Customers.css'

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0] || '')
    .join('')
    .toUpperCase()

const segmentTone = (seg: string) => {
  const n = normalizeSegment(seg)
  if (n === 'vip') return 'tone-vip'
  if (n === 'repeat') return 'tone-regular'
  return 'tone-new'
}

const segmentBadge = (seg: string) =>
  seg ? <span className={`cust-seg-pill ${segmentTone(seg)}`}>{segmentLabel(normalizeSegment(seg))}</span> : null

export const MerchantCustomers: FunctionalComponent = () => {
  const { store } = useStore()
  const storeId = store?.id || ''
  const customersRes = useCollection<Customer>('customers', { storeId, orderBy: { field: 'createdAt' } })
  const customers = customersRes.data
  const ordersRes = useCollection<Order>('orders', { storeId, orderBy: { field: 'createdAt' } })
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [segment, setSegment] = useState('')
  const [governorate, setGovernorate] = useState('')
  const [selected, setSelected] = useState<Customer | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState<Partial<Customer>>({})
  const [saving, setSaving] = useState(false)

  const segments = Array.from(new Set(customers.map((c) => normalizeSegment(c.segment)).filter(Boolean))) as string[]

  const filtered = customers.filter(
    (c) =>
      ((c.name || '').includes(query) || (c.phone || '').includes(query) || (c.email || '').includes(query)) &&
      (!segment || normalizeSegment(c.segment) === segment) &&
      (!governorate || c.governorate === governorate),
  )

  const customerOrders = (c: Customer) =>
    ordersRes.data
      .filter(
        (o) => (o.customerDocId && o.customerDocId === c.id) || (o.phone && c.phone && o.phone === c.phone),
      )
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))

  const detail = selected || (filtered.length > 0 && !selected ? filtered[0] : null)
  const detailOrders = detail ? customerOrders(detail) : []

  const exportCsv = () => {
    const rows = [
      ['الاسم', 'الهاتف', 'البريد', 'المحافظة', 'المدينة', 'الشريحة', 'الطلبات', 'إجمالي الإنفاق', 'آخر طلب'],
      ...filtered.map((c) => [
        c.name, c.phone, c.email || '', c.governorate || '', c.city || '',
        c.segment ? segmentLabel(normalizeSegment(c.segment)) : '', String(c.totalOrders), String(c.totalSpent),
        c.lastOrderAt ? new Date((c.lastOrderAt as any).seconds * 1000).toISOString().slice(0, 10) : '',
      ]),
    ]
    const csv = '\uFEFF' + rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
    toast.push(`تم تصدير ${filtered.length} عميل`)
  }

  const openEdit = (c: Customer) => {
    setForm(c)
    setEditOpen(true)
  }

  const saveEdit = async () => {
    if (!selected || saving) return
    setSaving(true)
    try {
      await customersService.update(selected.id, { segment: form.segment || null, note: form.note || null, email: form.email || '' })
      toast.push('تم تحديث بيانات العميل')
      setEditOpen(false)
    } catch (err: any) {
      toast.push('تعذر تحديث العميل', err?.message || 'حدث خطأ غير متوقع', 'error')
    }
    setSaving(false)
  }

  const addManual = async () => {
    if (!form.name || !form.phone) {
      toast.push('أدخل اسم ورقم هاتف', undefined, 'error')
      return
    }
    try {
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
      setForm({})
      setAddOpen(false)
    } catch (err: any) {
      toast.push('تعذر إضافة العميل', err?.message || 'حدث خطأ غير متوقع', 'error')
    }
  }

  return (
    <div className="merchant-operations merchant-customers-page">
      <PageHeader
        breadcrumb="دليل العملاء"
        title="العملاء"
        subtitle={`${customers.length} عميل — سجل العملاء والإنفاق والطلبات`}
        actions={<Button icon="person_add" onClick={() => { setForm({}); setAddOpen(true) }}>إضافة عميل</Button>}
      />

      <div className="customers-toolbar">
        <div className="customers-search">
          <Icon name="search" ariaHidden />
          <input type="text" placeholder="ابحث بالاسم أو الهاتف أو البريد..." value={query} onInput={(e) => setQuery((e.target as HTMLInputElement).value)} aria-label="بحث في العملاء" />
        </div>
        <span className="customers-divider" />
        <select value={governorate} onChange={(e) => setGovernorate((e.target as HTMLSelectElement).value)} aria-label="المحافظة">
          <option value="">كل المحافظات</option>
          {GOVERNORATES.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <select value={segment} onChange={(e) => setSegment((e.target as HTMLSelectElement).value)} aria-label="الشريحة">
          <option value="">كل الشرائح</option>
          {segments.map((s) => <option key={s} value={s}>{segmentLabel(s)}</option>)}
        </select>
        <button type="button" className="customers-export" onClick={exportCsv}><Icon name="download" ariaHidden /> تصدير</button>
      </div>

      <div className="customers-layout">
        <div className="customers-table-col">
          {customersRes.loading ? (
            <div className="loading-screen"><span className="spinner spinner-lg" /></div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon="groups"
              title="لا يوجد عملاء"
              description={query || governorate || segment ? 'لا توجد نتائج تطابق البحث والفلترة.' : 'العملاء الذين يطلبون من متجرك سيظهرون هنا.'}
              action={!query && !governorate && !segment && <Button icon="person_add" onClick={() => { setForm({}); setAddOpen(true) }}>إضافة أول عميل</Button>}
            />
          ) : (
            <div className="customers-table">
              <table>
                <thead>
                  <tr>
                    <th>العميل</th>
                    <th>رقم الهاتف</th>
                    <th>المحافظة / المدينة</th>
                    <th>الشريحة</th>
                    <th>الطلبات</th>
                    <th>إجمالي الإنفاق</th>
                    <th>آخر طلب</th>
                    <th className="actions-col"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => {
                    const isVip = normalizeSegment(c.segment) === 'vip'
                    const lastOrder = customerOrders(c)[0]
                    return (
                      <tr key={c.id} className={selected?.id === c.id ? 'is-selected' : ''} onClick={() => setSelected(c)}>
                        <td>
                          <span className="cust-cell">
                            <span className={`cust-avatar ${segmentTone(c.segment || '')}`}>{initials(c.name)}</span>
                            <span>
                              <span className={`cust-name${isVip ? ' is-vip' : ''}`}>{c.name}</span>
                              {c.email && <span className="cust-email">{c.email}</span>}
                            </span>
                          </span>
                        </td>
                        <td><span className="cust-phone">{c.phone}</span></td>
                        <td>
                          <div>{c.governorate || '—'}</div>
                          {c.city && <div className="cust-city">{c.city}</div>}
                        </td>
                        <td>{segmentBadge(c.segment || '') || <span className="muted">—</span>}</td>
                        <td><span className="cust-nums">{c.totalOrders}</span></td>
                        <td><span className="cust-nums cust-spent">{formatCurrency(c.totalSpent)}</span></td>
                        <td>
                          <div className="cust-nums">{lastOrder?.orderNumber || '—'}</div>
                          <div className="cust-city">{timeAgo(c.lastOrderAt)}</div>
                        </td>
                        <td className="actions-col">
                          <button className="cust-more" onClick={(e) => { e.stopPropagation(); setSelected(c); openEdit(c) }} title="تعديل"><Icon name="edit" /></button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {detail && (
          <aside className="customers-aside">
            <div className="customers-aside-head">
              <span className="cust-avatar-lg">{initials(detail.name)}</span>
              <div>
                <h2>{detail.name}</h2>
                <p><Icon name="call" ariaHidden /> <span className="cust-nums">{detail.phone}</span></p>
              </div>
              <button type="button" className="customers-aside-close" onClick={() => setSelected(null)} title="إغلاق"><Icon name="close" ariaHidden /></button>
            </div>

            <div className="customers-aside-body">
              <div className="customers-aside-stats">
                <div className="cust-stat">
                  <span>إجمالي الطلبات</span>
                  <strong>{detailOrders.length || detail.totalOrders || 0}</strong>
                </div>
                <div className="cust-stat is-accent">
                  <span>إجمالي الإنفاق</span>
                  <strong>{formatCurrency(detailOrders.reduce((s, o) => s + (o.totalPrice || 0), 0) || detail.totalSpent || 0)}</strong>
                </div>
              </div>

              <div className="customers-aside-details">
                <h3>تفاصيل العميل</h3>
                {detail.email && (
                  <div className="cust-detail-row">
                    <Icon name="mail" ariaHidden />
                    <div><span>البريد الإلكتروني</span><strong>{detail.email}</strong></div>
                  </div>
                )}
                <div className="cust-detail-row">
                  <Icon name="location_on" ariaHidden />
                  <div>
                    <span>العنوان</span>
                    <strong>{[detail.governorate, detail.city].filter(Boolean).join('، ') || '—'}</strong>
                    {detail.address && <em>{detail.address}</em>}
                  </div>
                </div>
                <div className="cust-detail-row">
                  <Icon name="loyalty" ariaHidden />
                  <div><span>الشريحة</span>{segmentBadge(detail.segment || '') || <strong>—</strong>}</div>
                </div>
                {detail.note && (
                  <div className="cust-detail-row">
                    <Icon name="note" ariaHidden />
                    <div><span>ملاحظات</span><em className="cust-note">{detail.note}</em></div>
                  </div>
                )}
              </div>

              <div className="customers-aside-orders">
                <div className="customers-aside-orders-head">
                  <h3>سجل الطلبات</h3>
                  {detailOrders.length > 3 && <a href={`/dashboard/orders?q=${encodeURIComponent(detail.phone)}`}>عرض الكل</a>}
                </div>
                {detailOrders.length === 0 ? (
                  <p className="muted small">لم يضع هذا العميل أي طلبات بعد.</p>
                ) : (
                  detailOrders.slice(0, 3).map((o) => {
                    const displayStatus = String(o.shipmentStatus || '').toUpperCase() === 'FAILED' ? 'FAILED' : o.status
                    const status = displayStatus === 'FAILED' ? 'تعذر التسليم' : (STATUS_LABELS[o.status as keyof typeof STATUS_LABELS] || o.status)
                    const isDelivered = displayStatus === 'DELIVERED'
                    const tone = displayStatus === 'FAILED' ? 'red' : (STATUS_COLORS[o.status as keyof typeof STATUS_COLORS] || 'slate')
                    return (
                      <a key={o.id} className="cust-order-row" href={`/dashboard/orders/${o.id}`}>
                        <span className="cust-order-icon"><Icon name={isDelivered ? 'check_circle' : 'local_shipping'} ariaHidden /></span>
                        <span className="cust-order-main">
                          <strong className="cust-nums">{o.orderNumber}</strong>
                          <span>{formatDate(o.createdAt)}</span>
                        </span>
                        <span className="cust-order-total">
                          <strong className="cust-nums">{formatCurrency(o.totalPrice)}</strong>
                          <Badge tone={tone}>{status}</Badge>
                        </span>
                      </a>
                    )
                  })
                )}
              </div>

              <button type="button" className="customers-edit-btn" onClick={() => openEdit(detail)}><Icon name="edit" ariaHidden /> تعديل البيانات</button>
            </div>
          </aside>
        )}
      </div>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="تعديل بيانات العميل" footer={<><Button variant="ghost" onClick={() => setEditOpen(false)}>إلغاء</Button><Button icon="save" loading={saving} onClick={saveEdit}>حفظ التغييرات</Button></>}>
        <Input label="البريد" type="email" value={form.email ?? ''} onChange={(v) => setForm({ ...form, email: v })} />
        <Select label="الشريحة" value={form.segment ?? selected?.segment ?? ''} onChange={(v) => setForm({ ...form, segment: v })} placeholder="بدون شريحة" options={SEGMENT_OPTIONS} />
        <Textarea label="ملاحظة" value={form.note ?? selected?.note ?? ''} onChange={(v) => setForm({ ...form, note: v })} rows={3} />
      </Modal>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="إضافة عميل" footer={
        <>
          <Button variant="ghost" onClick={() => setAddOpen(false)}>إلغاء</Button>
          <Button onClick={addManual}>إضافة</Button>
        </>
      }>
        <Input label="الاسم" value={form.name || ''} onChange={(v) => setForm({ ...form, name: v })} required />
        <Input label="الهاتف" value={form.phone || ''} onChange={(v) => setForm({ ...form, phone: v })} required />
        <Input label="البريد" type="email" value={form.email || ''} onChange={(v) => setForm({ ...form, email: v })} />
        <Select label="الشريحة" value={form.segment || ''} onChange={(v) => setForm({ ...form, segment: v })} placeholder="بدون شريحة" options={SEGMENT_OPTIONS} />
        <Select label="المحافظة" value={form.governorate || ''} onChange={(v) => setForm({ ...form, governorate: v })} placeholder="اختر المحافظة" options={GOVERNORATES.map((g) => ({ value: g, label: g }))} />
        <Input label="المدينة" value={form.city || ''} onChange={(v) => setForm({ ...form, city: v })} />
        <Textarea label="العنوان" value={form.address || ''} onChange={(v) => setForm({ ...form, address: v })} rows={2} />
        <Textarea label="ملاحظة" value={form.note || ''} onChange={(v) => setForm({ ...form, note: v })} rows={2} />
      </Modal>
    </div>
  )
}
export default MerchantCustomers
