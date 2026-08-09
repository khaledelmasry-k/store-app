import { FunctionalComponent, Fragment } from 'preact'
import { useState } from 'preact/hooks'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Badge } from '../../shared/components/ui/Badge'
import { Button } from '../../shared/components/ui/Button'
import { Modal } from '../../shared/components/ui/Modal'
import { Input } from '../../shared/components/ui/Input'
import { Textarea } from '../../shared/components/ui/Textarea'
import { Toggle } from '../../shared/components/ui/Toggle'
import { EmptyState } from '../../shared/components/ui/EmptyState'
import { SegmentedControl } from '../../shared/components/ui/SegmentedControl'
import { useCollection } from '../../shared/hooks/useCollection'
import { useToast } from '../../shared/hooks/useToast'
import { savePlanCallable } from '../../shared/services/auth'
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
      trialDays: Number(form.trialDays || 3),
      launchPrice: Number(form.launchPrice || 0),
      launchEnabled: !!form.launchEnabled,
      productLimit: Number(form.productLimit || 10),
      orderLimitPerMonth: Number(form.orderLimitPerMonth || 0),
      landingPagesLimit: Number(form.landingPagesLimit || 0),
      salesLinksLimit: Number(form.salesLinksLimit || 0),
      staffLimit: Number(form.staffLimit || 0),
      storageLimit: Number(form.storageLimit || 0),
      features: form.features || [],
      active: form.active ?? true,
    }
    try {
      await savePlanCallable({ planId: editing?.id, plan: payload })
      toast.push(editing ? 'تم تحديث الباقة' : 'تم إنشاء الباقة')
      setOpen(false)
    } catch (err: any) {
      toast.push('فشل حفظ الباقة', err?.message || 'حدث خطأ غير متوقع', 'error')
    }
  }

  const toggleActive = async (p: SubscriptionPlan) => {
    try {
      await savePlanCallable({ planId: p.id, plan: { ...p, active: !p.active } })
      toast.push(p.active ? 'تم إيقاف الباقة' : 'تم تفعيل الباقة')
    } catch (err: any) {
      toast.push('فشل تحديث حالة الباقة', err?.message || 'حدث خطأ غير متوقع', 'error')
    }
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
                {p.launchEnabled && Number(p.launchPrice) > 0 && (
                  <div className="plan-pricing-launch">أول شهر {formatCurrency(p.launchPrice)} (خصم إطلاق)</div>
                )}
                <div className="plan-pricing-trial">تجربة مجانية {Number(p.trialDays || 3)} يوم</div>
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
                  <li>
                    <Icon name="web" />
                    حتى {p.landingPagesLimit || 0} صفحة هبوط
                  </li>
                  <li>
                    <Icon name="link" />
                    حتى {p.salesLinksLimit || 0} رابط بيع
                  </li>
                  <li>
                    <Icon name="group_add" />
                    حتى {p.staffLimit || 1} عضو فريق
                  </li>
                </ul>
                <div className="plan-pricing-actions">
                  <Button variant="soft" size="sm" icon="edit" onClick={() => openEdit(p)}>تعديل</Button>
                  <Button variant={p.active ? 'ghost' : 'outline'} size="sm" icon={p.active ? 'block' : 'check'} onClick={() => toggleActive(p)}>{p.active ? 'إيقاف' : 'تفعيل'}</Button>
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
          <Input label="مدة التجربة (أيام)" type="number" value={form.trialDays || 3} onChange={(v) => setForm({ ...form, trialDays: Number(v) })} />
          <Input label="سعر الإطلاق (الشهر الأول)" type="number" value={form.launchPrice || ''} onChange={(v) => setForm({ ...form, launchPrice: Number(v) })} />
        </div>
        <div className="field">
          <Toggle checked={form.launchEnabled ?? false} onChange={(v) => setForm({ ...form, launchEnabled: v })} label="تفعيل خصم الإطلاق للشهر الأول" />
        </div>
        <div className="grid grid-2">
          <Input label="حد المنتجات" type="number" value={form.productLimit || 10} onChange={(v) => setForm({ ...form, productLimit: Number(v) })} />
          <Input label="حد الطلبات الشهري" type="number" value={form.orderLimitPerMonth || ''} onChange={(v) => setForm({ ...form, orderLimitPerMonth: Number(v) })} />
        </div>
        <div className="grid grid-2">
          <Input label="حد صفحات الهبوط" type="number" value={form.landingPagesLimit || ''} onChange={(v) => setForm({ ...form, landingPagesLimit: Number(v) })} />
          <Input label="حد روابط البيع" type="number" value={form.salesLinksLimit || ''} onChange={(v) => setForm({ ...form, salesLinksLimit: Number(v) })} />
        </div>
        <div className="grid grid-2">
          <Input label="حد أعضاء الفريق" type="number" value={form.staffLimit || ''} onChange={(v) => setForm({ ...form, staffLimit: Number(v) })} />
          <Input label="حد التخزين (MB)" type="number" value={form.storageLimit || ''} onChange={(v) => setForm({ ...form, storageLimit: Number(v) })} />
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
