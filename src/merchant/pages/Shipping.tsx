import { FunctionalComponent, Fragment } from 'preact'
import { useState } from 'preact/hooks'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { Table } from '../../shared/components/ui/Table'
import { Button } from '../../shared/components/ui/Button'
import { Modal } from '../../shared/components/ui/Modal'
import { Input } from '../../shared/components/ui/Input'
import { ConfirmDialog } from '../../shared/components/ui/ConfirmDialog'
import { Toggle } from '../../shared/components/ui/Toggle'
import { useStore } from '../../shared/hooks/useStore'
import { useCollection } from '../../shared/hooks/useCollection'
import { useToast } from '../../shared/hooks/useToast'
import { shippingService } from '../../shared/services/billing'
import { GOVER_EG } from '../../shared/utils/constants'
import { formatCurrency } from '../../shared/utils/format'
import type { ShippingZone } from '../../shared/types'

export const MerchantShipping: FunctionalComponent = () => {
  const { store } = useStore()
  const storeId = store?.id || ''
  const zonesRes = useCollection<ShippingZone>('shipping', { storeId });
  const zones = zonesRes.data
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ShippingZone | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ShippingZone | null>(null)
  const [form, setForm] = useState<Partial<ShippingZone>>({ active: true })

  const openCreate = () => {
    setEditing(null)
    setForm({ active: true })
    setOpen(true)
  }

  const openEdit = (z: ShippingZone) => {
    setEditing(z)
    setForm({ name: z.name, governorates: z.governorates || [], fee: z.fee, freeAbove: z.freeAbove, active: z.active ?? true })
    setOpen(true)
  }

  const submit = async () => {
    if (!form.name || form.fee === undefined) {
      toast.push('أدخل اسم المنطقة والتكلفة', undefined, 'error')
      return
    }
    if (editing) {
      await shippingService.update(editing.id, {
        name: form.name,
        governorates: form.governorates || [],
        fee: Number(form.fee),
        freeAbove: form.freeAbove ? Number(form.freeAbove) : null,
        active: form.active ?? true,
      })
      toast.push('تم تحديث منطقة الشحن')
    } else {
      await shippingService.create(storeId, {
        name: form.name,
        governorates: form.governorates || [],
        fee: Number(form.fee),
        freeAbove: form.freeAbove ? Number(form.freeAbove) : null,
        active: form.active ?? true,
      })
      toast.push('تم إضافة منطقة الشحن')
    }
    setOpen(false)
    setEditing(null)
    setForm({ active: true })
  }

  const remove = async () => {
    if (!deleteTarget) return
    await shippingService.remove(deleteTarget.id)
    toast.push('تم حذف منطقة الشحن')
    setDeleteTarget(null)
  }

  const toggle = async (z: ShippingZone) => {
    await shippingService.update(z.id, { active: !z.active })
  }

  return (
    <div>
      <PageHeader title="الشحن والتوصيل" subtitle={`${zones.length} منطقة شحن`} actions={<Button icon="add" onClick={openCreate}>منطقة جديدة</Button>} />
      <Card>
        <Table
          columns={[
            { key: 'name', header: 'المنطقة' },
            { key: 'governorates', header: 'المحافظات', render: (z: ShippingZone) => <span className="muted">{(z.governorates || []).length} محافظة</span> },
            { key: 'fee', header: 'التكلفة', render: (z: ShippingZone) => formatCurrency(z.fee) },
            { key: 'freeAbove', header: 'شحن مجاني فوق', render: (z: ShippingZone) => z.freeAbove ? formatCurrency(z.freeAbove) : '—' },
            { key: 'active', header: 'التفعيل', render: (z: ShippingZone) => <Toggle checked={z.active} onChange={() => toggle(z)} /> },
            { key: 'actions', header: '', render: (z: ShippingZone) => <div className="flex" style={{ gap: 4 }}><button className="icon-btn" onClick={() => openEdit(z)}><span className="material-symbols-outlined">edit</span></button><button className="icon-btn" onClick={() => setDeleteTarget(z)}><span className="material-symbols-outlined">delete</span></button></div> },
          ]}
          rows={zones}
        />
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'تعديل منطقة الشحن' : 'منطقة شحن جديدة'} footer={<Fragment><Button variant="ghost" onClick={() => setOpen(false)}>إلغاء</Button><Button onClick={submit}>حفظ</Button></Fragment>}>
        <Input label="اسم المنطقة" value={form.name || ''} onChange={(v) => setForm({ ...form, name: v })} required />
        <select multiple className="input" style={{ minHeight: 140 }} onChange={(e) => setForm({ ...form, governorates: Array.from((e.target as HTMLSelectElement).selectedOptions).map((o) => o.value) })}>
          {GOVER_EG.map((g) => <option key={g} value={g} selected={(form.governorates || []).includes(g)}>{g}</option>)}
        </select>
        <div className="grid grid-2">
          <Input label="تكلفة الشحن" type="number" value={form.fee ?? ''} onChange={(v) => setForm({ ...form, fee: Number(v) })} />
          <Input label="شحن مجاني فوق" type="number" value={form.freeAbove ?? ''} onChange={(v) => setForm({ ...form, freeAbove: Number(v) })} />
        </div>
        <div className="field mt-1">
          <Toggle checked={form.active ?? true} onChange={(v) => setForm({ ...form, active: v })} label="مفعّل" />
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onCancel={() => setDeleteTarget(null)} onConfirm={remove} title="حذف منطقة الشحن" description={`سيتم حذف "${deleteTarget?.name}" نهائياً.`} confirmLabel="حذف" />
    </div>
  )
}
export default MerchantShipping
