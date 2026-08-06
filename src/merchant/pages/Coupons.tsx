import { FunctionalComponent, Fragment } from 'preact'
import { useState } from 'preact/hooks'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { Table } from '../../shared/components/ui/Table'
import { Badge } from '../../shared/components/ui/Badge'
import { Button } from '../../shared/components/ui/Button'
import { Modal } from '../../shared/components/ui/Modal'
import { Input } from '../../shared/components/ui/Input'
import { Select } from '../../shared/components/ui/Select'
import { Toggle } from '../../shared/components/ui/Toggle'
import { ConfirmDialog } from '../../shared/components/ui/ConfirmDialog'
import { useStore } from '../../shared/hooks/useStore'
import { useCollection } from '../../shared/hooks/useCollection'
import { useToast } from '../../shared/hooks/useToast'
import { couponsService } from '../../shared/services/billing'
import { formatCurrency, formatDate } from '../../shared/utils/format'
import type { Coupon } from '../../shared/types'

export const MerchantCoupons: FunctionalComponent = () => {
  const { store } = useStore()
  const storeId = store?.id || ''
  const couponsRes = useCollection<Coupon>('coupons', { storeId });
  const coupons = couponsRes.data
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Coupon | null>(null)
  const [form, setForm] = useState<Partial<Coupon>>({ type: 'percent', active: true })

  const submit = async () => {
    if (!form.code || !form.value) {
      toast.push('أدخل الكود والقيمة', undefined, 'error')
      return
    }
    await couponsService.create(storeId, {
      code: form.code.toUpperCase(),
      type: form.type === 'fixed' ? 'fixed' : 'percent',
      value: Number(form.value),
      minOrder: Number(form.minOrder || 0),
      maxUses: Number(form.maxUses || 0),
      usedCount: 0,
      active: form.active ?? true,
    })
    toast.push('تم إنشاء الكوبون')
    setOpen(false)
    setForm({ type: 'percent', active: true })
  }

  const remove = async () => {
    if (!deleteTarget) return
    await couponsService.remove(deleteTarget.id)
    toast.push('تم حذف الكوبون')
    setDeleteTarget(null)
  }

  return (
    <div>
      <PageHeader title="الكوبونات" subtitle={`${coupons.length} كوبون`} actions={<Button icon="add" onClick={() => setOpen(true)}>كوبون جديد</Button>} />
      <Card>
        <Table cardMode
          columns={[
            { key: 'code', header: 'الكود', render: (c: Coupon) => <span className="monospace">{c.code}</span> },
            { key: 'type', header: 'النوع', render: (c: Coupon) => <Badge tone={c.type === 'percent' ? 'violet' : 'blue'}>{c.type === 'percent' ? 'نسبة' : 'مبلغ'}</Badge> },
            { key: 'value', header: 'القيمة', render: (c: Coupon) => c.type === 'percent' ? `${c.value}%` : formatCurrency(c.value) },
            { key: 'usedCount', header: 'الاستخدام', render: (c: Coupon) => `${c.usedCount}${c.maxUses ? ` / ${c.maxUses}` : ''}` },
            { key: 'active', header: 'الحالة', render: (c: Coupon) => <Toggle checked={c.active} onChange={(v) => couponsService.update(c.id, { active: v })} /> },
            { key: 'expiresAt', header: 'الانتهاء', render: (c: Coupon) => <span className="muted">{formatDate(c.expiresAt)}</span> },
            { key: 'actions', header: '', render: (c: Coupon) => <button className="icon-btn" onClick={() => setDeleteTarget(c)}><span className="material-symbols-outlined">delete</span></button> },
          ]}
          rows={coupons}
        />
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="كوبون جديد" footer={<Fragment><Button variant="ghost" onClick={() => setOpen(false)}>إلغاء</Button><Button onClick={submit}>حفظ</Button></Fragment>}>
        <div className="grid grid-2">
          <Input label="الكود" value={form.code || ''} onChange={(v) => setForm({ ...form, code: v })} placeholder="SAVE10" />
          <Select label="النوع" value={form.type || 'percent'} onChange={(v) => setForm({ ...form, type: v as any })} options={[{ value: 'percent', label: 'نسبة مئوية' }, { value: 'fixed', label: 'مبلغ ثابت' }]} />
        </div>
        <div className="grid grid-2">
          <Input label="القيمة" type="number" value={form.value || ''} onChange={(v) => setForm({ ...form, value: Number(v) })} />
          <Input label="حد أدنى للطلب" type="number" value={form.minOrder || ''} onChange={(v) => setForm({ ...form, minOrder: Number(v) })} />
        </div>
        <Input label="حد الاستخدام" type="number" value={form.maxUses || ''} onChange={(v) => setForm({ ...form, maxUses: Number(v) })} />
        <div className="field">
          <Toggle checked={form.active ?? true} onChange={(v) => setForm({ ...form, active: v })} label="مفعّل" />
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onCancel={() => setDeleteTarget(null)} onConfirm={remove} title="حذف الكوبون" description={`سيتم حذف ${deleteTarget?.code}`} confirmLabel="حذف" />
    </div>
  )
}
export default MerchantCoupons
