import { FunctionalComponent, Fragment } from 'preact'
import { useState, useEffect, useMemo } from 'preact/hooks'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { Badge } from '../../shared/components/ui/Badge'
import { Button } from '../../shared/components/ui/Button'
import { Modal } from '../../shared/components/ui/Modal'
import { Input } from '../../shared/components/ui/Input'
import { Textarea } from '../../shared/components/ui/Textarea'
import { Toggle } from '../../shared/components/ui/Toggle'
import { StatsCard } from '../../shared/components/ui/StatsCard'
import { Table } from '../../shared/components/ui/Table'
import { EmptyState } from '../../shared/components/ui/EmptyState'
import { useToast } from '../../shared/hooks/useToast'
import { manageSubscriptionCouponCallable, listSubscriptionCouponsCallable, getSubscriptionCouponRedemptionsCallable } from '../../shared/services/auth'
import { formatPriceEgp, formatDate } from '../../shared/utils/format'

type Coupon = {
  id: string
  code: string
  name?: string
  description?: string
  internalNotes?: string
  active?: boolean
  archived?: boolean
  discountType: 'percentage' | 'fixed'
  discountValue: number
  applicablePlanIds?: string[]
  applicableBillingCycles?: string[]
  firstCycleOnly?: boolean
  startsAt?: any
  expiresAt?: any
  globalMaxRedemptions?: number | null
  maxRedemptions?: number | null
  redemptionCount?: number
  perMerchantLimit?: number
  partner?: string
  source?: string
  createdAt?: any
  updatedAt?: any
  archivedAt?: any
}

function toMs(v: any): number | null {
  if (!v) return null
  if (typeof v.toMillis === 'function') return v.toMillis()
  if (typeof v.toDate === 'function') return v.toDate().getTime()
  if (typeof v.seconds === 'number') return v.seconds * 1000
  const t = new Date(v).getTime()
  return Number.isFinite(t) ? t : null
}

function isExpired(c: Coupon): boolean {
  const exp = toMs(c.expiresAt)
  return exp != null && exp <= Date.now()
}
function isArchived(c: Coupon): boolean {
  return (c as any).archived === true
}

export const PlatformSubscriptionCoupons: FunctionalComponent = () => {
  const toast = useToast()
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<'all' | 'active' | 'disabled' | 'expired' | 'archived'>('all')
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Coupon | null>(null)
  const [usageOpen, setUsageOpen] = useState<Coupon | null>(null)
  const [usages, setUsages] = useState<any[]>([])
  const [usagesLoading, setUsagesLoading] = useState(false)
  const [form, setForm] = useState({
    code: '',
    name: '',
    description: '',
    discountType: 'percentage' as 'percentage' | 'fixed',
    discountValue: 30,
    applicablePlanIds: ['plan-basic', 'plan-starter', 'plan-growth', 'plan-pro'] as string[],
    applicableBillingCycles: ['monthly'] as string[],
    startsAt: '',
    expiresAt: '',
    globalMaxRedemptions: '' as string,
    active: true,
    partner: '',
    internalNotes: '',
  })

  const fetchCoupons = async () => {
    setLoading(true)
    try {
      const res: any = await listSubscriptionCouponsCallable()
      setCoupons(res.data?.coupons || [])
    } catch {
      setCoupons([])
      toast.push('فشل تحميل كوبونات الاشتراكات', undefined, 'error')
    } finally { setLoading(false) }
  }
  useEffect(() => { fetchCoupons() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const stats = useMemo(() => {
    const total = coupons.length
    const active = coupons.filter((c) => c.active !== false && !isExpired(c) && !isArchived(c)).length
    const expired = coupons.filter(isExpired).length
    const archived = coupons.filter(isArchived).length
    const totalUses = coupons.reduce((s, c) => s + Number(c.redemptionCount || 0), 0)
    return { total, active, expired, archived, totalUses }
  }, [coupons])

  const filtered = useMemo(() => {
    let list = [...coupons]
    if (filter === 'active') list = list.filter((c) => c.active !== false && !isExpired(c) && !isArchived(c))
    else if (filter === 'disabled') list = list.filter((c) => c.active === false && !isArchived(c))
    else if (filter === 'expired') list = list.filter(isExpired)
    else if (filter === 'archived') list = list.filter(isArchived)
    else if (filter === 'all') list = list.filter((c) => !isArchived(c))
    return list.sort((a, b) => {
      const am = toMs(a.createdAt) || 0
      const bm = toMs(b.createdAt) || 0
      return bm - am
    })
  }, [coupons, filter])

  const resetForm = () => {
    setForm({
      code: '',
      name: '',
      description: '',
      discountType: 'percentage',
      discountValue: 30,
      applicablePlanIds: ['plan-basic', 'plan-starter', 'plan-growth', 'plan-pro'],
      applicableBillingCycles: ['monthly'],
      startsAt: '',
      expiresAt: '',
      globalMaxRedemptions: '',
      active: true,
      partner: '',
      internalNotes: '',
    })
    setEditingId(null)
  }

  const openCreate = () => {
    resetForm()
    setOpen(true)
  }

  const openEdit = (c: Coupon) => {
    const fmt = (v: any) => {
      if (!v) return ''
      if (typeof v === 'string') return v.slice(0, 10)
      const ms = toMs(v)
      if (!ms) return ''
      const d = new Date(ms)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }
    setForm({
      code: String(c.code || '').toUpperCase(),
      name: String(c.name || ''),
      description: String(c.description || ''),
      discountType: c.discountType === 'fixed' ? 'fixed' : 'percentage',
      discountValue: Number(c.discountValue || 0),
      applicablePlanIds: Array.isArray(c.applicablePlanIds) && c.applicablePlanIds.length ? c.applicablePlanIds : ['plan-basic', 'plan-starter', 'plan-growth', 'plan-pro'],
      applicableBillingCycles: Array.isArray(c.applicableBillingCycles) && c.applicableBillingCycles.length ? c.applicableBillingCycles : ['monthly'],
      startsAt: fmt(c.startsAt),
      expiresAt: fmt(c.expiresAt),
      globalMaxRedemptions: c.globalMaxRedemptions != null ? String(c.globalMaxRedemptions) : c.maxRedemptions != null ? String(c.maxRedemptions) : '',
      active: c.active !== false,
      partner: String(c.partner || c.source || ''),
      internalNotes: String(c.internalNotes || ''),
    })
    setEditingId(c.id)
    setOpen(true)
  }

  const save = async () => {
    if (!form.code.trim() || !form.name.trim() || !Number(form.discountValue || 0)) {
      toast.push('أكمل الكود والاسم وقيمة الخصم', undefined, 'error')
      return
    }
    if (form.applicablePlanIds.length === 0) {
      toast.push('اختر باقة واحدة على الأقل', undefined, 'error')
      return
    }
    if (form.applicableBillingCycles.length === 0) {
      toast.push('اختر دورة دفع واحدة على الأقل', undefined, 'error')
      return
    }
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        code: form.code.toUpperCase(),
        name: form.name,
        description: form.description,
        internalNotes: form.internalNotes,
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        applicablePlanIds: form.applicablePlanIds,
        applicableBillingCycles: form.applicableBillingCycles,
        firstCycleOnly: true,
        perMerchantLimit: 1,
        active: form.active,
        partner: form.partner,
        source: form.partner,
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
        globalMaxRedemptions: form.globalMaxRedemptions ? Number(form.globalMaxRedemptions) : null,
      }
      if (editingId) {
        await manageSubscriptionCouponCallable({ operation: 'update', couponId: editingId, coupon: payload })
        toast.push('تم تحديث كود الخصم', undefined, 'success')
      } else {
        await manageSubscriptionCouponCallable({ operation: 'create', coupon: payload })
        toast.push('تم إنشاء كود الخصم', undefined, 'success')
      }
      setOpen(false)
      resetForm()
      await fetchCoupons()
    } catch (err: any) {
      toast.push('فشل حفظ الكود', err?.message || 'تحقق من البيانات', 'error')
    } finally { setSaving(false) }
  }

  const toggleActive = async (c: Coupon) => {
    try {
      await manageSubscriptionCouponCallable({ operation: 'update', couponId: c.id, coupon: { active: !c.active } })
      toast.push(c.active ? 'تم تعطيل الكود' : 'تم تفعيل الكود', undefined, 'success')
      await fetchCoupons()
    } catch (err: any) { toast.push('فشل تحديث الحالة', err?.message, 'error') }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    const target = deleteTarget
    setSaving(true)
    try {
      const res: any = await manageSubscriptionCouponCallable({ operation: 'delete', couponId: target.id })
      if (res.data?.deleted) toast.push(`تم حذف الكود ${target.code} نهائياً`, undefined, 'success')
      else toast.push(`تم أرشفة الكود ${target.code} (له استخدامات سابقة)`, undefined, 'success')
      setDeleteTarget(null)
      await fetchCoupons()
    } catch (err: any) { toast.push('فشل الحذف', err?.message, 'error') }
    finally { setSaving(false) }
  }

  const openUsage = async (c: Coupon) => {
    setUsageOpen(c)
    setUsages([])
    setUsagesLoading(true)
    try {
      const res: any = await getSubscriptionCouponRedemptionsCallable({ couponId: c.id })
      setUsages(res.data?.redemptions || [])
    } catch (err: any) {
      toast.push('تعذر تحميل الاستخدامات', err?.message, 'error')
      setUsages([])
    } finally { setUsagesLoading(false) }
  }

  return (
    <div className="platform-operations platform-coupons-page">
      <PageHeader
        title="كوبونات الاشتراكات"
        subtitle="أنشئ أكواد خصم لاشتراكات التجار وتحكم في استخدامها — خصم واحد لكل تاجر لكل كود (perMerchantLimit = 1)"
        actions={
          <div className="flex">
            <Button variant="outline" icon="sync" onClick={fetchCoupons}>تحديث</Button>
            <Button icon="add" onClick={openCreate}>+ كود خصم جديد</Button>
          </div>
        }
      />

      <div className="stats-grid mb-2">
        <StatsCard title="إجمالي الأكواد" value={stats.total} icon="confirmation_number" tone="primary" />
        <StatsCard title="الأكواد النشطة" value={stats.active} icon="verified" tone="green" />
        <StatsCard title="الأكواد المنتهية" value={stats.expired} icon="cancel" tone="red" />
        <StatsCard title="إجمالي الاستخدامات" value={stats.totalUses} icon="bar_chart" tone="violet" />
      </div>

      <Card className="mb-2">
        <div className="flex" style={{ gap: 8, flexWrap: 'wrap' }}>
          {[
            { value: 'all', label: `الكل (${coupons.filter((c) => !isArchived(c)).length})` },
            { value: 'active', label: `نشط (${stats.active})` },
            { value: 'disabled', label: `موقوف (${coupons.filter((c) => c.active === false && !isArchived(c)).length})` },
            { value: 'expired', label: `منتهي (${stats.expired})` },
            { value: 'archived', label: `مؤرشف (${stats.archived})` },
          ].map((tab) => (
            <Button key={tab.value} variant={filter === tab.value ? 'primary' : 'ghost'} size="sm" onClick={() => setFilter(tab.value as any)}>{tab.label}</Button>
          ))}
        </div>
        <p className="muted small" style={{ marginTop: 8 }}>يمكن لكل تاجر استخدام نفس الكود <strong>مرة واحدة فقط</strong>. perMerchantLimit = 1 (ثابت حسب سياسة Matjari).</p>
      </Card>

      <Card title="قائمة كوبونات الاشتراكات">
        {loading ? <p className="muted small">جاري التحميل...</p> : filtered.length === 0 ? (
          <EmptyState icon="sell" title="لا توجد أكواد" description={filter === 'all' ? 'أنشئ أول كود خصم للاشتراكات' : `لا توجد أكواد في حالة "${filter}"`} />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <Table
              cardMode
              rows={filtered}
              columns={[
                { key: 'code', header: 'الكود', render: (c: Coupon) => <strong className="monospace">{c.code}</strong> },
                { key: 'name', header: 'الاسم', render: (c: Coupon) => <span>{c.name || '—'}</span> },
                { key: 'discountType', header: 'النوع', render: (c: Coupon) => <Badge tone={c.discountType === 'fixed' ? 'blue' : 'violet'}>{c.discountType === 'fixed' ? 'مبلغ' : 'نسبة'}</Badge> },
                { key: 'discountValue', header: 'القيمة', render: (c: Coupon) => c.discountType === 'fixed' ? formatPriceEgp(Number(c.discountValue)) : `${c.discountValue}%` },
                { key: 'plans', header: 'الباقات', render: (c: Coupon) => (c.applicablePlanIds || []).map((id: string) => id.replace('plan-', '').toUpperCase()).join(', ') || '—' },
                { key: 'billing', header: 'الدورة', render: (c: Coupon) => (c.applicableBillingCycles || []).join(', ') || '—' },
                { key: 'status', header: 'الحالة', render: (c: Coupon) => {
                  if (isArchived(c)) return <Badge tone="slate">مؤرشف</Badge>
                  if (isExpired(c)) return <Badge tone="red">منتهي</Badge>
                  return c.active === false ? <Badge tone="slate">موقوف</Badge> : <Badge tone="green">نشط</Badge>
                } },
                { key: 'uses', header: 'الاستخدام', render: (c: Coupon) => `${c.redemptionCount || 0}` },
                { key: 'max', header: 'الحد الأقصى', render: (c: Coupon) => c.globalMaxRedemptions != null ? String(c.globalMaxRedemptions) : c.maxRedemptions != null ? String(c.maxRedemptions) : '—' },
                { key: 'startsAt', header: 'البداية', render: (c: Coupon) => c.startsAt ? formatDate(c.startsAt) : '—' },
                { key: 'expiresAt', header: 'الانتهاء', render: (c: Coupon) => c.expiresAt ? formatDate(c.expiresAt) : '—' },
                { key: 'createdAt', header: 'الإنشاء', render: (c: Coupon) => c.createdAt ? formatDate(c.createdAt) : '—' },
                { key: 'actions', header: 'الإجراءات', render: (c: Coupon) => (
                  <div className="flex" style={{ gap: 4, flexWrap: 'wrap' }}>
                    <Button size="sm" variant="soft" onClick={() => openEdit(c)}>تعديل</Button>
                    <Button size="sm" variant={c.active === false ? 'outline' : 'ghost'} onClick={() => toggleActive(c)}>{c.active === false ? 'تفعيل' : 'إيقاف'}</Button>
                    <Button size="sm" variant="outline" onClick={() => openUsage(c)}>الاستخدام</Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(c)}>حذف</Button>
                  </div>
                ) },
              ]}
            />
          </div>
        )}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title={editingId ? 'تعديل كود الخصم' : 'كود خصم جديد'} footer={<Fragment><Button variant="ghost" onClick={() => { setOpen(false); resetForm() }}>إلغاء</Button><Button loading={saving} onClick={save}>{editingId ? 'تحديث' : 'إنشاء'}</Button></Fragment>}>
        <div className="grid grid-2">
          <Input label="الكود" value={form.code} onChange={(v) => setForm({ ...form, code: v.toUpperCase() })} placeholder="WELCOME30" hint="3-20 حرف إنجليزي/أرقام/-/_" required />
          <Input label="الاسم" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="خصم ترحيبي 30%" required />
        </div>
        <Textarea label="الوصف" value={form.description} onChange={(v) => setForm({ ...form, description: v })} rows={2} placeholder="وصف داخلي للكود" />
        <div className="grid grid-2">
          <label className="field">
            <span className="field-label">نوع الخصم</span>
            <select className="input" value={form.discountType} onChange={(e) => setForm({ ...form, discountType: (e.target as HTMLSelectElement).value as any })}>
              <option value="percentage">نسبة مئوية</option>
              <option value="fixed">مبلغ ثابت</option>
            </select>
          </label>
          <Input label={form.discountType === 'percentage' ? 'القيمة % (1-99)' : 'القيمة (ج.م)'} type="number" value={form.discountValue} onChange={(v) => setForm({ ...form, discountValue: Number(v) })} hint={form.discountType === 'percentage' ? 'الحد الأقصى 99%' : 'يجب أن يبقى المبلغ النهائي ≥1 ج.م'} required />
        </div>
        <div className="field">
          <span className="field-label">الباقات المسموحة</span>
          <div className="flex" style={{ gap: 12, flexWrap: 'wrap' }}>
            {['plan-basic', 'plan-starter', 'plan-growth', 'plan-pro'].map((pid) => (
              <label key={pid} className="flex" style={{ gap: 6, alignItems: 'center' }}>
                <input type="checkbox" checked={form.applicablePlanIds.includes(pid)} onChange={(e) => {
                  const checked = (e.target as HTMLInputElement).checked
                  setForm({ ...form, applicablePlanIds: checked ? [...form.applicablePlanIds, pid] : form.applicablePlanIds.filter((id) => id !== pid) })
                }} />
                <span>{pid.replace('plan-', '').toUpperCase()}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="field">
          <span className="field-label">دورة الدفع</span>
          <div className="flex" style={{ gap: 12 }}>
            {(['monthly', 'yearly'] as const).map((bc) => (
              <label key={bc} className="flex" style={{ gap: 6, alignItems: 'center' }}>
                <input type="checkbox" checked={form.applicableBillingCycles.includes(bc)} onChange={(e) => {
                  const checked = (e.target as HTMLInputElement).checked
                  setForm({ ...form, applicableBillingCycles: checked ? [...form.applicableBillingCycles, bc] : form.applicableBillingCycles.filter((x) => x !== bc) })
                }} />
                <span>{bc === 'monthly' ? 'شهري' : 'سنوي'}</span>
              </label>
            ))}
          </div>
          <p className="muted small">الكود للدورة الأولى فقط — لا يتكرر شهرياً ولا عند التجديد أو تغيير الباقة.</p>
        </div>
        <div className="grid grid-2">
          <Input type="date" label="تاريخ البداية (اختياري)" value={form.startsAt} onChange={(v) => setForm({ ...form, startsAt: v })} />
          <Input type="date" label="تاريخ الانتهاء (اختياري)" value={form.expiresAt} onChange={(v) => setForm({ ...form, expiresAt: v })} />
        </div>
        <div className="grid grid-2">
          <Input label="الحد الإجمالي للاستخدام (اختياري)" type="number" value={form.globalMaxRedemptions} onChange={(v) => setForm({ ...form, globalMaxRedemptions: v })} hint="فارغ = بلا حد" />
          <Input label="الشريك/المصدر (اختياري)" value={form.partner} onChange={(v) => setForm({ ...form, partner: v })} placeholder="wasla / حملة" />
        </div>
        <Textarea label="ملاحظات داخلية (اختياري)" value={form.internalNotes} onChange={(v) => setForm({ ...form, internalNotes: v })} rows={2} />
        <div className="field" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Toggle checked={form.active} onChange={(v) => setForm({ ...form, active: v })} label="مفعل" />
          <span className="muted small">لكل تاجر استخدام واحد فقط لنفس الكود (perMerchantLimit = 1) — ثابت</span>
        </div>
      </Modal>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="تأكيد الحذف" footer={<Fragment><Button variant="ghost" onClick={() => setDeleteTarget(null)}>إلغاء</Button><Button variant="primary" loading={saving} onClick={confirmDelete}>تأكيد الحذف</Button></Fragment>}>
        {deleteTarget && (
          <div>
            <p>هل تريد حذف كود الخصم <strong>{deleteTarget.code}</strong>؟</p>
            {Number(deleteTarget.redemptionCount || 0) > 0 ? (
              <p className="muted small" style={{ color: '#b45309' }}>هذا الكود له {deleteTarget.redemptionCount} استخدام سابق. سيتم أرشفته (active=false, archived=true) بدل الحذف النهائي للحفاظ على السجلات المالية.</p>
            ) : (
              <p className="muted small">هذا الكود لم يُستخدم بعد — سيتم حذفه نهائياً.</p>
            )}
            <p className="muted small">بعد الحذف/الأرشفة لن يظهر في القائمة الافتراضية ولن يمكن تطبيقه في اشتراك جديد, لكن السجلات التاريخية تظل محفوظة.</p>
          </div>
        )}
      </Modal>

      <Modal open={!!usageOpen} onClose={() => setUsageOpen(null)} title={`استخدامات الكود ${usageOpen?.code || ''}`} footer={<Button variant="ghost" onClick={() => setUsageOpen(null)}>إغلاق</Button>}>
        {usagesLoading ? <p className="muted small">جاري التحميل...</p> : usages.length === 0 ? <p className="muted small">لا توجد استخدامات بعد.</p> : (
          <div style={{ overflowX: 'auto' }}>
            <Table
              cardMode
              rows={usages}
              columns={[
                { key: 'merchantId', header: 'التاجر', render: (r: any) => <span className="monospace small">{String(r.merchantId || '').slice(0, 12)}...</span> },
                { key: 'planId', header: 'الباقة', render: (r: any) => (r.planId || '—').replace('plan-', '').toUpperCase() },
                { key: 'billingCycle', header: 'الدورة', render: (r: any) => r.billingCycle || '—' },
                { key: 'originalPrice', header: 'السعر الأصلي', render: (r: any) => formatPriceEgp(Number(r.originalPrice || 0)) },
                { key: 'discountAmount', header: 'الخصم', render: (r: any) => formatPriceEgp(Number(r.discountAmount || 0)) },
                { key: 'finalPrice', header: 'النهائي', render: (r: any) => formatPriceEgp(Number(r.finalPrice || 0)) },
                { key: 'redeemedAt', header: 'التاريخ', render: (r: any) => r.redeemedAt ? formatDate(r.redeemedAt) : r.createdAt ? formatDate(r.createdAt) : '—' },
                { key: 'status', header: 'الحالة', render: (r: any) => {
                  const s = String(r.status || '').toUpperCase()
                  if (s === 'REDEEMED') return <Badge tone="green">REDEEMED</Badge>
                  if (s === 'RESERVED') return <Badge tone="amber">RESERVED</Badge>
                  if (s === 'RELEASED' || s === 'FAILED') return <Badge tone="red">{s}</Badge>
                  return <Badge tone="slate">{s || '—'}</Badge>
                } },
              ]}
            />
          </div>
        )}
      </Modal>
    </div>
  )
}
export default PlatformSubscriptionCoupons
