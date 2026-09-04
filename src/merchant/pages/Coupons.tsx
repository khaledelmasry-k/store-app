import { FunctionalComponent, Fragment } from 'preact'
import { useState } from 'preact/hooks'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { Button } from '../../shared/components/ui/Button'
import { Modal } from '../../shared/components/ui/Modal'
import { Input } from '../../shared/components/ui/Input'
import { Select } from '../../shared/components/ui/Select'
import { Toggle } from '../../shared/components/ui/Toggle'
import { ConfirmDialog } from '../../shared/components/ui/ConfirmDialog'
import { FilterBar } from '../../shared/components/ui/FilterBar'
import { Pagination } from '../../shared/components/ui/Pagination'
import { EmptyState } from '../../shared/components/ui/EmptyState'
import { useStore } from '../../shared/hooks/useStore'
import { useSubscription } from '../../shared/hooks/useSubscription'
import { useCollection } from '../../shared/hooks/useCollection'
import { useToast } from '../../shared/hooks/useToast'
import { couponsService } from '../../shared/services/billing'
import { canUseFeature } from '../../shared/services/subscription'
import { formatCurrency, formatDate, normalizeDate } from '../../shared/utils/format'
import type { Coupon } from '../../shared/types'
import { Icon } from '../../shared/components/ui/Icon'
import './Coupons.css'

const PAGE_SIZE = 10

export const MerchantCoupons: FunctionalComponent = () => {
  const { store } = useStore()
  const storeId = store?.id || ''
  const couponsRes = useCollection<Coupon>('coupons', { storeId, orderBy: { field: 'createdAt' } })
  const coupons = couponsRes.data
  const { plan, loading: subscriptionLoading } = useSubscription(storeId)
  const couponsEnabled = canUseFeature('coupons', plan)
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Coupon | null>(null)
  const [form, setForm] = useState<Partial<Coupon>>({ type: 'percent', active: true })

  const filtered = coupons.filter((c) => {
    const q = query.trim().toLowerCase()
    const matchesQuery = !q || c.code.toLowerCase().includes(q)
    const matchesStatus = status === '' || (status === 'active' ? !!c.active : !c.active)
    return matchesQuery && matchesStatus
  })
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const submit = async () => {
    if (!couponsEnabled) {
      toast.push('ميزة مقفلة', 'الكوبونات متاحة بدايةً من خطة Starter.', 'error')
      return
    }
    if (!form.code || !form.value) {
      toast.push('أدخل الكود والقيمة', undefined, 'error')
      return
    }
    try {
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
    } catch (err: any) {
      toast.push('تعذر إنشاء الكوبون', err?.message || 'حدث خطأ غير متوقع', 'error')
    }
  }

  const toggleActive = async (c: Coupon, v: boolean) => {
    try {
      await couponsService.update(storeId, c.id, { active: v })
    } catch (err: any) {
      toast.push('تعذر تحديث حالة الكوبون', err?.message || 'حدث خطأ غير متوقع', 'error')
    }
  }

  const remove = async () => {
    if (!deleteTarget) return
    try {
      await couponsService.remove(storeId, deleteTarget.id)
      toast.push('تم حذف الكوبون')
    } catch (err: any) {
      toast.push('تعذر حذف الكوبون', err?.message || 'حدث خطأ غير متوقع', 'error')
    }
    setDeleteTarget(null)
  }

  const usage = (c: Coupon) => {
    if (!c.maxUses) return null
    const pct = Math.min(100, Math.round(((c.usedCount || 0) / c.maxUses) * 100))
    return { pct, label: `${c.usedCount || 0}/${c.maxUses}` }
  }

  const platformIssued = (c: Coupon) => c.source === 'platform' || c.createdByRole === 'superAdmin'
  const expired = (c: Coupon) => {
    const date = normalizeDate(c.expiresAt)
    return !!date && date.getTime() <= Date.now()
  }

  return (
    <div className="merchant-operations merchant-coupons-page">
      <PageHeader
        breadcrumb="إدارة العروض"
        title="إدارة القسائم"
        subtitle="أنشئ قسائمك وتابع قسائم إدارة المنصة في مكان واحد"
        actions={<Button icon="add" disabled={!couponsEnabled || subscriptionLoading} onClick={() => setOpen(true)}>إضافة قسيمة</Button>}
      />

      {!subscriptionLoading && !couponsEnabled && (
        <div className="coupon-locked-banner">
          <div className="coupon-locked-icon"><Icon name="lock" ariaHidden /></div>
          <div>
            <strong>ميزة متقدمة</strong>
            <p>هذه الميزة مقفلة حالياً. القسائم الحالية في وضع القراءة فقط.</p>
          </div>
          <a href="/dashboard/subscription"><Button variant="primary" icon="workspace_premium">ترقية الخطة</Button></a>
        </div>
      )}

      <Card className="mt-1">
        <FilterBar
          search={query}
          onSearch={(v) => { setQuery(v); setPage(1) }}
          searchPlaceholder="بحث بالكود أو النوع..."
          segments={[
            { label: 'الكل', value: '' },
            { label: 'مفعل', value: 'active' },
            { label: 'غير مفعل', value: 'inactive' },
          ]}
          activeSegment={status}
          onSegmentChange={(v) => { setStatus(v); setPage(1) }}
        />

        {coupons.length === 0 ? (
            <EmptyState
              title="لا توجد كوبونات"
              description="أنشئ أول كوبون لتقديم خصومات لعملائك."
              icon="local_offer"
              action={!couponsEnabled ? null : <Button icon="add" onClick={() => setOpen(true)}>إنشاء كوبون</Button>}
            />
          ) : (
            <div className="coupons-table">
              <table className="coupons-table-root">
                <thead>
                  <tr>
                    <th>الكود</th>
                    <th>النوع</th>
                    <th>القيمة</th>
                    <th>الحد الأدنى للطلب</th>
                    <th>عدد الاستخدامات</th>
                    <th>الانتهاء</th>
                    <th>المصدر</th>
                    <th className="center">الحالة</th>
                    <th className="actions">الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((c) => {
                    const u = usage(c)
                    const isPlatformCoupon = platformIssued(c)
                    const isExpired = expired(c)
                    return (
                      <tr key={c.id}>
                        <td className="font-bold"><span className="monospace">{c.code}</span></td>
                        <td><span className="muted">{c.type === 'percent' ? 'نسبة مئوية' : 'مبلغ ثابت'}</span></td>
                        <td className="font-medium">{c.type === 'percent' ? `${c.value}%` : formatCurrency(c.value)}</td>
                        <td><span className="muted">{formatCurrency(c.minOrder || 0)}</span></td>
                        <td>
                          {u ? (
                            <span className="coupon-usage">
                              <span className="coupon-usage-track"><span className="coupon-usage-fill" style={{ width: `${u.pct}%` }} /></span>
                              <span className="text-xs">{u.label}</span>
                            </span>
                          ) : (
                            <span className="muted">{c.usedCount || 0} / ∞</span>
                          )}
                        </td>
                        <td><span className="muted">{c.expiresAt ? formatDate(c.expiresAt) : 'بلا انتهاء'}</span></td>
                        <td><span className={isPlatformCoupon ? 'coupon-platform-source' : 'muted'}>{isPlatformCoupon ? 'إدارة المنصة' : 'التاجر'}</span></td>
                        <td className="center">
                          <Toggle checked={c.active && !isExpired} disabled={!couponsEnabled || isPlatformCoupon || isExpired} onChange={(v) => toggleActive(c, v)} />
                        </td>
                        <td className="actions">
                          <button type="button" className="icon-btn icon-btn-danger" disabled={!couponsEnabled || isPlatformCoupon} onClick={() => setDeleteTarget(c)} title={isPlatformCoupon ? 'تتم إدارة هذا الكوبون من المنصة' : 'حذف'}>
                            <Icon name="delete" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
      </Card>

      {filtered.length > PAGE_SIZE && (
        <Pagination page={page} totalPages={totalPages} total={filtered.length} pageSize={PAGE_SIZE} onPageChange={(p) => { setPage(p); window.scrollTo(0, 0) }} />
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="إنشاء قسيمة جديدة" footer={<Fragment><Button variant="ghost" onClick={() => setOpen(false)}>إلغاء</Button><Button onClick={submit} icon="check" disabled={!form.code || !form.value}>حفظ القسيمة</Button></Fragment>}>
        <div className="grid grid-2">
          <Input label="كود القسيمة" value={form.code || ''} onChange={(v) => setForm({ ...form, code: v.toUpperCase() })} placeholder="SAVE10" required />
          <Select label="النوع" value={form.type || 'percent'} onChange={(v) => setForm({ ...form, type: v as any })} options={[{ value: 'percent', label: 'نسبة مئوية (%)' }, { value: 'fixed', label: 'مبلغ ثابت' }]} />
        </div>
        <div className="grid grid-2">
          <Input label="القيمة" type="number" value={form.value || ''} onChange={(v) => setForm({ ...form, value: Number(v) })} required min={0} />
          <Input label="الحد الأدنى للطلب" type="number" value={form.minOrder || ''} onChange={(v) => setForm({ ...form, minOrder: Number(v) })} />
        </div>
        <Input label="الحد الأقصى للاستخدام (0 = غير محدود)" type="number" value={form.maxUses || ''} onChange={(v) => setForm({ ...form, maxUses: Number(v) })} min={0} />
        <Input label="تاريخ الانتهاء (اختياري)" type="date" value={typeof form.expiresAt === 'string' ? form.expiresAt : ''} onChange={(v) => setForm({ ...form, expiresAt: v || undefined } as any)} />
        <div className="coupon-modal-toggle">
          <span>تفعيل القسيمة</span>
          <Toggle checked={form.active ?? true} onChange={(v) => setForm({ ...form, active: v })} />
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onCancel={() => setDeleteTarget(null)} onConfirm={remove} title="حذف الكوبون" description={`سيتم حذف ${deleteTarget?.code}`} confirmLabel="حذف" />
    </div>
  )
}
export default MerchantCoupons
