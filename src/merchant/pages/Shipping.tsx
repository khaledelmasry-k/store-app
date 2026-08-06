import { FunctionalComponent } from 'preact'
import { useState } from 'preact/hooks'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { StatsCard } from '../../shared/components/ui/StatsCard'
import { Table } from '../../shared/components/ui/Table'
import { Badge } from '../../shared/components/ui/Badge'
import { Button } from '../../shared/components/ui/Button'
import { Modal } from '../../shared/components/ui/Modal'
import { Input } from '../../shared/components/ui/Input'
import { Toggle } from '../../shared/components/ui/Toggle'
import { ConfirmDialog } from '../../shared/components/ui/ConfirmDialog'
import { Loading } from '../../shared/components/ui/Loading'
import { useStore } from '../../shared/hooks/useStore'
import { useCollection } from '../../shared/hooks/useCollection'
import { useToast } from '../../shared/hooks/useToast'
import { shippingService } from '../../shared/services/billing'
import { formatCurrency } from '../../shared/utils/format'
import type { ShippingZone } from '../../shared/types'

type ShippingMethod = Omit<ShippingZone, 'governorates' | 'freeAbove' | 'storeId'> & { id: string; description?: string; estimatedDays?: string }

export const MerchantShipping: FunctionalComponent = () => {
  const { store } = useStore()
  const storeId = store?.id || ''
  const shippingRes = useCollection<ShippingMethod>('shipping', { storeId })
  const methods = shippingRes.data
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ShippingMethod | null>(null)
  const [form, setForm] = useState<Partial<ShippingMethod>>({ active: true, fee: 0 })

  const submit = async () => {
    if (!form.name) {
      toast.push('أدخل اسم طريقة الشحن', undefined, 'error')
      return
    }
    await shippingService.create(storeId, {
      name: form.name,
      description: form.description || '',
      fee: Number(form.fee || 0),
      estimatedDays: form.estimatedDays || '',
      governorates: [],
      active: form.active ?? true,
    } as any)
    toast.push('تم إضافة طريقة الشحن')
    setOpen(false)
    setForm({ active: true, fee: 0 })
  }

  const remove = async () => {
    if (!deleteTarget) return
    await shippingService.remove(deleteTarget.id)
    toast.push('تم حذف طريقة الشحن')
    setDeleteTarget(null)
  }

  if (shippingRes.loading) return <Loading />

  return (
    <div>
      <PageHeader title="طرق الشحن" subtitle={`${methods.length} طريقة`} actions={<Button icon="add" onClick={() => setOpen(true)}>طريقة جديدة</Button>} />

      <div className="stats-grid">
        <StatsCard title="إجمالي الطرق" value={methods.length} icon="local_shipping" tone="primary" />
        <StatsCard title="نشطة" value={methods.filter((m) => m.active).length} icon="check_circle" tone="green" />
      </div>

      <Card>
        <Table cardMode
          columns={[
            { key: 'name', header: 'الاسم' },
            { key: 'description', header: 'الوصف' },
            { key: 'fee', header: 'السعر', render: (m: ShippingMethod) => formatCurrency(m.fee || 0) },
            { key: 'estimatedDays', header: 'المدة المتوقعة', render: (m: ShippingMethod) => m.estimatedDays || '—' },
            { key: 'active', header: 'الحالة', render: (m: ShippingMethod) => <Badge tone={m.active ? 'green' : 'slate'}>{m.active ? 'نشطة' : 'موقوفة'}</Badge> },
            { key: 'actions', header: '', render: (m: ShippingMethod) => <button className="icon-btn" onClick={() => setDeleteTarget(m)}><span className="material-symbols-outlined">delete</span></button> },
          ]}
          rows={methods}
        />
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="طريقة شحن جديدة">
        <Input label="اسم الطريقة" value={form.name || ''} onChange={(v) => setForm({ ...form, name: v })} required />
        <Input label="الوصف" value={form.description || ''} onChange={(v) => setForm({ ...form, description: v })} />
        <div className="grid grid-2">
          <Input label="السعر" type="number" value={form.fee || ''} onChange={(v) => setForm({ ...form, fee: Number(v) })} />
          <Input label="المدة المتوقعة" value={form.estimatedDays || ''} onChange={(v) => setForm({ ...form, estimatedDays: v })} placeholder="3-5 أيام" />
        </div>
        <div className="field">
          <Toggle checked={form.active ?? true} onChange={(v) => setForm({ ...form, active: v })} label="نشطة" />
        </div>
        <div className="flex flex-end">
          <Button variant="ghost" onClick={() => setOpen(false)}>إلغاء</Button>
          <Button onClick={submit}>حفظ</Button>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onCancel={() => setDeleteTarget(null)} onConfirm={remove} title="حذف طريقة الشحن" description={`سيتم حذف "${deleteTarget?.name}"`} confirmLabel="حذف" />
    </div>
  )
}
export default MerchantShipping