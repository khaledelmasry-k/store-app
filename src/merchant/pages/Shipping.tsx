import { FunctionalComponent, Fragment } from 'preact'
import { useState } from 'preact/hooks'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { Table } from '../../shared/components/ui/Table'
import { Badge } from '../../shared/components/ui/Badge'
import { Button } from '../../shared/components/ui/Button'
import { Modal } from '../../shared/components/ui/Modal'
import { Input } from '../../shared/components/ui/Input'
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
  const [form, setForm] = useState<Partial<ShippingZone>>({ active: true })

  const submit = async () => {
    if (!form.name || form.fee === undefined) {
      toast.push('أدخل اسم المنطقة والتكلفة', undefined, 'error')
      return
    }
    await shippingService.create(storeId, {
      name: form.name,
      governorates: form.governorates || [],
      fee: Number(form.fee),
      freeAbove: form.freeAbove ? Number(form.freeAbove) : undefined,
      active: form.active ?? true,
    })
    toast.push('تم إضافة منطقة الشحن')
    setOpen(false)
    setForm({ active: true })
  }

  return (
    <div>
      <PageHeader title="الشحن والتوصيل" subtitle={`${zones.length} منطقة شحن`} actions={<Button icon="add" onClick={() => setOpen(true)}>منطقة جديدة</Button>} />
      <Card>
        <Table
          columns={[
            { key: 'name', header: 'المنطقة' },
            { key: 'governorates', header: 'المحافظات', render: (z: ShippingZone) => <span className="muted">{(z.governorates || []).length} محافظة</span> },
            { key: 'fee', header: 'التكلفة', render: (z: ShippingZone) => formatCurrency(z.fee) },
            { key: 'freeAbove', header: 'شحن مجاني فوق', render: (z: ShippingZone) => z.freeAbove ? formatCurrency(z.freeAbove) : '—' },
            { key: 'active', header: 'الحالة', render: (z: ShippingZone) => <Badge tone={z.active ? 'green' : 'slate'}>{z.active ? 'مفعّل' : 'موقوف'}</Badge> },
          ]}
          rows={zones}
        />
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="منطقة شحن جديدة" footer={<Fragment><Button variant="ghost" onClick={() => setOpen(false)}>إلغاء</Button><Button onClick={submit}>حفظ</Button></Fragment>}>
        <Input label="اسم المنطقة" value={form.name || ''} onChange={(v) => setForm({ ...form, name: v })} required />
        <select multiple className="input" style={{ minHeight: 140 }} onChange={(e) => setForm({ ...form, governorates: Array.from((e.target as HTMLSelectElement).selectedOptions).map((o) => o.value) })}>
          {GOVER_EG.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <div className="grid grid-2">
          <Input label="تكلفة الشحن" type="number" value={form.fee ?? ''} onChange={(v) => setForm({ ...form, fee: Number(v) })} />
          <Input label="شحن مجاني فوق" type="number" value={form.freeAbove ?? ''} onChange={(v) => setForm({ ...form, freeAbove: Number(v) })} />
        </div>
      </Modal>
    </div>
  )
}
export default MerchantShipping
