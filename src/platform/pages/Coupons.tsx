import { FunctionalComponent } from 'preact'
import { useState } from 'preact/hooks'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { Table } from '../../shared/components/ui/Table'
import { Badge } from '../../shared/components/ui/Badge'
import { Button } from '../../shared/components/ui/Button'
import { Modal } from '../../shared/components/ui/Modal'
import { Input } from '../../shared/components/ui/Input'
import { useCollection } from '../../shared/hooks/useCollection'
import { useToast } from '../../shared/hooks/useToast'
import { couponsService } from '../../shared/services/billing'
import { formatDate, formatCurrency } from '../../shared/utils/format'
import type { Coupon } from '../../shared/types'

export const PlatformCoupons: FunctionalComponent = () => {
  const storesRes = useCollection('stores', {});
  const stores = storesRes.data
  const [storeId, setStoreId] = useState('')
  const couponsRes = useCollection<Coupon>('coupons', storeId ? { storeId } : {});
  const coupons = couponsRes.data
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<Partial<Coupon>>({ type: 'percent' })

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

  return (
    <div>
      <PageHeader title="الكوبونات" subtitle={`${coupons.length} كوبون`} actions={<Button icon="add" onClick={() => setOpen(true)}>كوبون جديد</Button>} />
      <div className="toolbar">
        <select className="input" style={{ width: 220 }} value={storeId} onChange={(e) => setStoreId((e.target as HTMLSelectElement).value)}>
          <option value="">كل المتاجر</option>
          {stores.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <Card>
        <Table
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
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="إنشاء كوبون">
        <div className="grid grid-2">
          <Input label="الكود" value={form.code || ''} onChange={(v) => setForm({ ...form, code: v })} placeholder="SAVE10" />
          <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: (e.target as HTMLSelectElement).value as any })}>
            <option value="percent">نسبة مئوية</option>
            <option value="fixed">مبلغ ثابت</option>
          </select>
        </div>
        <Input label="القيمة" type="number" value={form.value || ''} onChange={(v) => setForm({ ...form, value: Number(v) })} />
        <div className="grid grid-2">
          <Input label="حد أدنى للطلب" type="number" value={form.minOrder || ''} onChange={(v) => setForm({ ...form, minOrder: Number(v) })} />
          <Input label="حد الاستخدام" type="number" value={form.maxUses || ''} onChange={(v) => setForm({ ...form, maxUses: Number(v) })} />
        </div>
        <div className="flex" style={{ justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={() => setOpen(false)}>إلغاء</Button>
          <Button onClick={submit}>حفظ</Button>
        </div>
      </Modal>
    </div>
  )
}
export default PlatformCoupons
