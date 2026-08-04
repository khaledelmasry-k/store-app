import { FunctionalComponent, Fragment } from 'preact'
import { useState } from 'preact/hooks'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { Badge } from '../../shared/components/ui/Badge'
import { Button } from '../../shared/components/ui/Button'
import { Modal } from '../../shared/components/ui/Modal'
import { Input } from '../../shared/components/ui/Input'
import { Textarea } from '../../shared/components/ui/Textarea'
import { Toggle } from '../../shared/components/ui/Toggle'
import { useCollection } from '../../shared/hooks/useCollection'
import { useToast } from '../../shared/hooks/useToast'
import { plansService } from '../../shared/services/billing'
import { formatCurrency } from '../../shared/utils/format'
import type { SubscriptionPlan } from '../../shared/types'

export const PlatformPlans: FunctionalComponent = () => {
  const plansRes = useCollection<SubscriptionPlan>('plans', { orderBy: { field: 'priceMonthly' } });
  const plans = plansRes.data
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<Partial<SubscriptionPlan>>({ features: [] as string[] })

  const submit = async () => {
    if (!form.name || !form.priceMonthly) {
      toast.push('أكمل بيانات الباقة', undefined, 'error')
      return
    }
    await plansService.create({
      name: form.name,
      description: form.description || '',
      priceMonthly: Number(form.priceMonthly),
      priceYearly: Number(form.priceYearly || 0),
      productLimit: Number(form.productLimit || 10),
      orderLimitPerMonth: Number(form.orderLimitPerMonth || 0),
      features: form.features || [],
      active: form.active ?? true,
    })
    toast.push('تم إنشاء الباقة')
    setOpen(false)
    setForm({ features: [] })
  }

  return (
    <div>
      <PageHeader title="باقات الاشتراك" subtitle={`${plans.length} باقة`} actions={<Button icon="add" onClick={() => setOpen(true)}>باقة جديدة</Button>} />
      <div className="grid grid-3">
        {plans.map((p) => (
          <Card key={p.id} title={p.name} subtitle={p.description}>
            <p className="stat-value">{formatCurrency(p.priceMonthly)}<span className="muted small"> /شهرياً</span></p>
            <div className="mt-2 small">
              <p><Badge tone={p.active ? 'green' : 'slate'}>{p.active ? 'متاحة' : 'موقوفة'}</Badge></p>
              <p className="mt-1">المنتجات: {p.productLimit} • الطلبات/شهر: {p.orderLimitPerMonth}</p>
              <ul className="mt-1">
                {p.features.map((f, i) => <li key={i}>• {f}</li>)}
              </ul>
            </div>
          </Card>
        ))}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="إنشاء باقة جديدة" footer={<Fragment><Button variant="ghost" onClick={() => setOpen(false)}>إلغاء</Button><Button onClick={submit}>حفظ</Button></Fragment>}>
        <Input label="اسم الباقة" value={form.name || ''} onChange={(v) => setForm({ ...form, name: v })} required />
        <Textarea label="الوصف" value={form.description || ''} onChange={(v) => setForm({ ...form, description: v })} rows={2} />
        <div className="grid grid-2">
          <Input label="السعر الشهري" type="number" value={form.priceMonthly || ''} onChange={(v) => setForm({ ...form, priceMonthly: Number(v) })} />
          <Input label="السعر السنوي" type="number" value={form.priceYearly || ''} onChange={(v) => setForm({ ...form, priceYearly: Number(v) })} />
        </div>
        <div className="grid grid-2">
          <Input label="حد المنتجات" type="number" value={form.productLimit || 10} onChange={(v) => setForm({ ...form, productLimit: Number(v) })} />
          <Input label="حد الطلبات الشهري" type="number" value={form.orderLimitPerMonth || ''} onChange={(v) => setForm({ ...form, orderLimitPerMonth: Number(v) })} />
        </div>
        <Textarea label="المميزات (كل سطر ميزة)" value={(form.features || []).join('\n')} onChange={(v) => setForm({ ...form, features: v.split('\n').filter(Boolean) })} rows={4} />
        <div className="field">
          <Toggle checked={form.active ?? true} onChange={(v) => setForm({ ...form, active: v })} label="متاحة للاشتراك" />
        </div>
      </Modal>
    </div>
  )
}
export default PlatformPlans
