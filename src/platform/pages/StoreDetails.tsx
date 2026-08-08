import { FunctionalComponent } from 'preact'
import { useState } from 'preact/hooks'
import { useDocument } from '../../shared/hooks/useDocument'
import { useCollection } from '../../shared/hooks/useCollection'
import { useToast } from '../../shared/hooks/useToast'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Breadcrumb } from '../../shared/components/ui/Breadcrumb'
import { Card } from '../../shared/components/ui/Card'
import { StatsCard } from '../../shared/components/ui/StatsCard'
import { Table } from '../../shared/components/ui/Table'
import { Badge } from '../../shared/components/ui/Badge'
import { Button } from '../../shared/components/ui/Button'
import { Input } from '../../shared/components/ui/Input'
import { Toggle } from '../../shared/components/ui/Toggle'
import { Progress } from '../../shared/components/ui/Progress'
import { EmptyState } from '../../shared/components/ui/EmptyState'
import { formatCurrency, formatDate, formatNumber } from '../../shared/utils/format'
import { storePublicUrl, ensureUniqueSlug } from '../../shared/utils/store-url'
import { STATUS_LABELS, STATUS_COLORS, SUBSCRIPTION_STATUS_LABELS, SUBSCRIPTION_STATUS_TONES, ORDER_USAGE_LABELS, ORDER_USAGE_TONES, usageLevelFor } from '../../shared/utils/constants'
import { storesService } from '../../shared/services/stores'
import { approveSubscriptionCallable } from '../../shared/services/auth'
import type { Store, Subscription, SubscriptionPlan, Order, Product } from '../../shared/types'

interface Props {
  id: string
}

export const PlatformStoreDetails: FunctionalComponent<Props> = ({ id }) => {
  const storeDoc = useDocument<Store>('stores', id)
  const store = storeDoc.data
  const toast = useToast()
  const [form, setForm] = useState<Partial<Store>>({})
  const [busy, setBusy] = useState(false)

  const subsRes = useCollection<Subscription>('subscriptions', store?.id ? { storeId: store.id } : {})
  const subs = subsRes.data
  const plansRes = useCollection<SubscriptionPlan>('plans', {})
  const plans = plansRes.data
  const ordersRes = useCollection<Order>('orders', store?.id ? { storeId: store.id } : {})
  const orders = ordersRes.data
  const productsRes = useCollection<Product>('products', store?.id ? { storeId: store.id } : {})
  const products = productsRes.data

  const latestSub = [...subs].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))[0]
  const plan = latestSub ? plans.find((p) => p.id === latestSub.planId) : null
  const orderLimit = plan?.orderLimitPerMonth || 0
  const ordersUsed = latestSub?.ordersUsed || 0
  const usagePercent = orderLimit > 0 ? Math.min(100, Math.round((ordersUsed / orderLimit) * 100)) : 0
  const usageLevel = usageLevelFor(usagePercent, orderLimit > 0)
  const remaining = orderLimit > 0 ? Math.max(0, orderLimit - ordersUsed) : null

  const save = async () => {
    if (!store?.id) return
    const patch: Record<string, unknown> = { ...form }
    // Keep slug and ref in sync so the public URL (/store/<slug>) always
    // resolves to the storefront, which looks stores up by slug.
    const candidate = String(patch.ref || store.ref || store.slug || '')
    const name = String(patch.name || store.name || '')
    if (patch.ref || patch.name) {
      const slug = await ensureUniqueSlug(candidate || name, store.id)
      patch.slug = slug
      patch.ref = slug
    }
    await storesService.update(store.id, patch)
    toast.push('تم حفظ التغييرات')
  }

  const approve = async () => {
    if (!latestSub || busy) return
    setBusy(true)
    try {
      await approveSubscriptionCallable({ subscriptionId: latestSub.id })
      toast.push('تمت الموافقة على الاشتراك', 'تم تفعيل حساب المتجر', 'success')
    } catch (err: any) {
      toast.push('فشل الموافقة', err?.message || 'حدث خطأ غير متوقع', 'error')
    } finally {
      setBusy(false)
    }
  }

  if (storeDoc.loading) return <div className="loading-screen"><span className="spinner spinner-lg" /></div>

  if (!store) {
    return (
      <div>
        <PageHeader title="تفاصيل المتجر" subtitle="غير موجود" />
        <EmptyState icon="storefront" title="المتجر غير موجود" />
      </div>
    )
  }

  return (
    <div>
      <Breadcrumb items={[{ label: 'التجار والمتاجر', href: '/platform/merchants' }, { label: store.name }]} />
      <PageHeader
        title={store.name}
        subtitle={storePublicUrl(store) || 'لم يتم إنشاء رابط المتجر بعد'}
        actions={
          <div className="flex" style={{ gap: 8 }}>
            {store.published ? <Badge tone="green">🟢 منشور</Badge> : <Badge tone="amber">🟡 مسودة</Badge>}
            {store.active ? (
              <a href={`/store/${store.slug}`} target="_blank" rel="noreferrer">
                <Button variant="outline" icon="store">عرض المتجر</Button>
              </a>
            ) : (
              <Badge tone="slate">موقوف</Badge>
            )}
          </div>
        }
      />

      <div className="stats-grid">
        <StatsCard title="الطلبات" value={orders.length} icon="receipt_long" tone="primary" />
        <StatsCard title="المبيعات" value={orders.filter((o) => o.status === 'DELIVERED').reduce((s, o) => s + o.totalPrice, 0)} currency icon="payments" tone="green" />
        <StatsCard title="المنتجات" value={products.length} icon="inventory_2" tone="blue" />
        <StatsCard title="استهلاك الطلبات" value={orderLimit > 0 ? `${ordersUsed} / ${orderLimit}` : '—'} icon="signal_cellular_alt" tone="amber" changeLabel={orderLimit > 0 ? `${usagePercent}%` : 'بدون حد'} />
      </div>

      <div className="grid grid-2 mb-2">
        <Card title="الاشتراك والاستخدام">
          {!latestSub ? (
            <p className="muted">لا يوجد اشتراك لهذا المتجر.</p>
          ) : (
            <div>
              <div className="list-row">
                <span>الباقة</span>
                <strong>{plan?.name || latestSub.planName || '—'}</strong>
              </div>
              <div className="list-row">
                <span>الحالة</span>
                <Badge tone={SUBSCRIPTION_STATUS_TONES[latestSub.status] || 'slate'}>{SUBSCRIPTION_STATUS_LABELS[latestSub.status] || latestSub.status}</Badge>
              </div>
              <div className="list-row">
                <span>بداية الاشتراك</span>
                <span>{formatDate(latestSub.startedAt)}</span>
              </div>
              <div className="list-row">
                <span>انتهاء الاشتراك</span>
                <span>{formatDate(latestSub.expiresAt)}</span>
              </div>
              {orderLimit > 0 && (
                <div className="mt-2">
                  <div className="flex-between small mb-1">
                    <span className="font-semibold">طلبات الدورة: {formatNumber(ordersUsed)} / {formatNumber(orderLimit)}</span>
                    <Badge tone={ORDER_USAGE_TONES[usageLevel]}>{ORDER_USAGE_LABELS[usageLevel]}</Badge>
                  </div>
                  <Progress value={ordersUsed} max={orderLimit} tone={usageLevel === 'reached' ? 'red' : usageLevel === 'near' || usageLevel === 'approaching' ? 'amber' : 'primary'} />
                  <div className="muted small mt-1">المتبقي: {formatNumber(remaining ?? 0)} — نسبة الاستخدام {usagePercent}%</div>
                </div>
              )}
              {latestSub.status === 'pending' && (
                <div className="mt-2">
                  <Button icon="check" loading={busy} onClick={approve}>الموافقة على الاشتراك</Button>
                </div>
              )}
            </div>
          )}
        </Card>

        <Card title="معلومات المتجر">
          <div className="grid grid-2">
            <Input label="اسم المتجر" value={form.name ?? store.name} onChange={(v) => setForm({ ...form, name: v })} />
            <Input label="رابط المتجر (Slug)" value={form.ref ?? store.ref} onChange={(v) => setForm({ ...form, ref: v })} hint="يُحدَّث تلقائياً عند الحفظ لمنع الازدواج" />
            <Input label="الهاتف" value={form.phone ?? store.phone} onChange={(v) => setForm({ ...form, phone: v })} />
            <Input label="العنوان" value={form.address ?? store.address} onChange={(v) => setForm({ ...form, address: v })} />
          </div>
          <div className="field mt-1">
            <Toggle checked={form.active ?? store.active} onChange={(v) => setForm({ ...form, active: v })} label="المتجر نشط" />
          </div>
          <div className="field mt-1">
            <Toggle checked={form.published ?? store.published} onChange={(v) => setForm({ ...form, published: v })} label="منشور للعملاء (يسمح بالطلبات)" />
          </div>
          <div className="flex flex-end mt-2">
            <Button variant="soft" icon="save" onClick={save}>حفظ التغييرات</Button>
          </div>
        </Card>
      </div>

      <Card title="الطلبات الأخيرة">
        <Table
          cardMode
          columns={[
            { key: 'orderNumber', header: 'الرقم' },
            { key: 'customerName', header: 'العميل' },
            { key: 'totalPrice', header: 'الإجمالي', render: (o: Order) => formatCurrency(o.totalPrice) },
            { key: 'status', header: 'الحالة', render: (o: Order) => <Badge tone={STATUS_COLORS[o.status as keyof typeof STATUS_COLORS]}>{STATUS_LABELS[o.status as keyof typeof STATUS_LABELS] || o.status}</Badge> },
            { key: 'createdAt', header: 'التاريخ', render: (o: Order) => <span className="muted">{formatDate(o.createdAt)}</span> },
          ]}
          rows={orders.slice(0, 10)}
        />
      </Card>
    </div>
  )
}
export default PlatformStoreDetails
