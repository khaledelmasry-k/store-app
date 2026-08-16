import { FunctionalComponent } from 'preact'
import { useState } from 'preact/hooks'
import { InternalPageHeader, WorkspaceSection } from '../components/InternalWorkspace'
import '../components/InternalWorkspace.css'
import { Badge } from '../../shared/components/ui/Badge'
import { Button } from '../../shared/components/ui/Button'
import { Modal } from '../../shared/components/ui/Modal'
import { Input } from '../../shared/components/ui/Input'
import { Textarea } from '../../shared/components/ui/Textarea'
import { Select } from '../../shared/components/ui/Select'
import { FilterBar } from '../../shared/components/ui/FilterBar'
import { Table } from '../../shared/components/ui/Table'
import { EmptyState } from '../../shared/components/ui/EmptyState'
import { Pagination } from '../../shared/components/ui/Pagination'
import { useStore } from '../../shared/hooks/useStore'
import { useCollection } from '../../shared/hooks/useCollection'
import { useToast } from '../../shared/hooks/useToast'
import { customersService } from '../../shared/services/customers'
import { formatCurrency, formatDate } from '../../shared/utils/format'
import { GOVER_EG as GOVERNORATES } from '../../shared/utils/constants'
import { normalizeSegment, segmentLabel, SEGMENT_OPTIONS } from '../../shared/utils/segments'
import type { Customer } from '../../shared/types'
import { Icon } from '../../shared/components/ui/Icon'

const PAGE_SIZE = 10

export const MerchantCustomers: FunctionalComponent = () => {
  const { store } = useStore()
  const storeId = store?.id || ''
  const customersRes = useCollection<Customer>('customers', { storeId, orderBy: { field: 'createdAt' } })
  const customers = customersRes.data
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [segment, setSegment] = useState('')
  const [page, setPage] = useState(1)
  const [editTarget, setEditTarget] = useState<Customer | null>(null)
  const [form, setForm] = useState<Partial<Customer>>({})

  const segments = Array.from(new Set(customers.map((c) => normalizeSegment(c.segment)).filter(Boolean))) as string[]

  const filtered = customers.filter(
    (c) =>
      (c.name.includes(query) || c.phone.includes(query)) &&
      (!segment || normalizeSegment(c.segment) === segment),
  )
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const save = async () => {
    if (!editTarget) return
    try {
      await customersService.update(editTarget.id, { segment: form.segment || null, note: form.note || null, email: form.email || '' })
      toast.push('تم تحديث بيانات العميل')
    } catch (err: any) {
      toast.push('تعذر تحديث العميل', err?.message || 'حدث خطأ غير متوقع', 'error')
    }
    setEditTarget(null)
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
      setEditTarget(null)
      setForm({})
    } catch (err: any) {
      toast.push('تعذر إضافة العميل', err?.message || 'حدث خطأ غير متوقع', 'error')
    }
  }

  const openNew = () => {
    setForm({})
    setEditTarget({ id: 'new' } as Customer)
  }

  const openEdit = (c: Customer) => {
    setForm(c)
    setEditTarget(c)
  }

  return (
    <div className="merchant-operations merchant-customers-page">
      <InternalPageHeader eyebrow="دليل العملاء" title="العملاء" subtitle={`${customers.length} عميل — سجل العملاء والإنفاق والطلبات`} actions={<Button icon="person_add" onClick={openNew}>إضافة عميل</Button>} />

      <WorkspaceSection title="دليل العملاء" subtitle="ابحث وفلتر العملاء قبل فتح بياناتهم" className="customers-workspace">
        <FilterBar
        search={query}
        onSearch={(v) => { setQuery(v); setPage(1) }}
        searchPlaceholder="بحث بالاسم أو الهاتف..."
        segments={[{ label: 'كل الشرائح', value: '' }, ...segments.map((s) => ({ label: segmentLabel(s), value: s }))]}
        activeSegment={segment}
        onSegmentChange={(v) => { setSegment(v); setPage(1) }}
        />

      <div className="customers-table-body">
        {filtered.length === 0 ? (
          <EmptyState
            title="لا يوجد عملاء"
            description={query ? 'لا توجد نتائج تطابق بحثك.' : 'العملاء الذين يطلبون من متجرك سيظهرون هنا.'}
            icon="groups"
          />
        ) : (
          <Table cardMode
            columns={[
              { key: 'name', header: 'العميل', render: (c: Customer) => <span className="font-semibold">{c.name}</span> },
              { key: 'phone', header: 'الهاتف' },
              { key: 'segment', header: 'الشريحة', render: (c: Customer) => c.segment ? <Badge tone="violet">{segmentLabel(c.segment)}</Badge> : '—' },
              { key: 'totalOrders', header: 'الطلبات', render: (c: Customer) => <Badge>{c.totalOrders}</Badge> },
              { key: 'totalSpent', header: 'إجمالي الإنفاق', render: (c: Customer) => formatCurrency(c.totalSpent) },
              { key: 'lastOrderAt', header: 'آخر طلب', render: (c: Customer) => <span className="muted">{formatDate(c.lastOrderAt)}</span> },
              {
                key: 'actions',
                header: '',
                render: (c: Customer) => (
                  <button className="icon-btn" onClick={() => openEdit(c)} title="تعديل">
                    <Icon name="edit" />
                  </button>
                ),
              },
            ]}
            rows={pageRows}
          />
        )}
      </div>
      </WorkspaceSection>

      <Pagination page={page} totalPages={totalPages} total={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />

      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title={editTarget?.id === 'new' ? 'إضافة عميل' : 'تعديل العميل'} footer={
        <>
          <Button variant="ghost" onClick={() => setEditTarget(null)}>إلغاء</Button>
          <Button onClick={editTarget?.id === 'new' ? addManual : save}>حفظ</Button>
        </>
      }>
        <Input label="الاسم" value={form.name || ''} onChange={(v) => setForm({ ...form, name: v })} />
        <Input label="الهاتف" value={form.phone || ''} onChange={(v) => setForm({ ...form, phone: v })} />
        <Input label="البريد" type="email" value={form.email || ''} onChange={(v) => setForm({ ...form, email: v })} />
        <Select label="الشريحة" value={form.segment || ''} onChange={(v) => setForm({ ...form, segment: v })} placeholder="بدون شريحة" options={SEGMENT_OPTIONS} />
        <Select label="المحافظة" value={form.governorate || ''} onChange={(v) => setForm({ ...form, governorate: v })} placeholder="اختر المحافظة" options={GOVERNORATES.map((g) => ({ value: g, label: g }))} />
        <Textarea label="ملاحظة" value={form.note || ''} onChange={(v) => setForm({ ...form, note: v })} rows={2} />
      </Modal>
    </div>
  )
}
export default MerchantCustomers
