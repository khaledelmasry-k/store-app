import { FunctionalComponent, Fragment } from 'preact'
import { useState } from 'preact/hooks'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Badge } from '../../shared/components/ui/Badge'
import { Button } from '../../shared/components/ui/Button'
import { Modal } from '../../shared/components/ui/Modal'
import { Input } from '../../shared/components/ui/Input'
import { Textarea } from '../../shared/components/ui/Textarea'
import { Toggle } from '../../shared/components/ui/Toggle'
import { ConfirmDialog } from '../../shared/components/ui/ConfirmDialog'
import { EmptyState } from '../../shared/components/ui/EmptyState'
import { SegmentedControl } from '../../shared/components/ui/SegmentedControl'
import { useCollection } from '../../shared/hooks/useCollection'
import { useToast } from '../../shared/hooks/useToast'
import { plansService } from '../../shared/services/billing'
import { formatCurrency } from '../../shared/utils/format'
import type { SubscriptionPlan } from '../../shared/types'
import { Icon } from '../../shared/components/ui/Icon'

export const PlatformPlans: FunctionalComponent = () => {
  const plansRes = useCollection<SubscriptionPlan>('plans', { orderBy: { field: 'priceMonthly' } })
  const plans = plansRes.data
  const toast = useToast()
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<SubscriptionPlan | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SubscriptionPlan | null>(null)
  const [form, setForm] = useState<Partial<SubscriptionPlan>>({ features: [] as string[] })

  const recommendedId = [...plans].sort((a, b) => a.priceMonthly - b.priceMonthly)[Math.max(0, Math.floor((plans.length - 1) / 2))]?.id

  const priceOf = (p: SubscriptionPlan) => (billing === 'monthly' ? p.priceMonthly : p.priceYearly || p.priceMonthly * 10)

  const openCreate = () => {
    setEditing(null)
    setForm({ features: [] })
    setOpen(true)
  }

  const openEdit = (p: SubscriptionPlan) => {
    setEditing(p)
    setForm({ ...p, features: p.features || [] })
    setOpen(true)
  }

  const submit = async () => {
    if (!form.name || !form.priceMonthly) {
      toast.push('أكمل بيانات الباقة', undefined, 'error')
      return
    }
    const payload = {
      name: form.name,
      description: form.description || '',
      priceMonthly: Number(form.priceMonthly),
      priceYearly: Number(form.priceYearly || 0),
      productLimit: Number(form.productLimit || 10),
      orderLimitPerMonth: Number(form.orderLimitPerMonth || 0),
      features: form.features || [],
      active: form.active ?? true,
    }
    if (editing) {
      await plansService.update(editing.id, payload)
      toast.push('تم تحديث الباقة')
    } else {
      await plansService.create(payload)
      toast.push('تم إنشاء الباقة')
    }
    setOpen(false)
  }

  const remove = async () => {
    if (!deleteTarget) return
    await plansService.remove(deleteTarget.id)
    toast.push('تم حذف الباقة')
    setDeleteTarget(null)
  }

  return (
    <div>
      <PageHeader
        title="باقات الاشتراك"
        subtitle={`${plans.length} باقة`}
        actions={<Button icon="add" onClick={openCreate}>باقة جديدة</Button>}
      />

      <div className="flex-between mb-2">
        <SegmentedControl
          value={billing}
          onChange={(v) => setBilling(v as 'monthly' | 'yearly')}
          options={[{ value: 'monthly', label: 'شهري' }, { value: 'yearly', label: 'سنوي' }]}
        />
      </div>

      {plans.length === 0 ? (
        <EmptyState title="لا توجد باقات" description="أنشئ أول باقة اشتراك للتجار" icon="workspace_premium" />
      ) : (
        <div className="plan-grid">
          {plans.map((p) => {
            const recommended = p.id === recommendedId
            return (
              <div key={p.id} className={`plan-pricing-card${recommended ? ' plan-pricing-card--featured' : ''}`}>
                {recommended && <span className="plan-pricing-badge">الأكثر طلباً</span>}
                <div className="plan-pricing-head">
                  <h3 className="plan-pricing-name">{p.name}</h3>
                  {p.active ? <Badge tone="green">متاحة</Badge> : <Badge tone="slate">موقوفة</Badge>}
                </div>
                {p.description && <p className="plan-pricing-desc">{p.description}</p>}
                <div className="plan-pricing-price">
                  <strong>{formatCurrency(priceOf(p))}</strong>
                  <span>/ {billing === 'monthly' ? 'شهرياً' : 'سنوياً'}</span>
                </div>
                <ul className="plan-pricing-features">
                  {p.features.map((f, i) => (
                    <li key={i}>
                      <Icon name="check_circle" />
                      {f}
                    </li>
                  ))}
                  <li>
                    <Icon name="inventory_2" />
                    حتى {p.productLimit} منتج
                  </li>
                  <li>
                    <Icon name="receipt_long" />
                    {p.orderLimitPerMonth > 0 ? `حتى ${p.orderLimitPerMonth} طلب شهرياً` : 'طلبات غير محدودة'}
                  </li>
                </ul>
                <div className="plan-pricing-actions">
                  <Button variant="soft" size="sm" icon="edit" onClick={() => openEdit(p)}>تعديل</Button>
                  <Button variant="ghost" size="sm" icon="delete" onClick={() => setDeleteTarget(p)}>حذف</Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'تعديل الباقة' : 'إنشاء باقة جديدة'}
        footer={
          <Fragment>
            <Button variant="ghost" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button onClick={submit}>حفظ</Button>
          </Fragment>
        }
      >
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

      <ConfirmDialog open={!!deleteTarget} onCancel={() => setDeleteTarget(null)} onConfirm={remove} title="حذف الباقة" description={`سيتم حذف باقة "${deleteTarget?.name}" نهائياً. قد يتأثر التجار المشتركون بها.`} confirmLabel="حذف" />
    </div>
  )
}
export default PlatformPlans
