import { FunctionalComponent } from 'preact'
import { useState } from 'preact/hooks'
import { Link } from 'wouter'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { StatsCard } from '../../shared/components/ui/StatsCard'
import { Card } from '../../shared/components/ui/Card'
import { Badge } from '../../shared/components/ui/Badge'
import { Button } from '../../shared/components/ui/Button'
import { Table } from '../../shared/components/ui/Table'
import { Toggle } from '../../shared/components/ui/Toggle'
import { LineChart } from '../../shared/components/charts/LineChart'
import { useStore } from '../../shared/hooks/useStore'
import { useAuth } from '../../shared/hooks/useAuth'
import { useCollection } from '../../shared/hooks/useCollection'
import { useSubscription } from '../../shared/hooks/useSubscription'
import { useToast } from '../../shared/hooks/useToast'
import { Loading } from '../../shared/components/ui/Loading'
import { EmptyState } from '../../shared/components/ui/EmptyState'
import { UsageCard } from '../../shared/components/subscription/UsageCard'
import { formatCurrency, timeAgo } from '../../shared/utils/format'
import { storePublicUrl } from '../../shared/utils/store-url'
import { STATUS_LABELS, STATUS_COLORS } from '../../shared/utils/constants'
import { setStorePublishedCallable } from '../../shared/services/auth'
import type { Order, Product, StoreLink } from '../../shared/types'
import { Icon } from '../../shared/components/ui/Icon'

interface ChecklistStep {
  done: boolean
  label: string
  hint?: string
  to?: string
}

export const MerchantDashboard: FunctionalComponent = () => {
  const { store } = useStore()
  const { user } = useAuth()
  const toast = useToast()
  const storeId = store?.id || ''
  const [publishing, setPublishing] = useState(false)

  const isOwner = user?.role === 'merchant'
  const perms = user?.permissions || []
  const canOrders = isOwner || perms.includes('orders:view')
  const canProducts = isOwner || perms.includes('products:view')
  const canCustomers = isOwner || perms.includes('customers:view')
  const canAnalytics = isOwner || perms.includes('reports:view')
  const canLinks = isOwner || perms.includes('sales_links:view')

  const ordersRes = useCollection<Order>('orders', { storeId, orderBy: { field: 'createdAt' } }, canOrders)
  const productsRes = useCollection<Product>('products', { storeId }, canProducts)
  const customersRes = useCollection('customers', { storeId }, canCustomers)
  const analyticsRes = useCollection<any>('analytics', { storeId }, canAnalytics)
  const linksRes = useCollection<StoreLink>('storeLinks', { storeId }, canLinks)

  const orders = ordersRes.data
  const products = productsRes.data
  const customers = customersRes.data
  const analytics = analyticsRes.data
  const links = linksRes.data

  const subState = useSubscription(isOwner ? storeId : '')
  const subscription = subState.subscription
  const plan = subState.plan
  const subStatus = subState.status
  const trialRemaining = subState.trialRemaining

  if (ordersRes.loading || productsRes.loading || customersRes.loading || analyticsRes.loading || linksRes.loading) {
    return <Loading />
  }

  const dayStart = new Date()
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date()
  dayEnd.setHours(23, 59, 59, 999)
  const todayOrders = orders.filter((o) => {
    const ts = o.createdAt?.seconds
    if (!ts) return false
    const d = new Date(ts * 1000)
    return d >= dayStart && d <= dayEnd
  })
  const todayRevenue = todayOrders.filter((o) => o.status === 'DELIVERED').reduce((s, o) => s + o.totalPrice, 0)
  const pendingOrders = orders.filter((o) => ['NEW', 'CONTACTED', 'PROCESSING', 'SHIPPED'].includes(o.status))
  const activeProducts = products.filter((p) => p.active).length
  const lowStock = products.filter((p) => p.stock <= (p.lowStockThreshold ?? 5) && p.active)

  const last14 = Array.from({ length: 14 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (13 - i))
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const revenueSeries = last14.map((key) => analytics.filter((a) => a.date === key).reduce((s, a) => s + (a.revenue || 0), 0))
  const ordersSeries = last14.map((key) => analytics.filter((a) => a.date === key).reduce((s, a) => s + (a.orders || 0), 0))

  const copyLink = async () => {
    if (!store) return
    const url = storePublicUrl(store)
    if (!url) {
      toast.push('رابط المتجر غير متاح بعد', 'حدد رابطاً صالحاً للمتجر من الإعدادات أولاً', 'error')
      return
    }
    try {
      await navigator.clipboard.writeText(url)
      toast.push('تم نسخ الرابط', url, 'success')
    } catch {
      toast.push('تعذر نسخ الرابط', undefined, 'error')
    }
  }

  const togglePublish = async (v: boolean) => {
    if (!store) return
    setPublishing(true)
    try {
      await setStorePublishedCallable({ storeId: store.id, published: v })
      toast.push(v ? 'تم نشر متجرك' : 'تم إخفاء متجرك', undefined, 'success')
    } catch (err: any) {
      toast.push('فشل تحديث حالة النشر', err?.message || 'حدث خطأ غير متوقع', 'error')
    } finally {
      setPublishing(false)
    }
  }

  const steps: ChecklistStep[] = [
    {
      done: !isOwner || subStatus === 'active',
      label: isOwner
        ? subStatus === 'active'
          ? 'اشتراكك مفعل'
          : subStatus === 'trialing'
            ? 'جرب باقتك مجاناً'
            : 'فعل اشتراكك'
        : 'اشتراكك مفعل',
      hint: !isOwner
        ? undefined
        : subStatus === 'active'
          ? undefined
          : subStatus === 'trialing'
            ? trialRemaining ? `تجربتك المجانية نشطة — ${trialRemaining}` : 'تجربتك المجانية نشطة'
            : subStatus === 'expired'
              ? 'انتهت تجربتك المجانية — فعّل باقتك لاستئناف البيع'
              : subStatus === 'pending'
                ? 'بانتظار مراجعة طلب التفعيل'
                : 'تواصل مع المنصة لتفعيل الباقة',
      to: '/dashboard/subscription',
    },
    { done: activeProducts > 0, label: 'أضف أول منتج', hint: activeProducts === 0 ? 'لا توجد منتجات بعد' : `${activeProducts} منتج`, to: '/dashboard/products' },
    { done: !!store?.published, label: 'انشر متجرك', hint: store?.published ? 'متجرك منشور' : 'المتجر مسودة حالياً', to: '/dashboard/settings' },
  ]
  const allDone = steps.every((s) => s.done)

  return (
    <div>
      <PageHeader
        title={`مرحباً بك في ${store?.name || 'متجرك'}`}
        subtitle="نظرة عامة على أداء متجرك اليوم"
        actions={
          store && (
            <div className="flex flex-gap-sm flex-wrap">
              <Button variant="ghost" icon="link" onClick={copyLink} disabled={!storePublicUrl(store)} title={!storePublicUrl(store) ? 'رابط المتجر غير متاح بعد' : undefined}>
                نسخ الرابط
              </Button>
              <a href={`/store/${store.slug}`} target="_blank" rel="noreferrer">
                <Button variant="outline" icon="store">عرض المتجر</Button>
              </a>
            </div>
          )
        }
      />

      <Card title={allDone ? 'متجرك جاهز' : 'ابدأ تشغيل متجرك'} subtitle={allDone ? 'أنجزت كل خطوات الإطلاق' : 'أكمل الخطوات التالية لنشر متجرك'} className="mb-2">
        <div className="list-row mb-1" style={{ paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
          <div>
            <span className="font-semibold">حالة المتجر</span>
            <div className="muted small">{store?.published ? 'متجرك منشور ويمكنه استقبال الطلبات' : 'المتجر مسودة — غير متاح للشراء بعد'}</div>
          </div>
          {store?.published ? <Badge tone="green">🟢 منشور</Badge> : <Badge tone="amber">🟡 مسودة</Badge>}
        </div>
        <div className="checklist">
          {steps.map((s, i) => (
            <div key={i} className={`checklist-item ${s.done ? 'checklist-item--done' : ''}`}>
              <span className={`checklist-mark ${s.done ? 'checklist-mark--done' : ''}`}>
                {s.done ? <Icon name="check" /> : i + 1}
              </span>
              <div className="grow">
                <div className="font-semibold">{s.label}</div>
                {s.hint && <div className="muted small">{s.hint}</div>}
              </div>
              {!s.done && s.to && (
                <Link href={s.to}>
                  <Button variant="soft" size="sm" icon="arrow_forward">ابدأ</Button>
                </Link>
              )}
            </div>
          ))}
          {allDone && store && (
            <div className="checklist-item">
              <span className="checklist-mark checklist-mark--done">
                <Icon name="link" />
              </span>
              <div className="grow">
                <div className="font-semibold">شارك رابط متجرك</div>
                <div className="muted small" dir="ltr">{storePublicUrl(store) || 'لم يتم إنشاء رابط المتجر بعد'}</div>
              </div>
              <Button variant="soft" size="sm" icon="link" onClick={copyLink} disabled={!storePublicUrl(store)} title={!storePublicUrl(store) ? 'رابط المتجر غير متاح بعد' : undefined}>نسخ</Button>
            </div>
          )}
        </div>
        {store && isOwner && (
          <div className="flex-between mt-2" style={{ paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <div>
              <span className="font-semibold">نشر المتجر</span>
              <div className="muted small">{store.published ? 'متجرك ظاهر للعملاء ويمكنه استقبال الطلبات' : 'الطلبات متوقفة حتى نشر المتجر'}</div>
            </div>
            <div className="flex" style={{ gap: 12, alignItems: 'center' }}>
              <Link href="/dashboard/themes"><Button variant="ghost" size="sm" icon="palette">المظهر والقالب</Button></Link>
              <Toggle checked={!!store.published} onChange={togglePublish} disabled={publishing} label="منشور" />
            </div>
          </div>
        )}
      </Card>

      {(subStatus === 'active' || subStatus === 'trialing') && (
        <div className="grid grid-2 mb-2">
          {subStatus === 'trialing' && subscription && (
            <Card title="تجربتك المجانية" actions={<Link href="/dashboard/subscription"><Button variant="ghost" size="sm" icon="arrow_forward">فعّل باقتك</Button></Link>}>
              <div className="trial-countdown">
                <Icon name="hourglass_top" />
                <div>
                  <strong>{trialRemaining || 'قاربت على الانتهاء'}</strong>
                  <p className="muted small">تظل باقتك فعالة بكامل المزايا طوال الفترة التجريبية.</p>
                </div>
              </div>
            </Card>
          )}
          <UsageCard subscription={subscription} plan={plan} title="استهلاك طلبات الدورة" compact />
        </div>
      )}

      <div className="stats-grid">
        {canOrders && <StatsCard title="طلبات اليوم" value={todayOrders.length} icon="receipt_long" tone="primary" />}
        {canOrders && <StatsCard title="المبيعات" value={todayRevenue} currency icon="payments" tone="green" />}
        {canOrders && <StatsCard title="طلبات معلقة" value={pendingOrders.length} icon="pending_actions" tone="amber" />}
        {canProducts && <StatsCard title="المنتجات" value={activeProducts} icon="inventory_2" tone="blue" />}
        {canCustomers && <StatsCard title="العملاء" value={customers.length} icon="groups" tone="violet" />}
      </div>

      {canAnalytics && (
        <div className="grid grid-2 mb-2">
          <Card title="الإيرادات (آخر 14 يوم)">
            <LineChart values={revenueSeries} height={200} />
          </Card>
          <Card title="الطلبات (آخر 14 يوم)">
            <LineChart values={ordersSeries} color="var(--success)" height={200} />
          </Card>
        </div>
      )}

      {canProducts && lowStock.length > 0 && (
        <Card title="تنبيهات المخزون" className="mb-2" actions={<Link href="/dashboard/products"><Button variant="ghost" size="sm" icon="arrow_forward">إدارة المخزون</Button></Link>}>
          {lowStock.slice(0, 5).map((p) => (
            <div key={p.id} className="flex-between mb-1">
              <span>{p.name}</span>
              <Badge tone={p.stock === 0 ? 'red' : 'amber'}>المتبقي: {p.stock}</Badge>
            </div>
          ))}
        </Card>
      )}

      {canOrders ? (
        <Card title="أحدث الطلبات" subtitle={`${orders.length} طلب إجمالي`}>
          {orders.length === 0 ? (
            <EmptyState
              title="لا توجد طلبات بعد"
              description="عند وصول طلبات من متجرك ستظهر هنا مباشرة."
              icon="receipt_long"
              action={store ? <a href={`/store/${store.slug}`} target="_blank" rel="noreferrer"><Button variant="outline" size="sm">عرض متجرك</Button></a> : null}
            />
          ) : (
            <Table cardMode
              columns={[
                { key: 'orderNumber', header: 'الرقم', render: (o: Order) => <Link href={`/dashboard/orders/${o.id}`}><span className="monospace">{o.orderNumber}</span></Link> },
                { key: 'customerName', header: 'العميل' },
                { key: 'totalPrice', header: 'الإجمالي', render: (o: Order) => formatCurrency(o.totalPrice) },
                { key: 'status', header: 'الحالة', render: (o: Order) => <Badge tone={STATUS_COLORS[o.status as keyof typeof STATUS_COLORS]}>{STATUS_LABELS[o.status as keyof typeof STATUS_LABELS] || o.status}</Badge> },
                { key: 'createdAt', header: 'التاريخ', render: (o: Order) => <span className="muted">{timeAgo(o.createdAt)}</span> },
              ]}
              rows={orders.slice(0, 8)}
            />
          )}
        </Card>
      ) : (
        <Card title="أحدث الطلبات">
          <EmptyState
            title="صلاحيات غير كافية"
            description="حسابك لا يملك صلاحية عرض الطلبات. تواصل مع مالك المتجر لتفعيلها."
            icon="lock"
          />
        </Card>
      )}

      {canLinks && links.length > 0 && (
        <Card title="أداء روابط البيع" subtitle="أفضل الروابط حسب الإيرادات" className="mt-2">
          <Table cardMode
            columns={[
              { key: 'title', header: 'الرابط' },
              { key: 'visits', header: 'الزيارات', render: (l: StoreLink) => <Badge>{l.visits || 0}</Badge> },
              { key: 'ordersCount', header: 'الطلبات', render: (l: StoreLink) => <Badge tone="indigo">{l.ordersCount || 0}</Badge> },
              { key: 'totalRevenue', header: 'الإيرادات', render: (l: StoreLink) => formatCurrency(l.totalRevenue || 0) },
            ]}
            rows={[...links].sort((a, b) => (b.totalRevenue || 0) - (a.totalRevenue || 0)).slice(0, 5)}
          />
        </Card>
      )}
    </div>
  )
}
export default MerchantDashboard
