import { FunctionalComponent, Fragment } from 'preact'
import { useState } from 'preact/hooks'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { StatsCard } from '../../shared/components/ui/StatsCard'
import { Table } from '../../shared/components/ui/Table'
import { Badge } from '../../shared/components/ui/Badge'
import { Button } from '../../shared/components/ui/Button'
import { FilterBar } from '../../shared/components/ui/FilterBar'
import { EmptyState } from '../../shared/components/ui/EmptyState'
import { Loading } from '../../shared/components/ui/Loading'
import { Modal } from '../../shared/components/ui/Modal'
import { Input } from '../../shared/components/ui/Input'
import { Select } from '../../shared/components/ui/Select'
import { useCollection } from '../../shared/hooks/useCollection'
import { useToast } from '../../shared/hooks/useToast'
import { couponsService } from '../../shared/services/billing'
import { formatDate, formatCurrency } from '../../shared/utils/format'
import type { Coupon } from '../../shared/types'

export const PlatformCoupons: FunctionalComponent = () => {
  const storesRes = useCollection('stores', {})
  const stores = storesRes.data
  const [storeId, setStoreId] = useState('')
  const couponsRes = useCollection<Coupon>('coupons', storeId ? { storeId } : {})
  const coupons = couponsRes.data
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<Partial<Coupon>>({ type: 'percent' })

  const activeCount = coupons.filter((c) => c.active).length
  const expiredCount = coupons.filter((c) => !c.active).length

  const submit = async () => {
    if (!storeId || !form.code) {
      toast.push('اختر المتجر وأدخل الكود', undefined, 'error')
      return
    }
    await couponsService.create(storeId, {
      code: form.code.toUpperCase(),
      type: form.type === 'fixed' ? 'fixed' : 'percent',
      value: Number(form.value || 0),
      minOrder: Number(form.minOrder || 0),
      maxUses: Number(form.maxUses || 0),
      usedCount: 0,
      active: true,
    })
    toast.push('تم إنشاء الكوبون')
    setOpen(false)
    setForm({ type: 'percent' })
  }

  if (storesRes.loading) return <Loading />

  return (
    <div>
      <PageHeader title="الكوبونات" subtitle={`${coupons.length} كوبون`} actions={<Button icon="add" onClick={() => setOpen(true)}>كوبون جديد</Button>} />

      <div className="stats-grid">
        <StatsCard title="الكوبونات النشطة" value={activeCount} icon="local_offer" tone="green" />
        <StatsCard title="منتهية" value={expiredCount} icon="cancel" tone="red" />
        <StatsCard title="إجمالي الكوبونات" value={coupons.length} icon="confirmation_number" tone="primary" />
      </div>

      <Card>
        <FilterBar
          segments={[{ label: 'كل المتاجر', value: '' }, ...stores.map((s: any) => ({ label: s.name, value: s.id }))]}
          activeSegment={storeId}
          onSegmentChange={setStoreId}
        />
        {coupons.length === 0 ? (
          <EmptyState icon="local_offer" title="لا توجد كوبونات" description={storeId ? 'لا توجد كوبونات لهذا المتجر' : 'لم يتم إنشاء أي كوبونات بعد'} />
        ) : (
          <Table cardMode
            columns={[
              { key: 'code', header: 'الكود', render: (c: Coupon) => <span className="monospace">{c.code}</span> },
              { key: 'type', header: 'النوع', render: (c: Coupon) => <Badge tone={c.type === 'percent' ? 'violet' : 'blue'}>{c.type === 'percent' ? '%' : 'مبلغ'}</Badge> },
              { key: 'value', header: 'القيمة', render: (c: Coupon) => c.type === 'percent' ? `${c.value}%` : formatCurrency(c.value) },
              { key: 'usedCount', header: 'الاستخدام' },
              { key: 'active', header: 'الحالة', render: (c: Coupon) => <Badge tone={c.active ? 'green' : 'slate'}>{c.active ? 'نشط' : 'موقوف'}</Badge> },
              { key: 'expiresAt', header: 'الانتهاء', render: (c: Coupon) => <span className="muted">{formatDate(c.expiresAt)}</span> },
            ]}
            rows={coupons}
          />
        )}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="إنشاء كوبون" footer={<Fragment><Button variant="ghost" onClick={() => setOpen(false)}>إلغاء</Button><Button onClick={submit}>حفظ</Button></Fragment>}>
        <div className="grid grid-2">
          <Input label="الكود" value={form.code || ''} onChange={(v) => setForm({ ...form, code: v })} placeholder="SAVE10" />
          <Select label="النوع" value={form.type || 'percent'} onChange={(v) => setForm({ ...form, type: v as any })} options={[{ value: 'percent', label: 'نسبة مئوية' }, { value: 'fixed', label: 'مبلغ ثابت' }]} />
        </div>
        <Input label="القيمة" type="number" value={form.value || ''} onChange={(v) => setForm({ ...form, value: Number(v) })} />
        <div className="grid grid-2">
          <Input label="حد أدنى للطلب" type="number" value={form.minOrder || ''} onChange={(v) => setForm({ ...form, minOrder: Number(v) })} />
          <Input label="حد الاستخدام" type="number" value={form.maxUses || ''} onChange={(v) => setForm({ ...form, maxUses: Number(v) })} />
        </div>
      </Modal>
    </div>
  )
}
export default PlatformCoupons