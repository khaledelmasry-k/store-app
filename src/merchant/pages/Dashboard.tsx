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
import { Progress } from '../../shared/components/ui/Progress'
import { LineChart } from '../../shared/components/charts/LineChart'
import { useStore } from '../../shared/hooks/useStore'
import { useAuth } from '../../shared/hooks/useAuth'
import { useCollection } from '../../shared/hooks/useCollection'
import { useToast } from '../../shared/hooks/useToast'
import { Loading } from '../../shared/components/ui/Loading'
import { EmptyState } from '../../shared/components/ui/EmptyState'
import { formatCurrency, formatNumber, timeAgo } from '../../shared/utils/format'
import { storePublicUrl } from '../../shared/utils/store-url'
import { STATUS_LABELS, STATUS_COLORS } from '../../shared/utils/constants'
import { storesService } from '../../shared/services/stores'
import type { Order, Product, StoreLink, Subscription, SubscriptionPlan } from '../../shared/types'

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
  const canOrders = isOwner || perms.includes('orders:manage')
  const canProducts = isOwner || perms.includes('products:manage')
  const canCustomers = isOwner || perms.includes('customers:manage')
  const canAnalytics = isOwner || perms.includes('reports:view')
  const canLinks = isOwner || perms.includes('sales_links:view')

  const ordersRes = useCollection<Order>('orders', { storeId, orderBy: { field: 'createdAt' } }, canOrders)
  const productsRes = useCollection<Product>('products', { storeId }, canProducts)
  const customersRes = useCollection('customers', { storeId }, canCustomers)
  const analyticsRes = useCollection<any>('analytics', { storeId }, canAnalytics)
  const linksRes = useCollection<StoreLink>('storeLinks', { storeId }, canOrders)
  const subsRes = useCollection<Subscription>('subscriptions', { storeId }, isOwner)
  const plansRes = useCollection<SubscriptionPlan>('plans', {}, isOwner)

  const orders = ordersRes.data
  const products = productsRes.data
  const customers = customersRes.data
  const analytics = analyticsRes.data
  const links = linksRes.data
  const subs = subsRes.data
  const plans = plansRes.data

  if (ordersRes.loading || productsRes.loading || customersRes.loading || analyticsRes.loading || linksRes.loading) {
    return <Loading />
  }

  const latestSub = [...subs].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))[0]
  const plan = latestSub ? plans.find((p) => p.id === latestSub.planId) : null
  const orderLimit = plan?.orderLimitPerMonth || 0
  const ordersUsed = latestSub?.ordersUsed || 0
  const usagePercent = orderLimit > 0 ? Math.min(100, Math.round((ordersUsed / orderLimit) * 100)) : 0

  const todayOrders = orders.filter((o) => o.createdAt?.seconds)
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
      await storesService.update(store.id, { published: v })
      toast.push(v ? 'تم نشر متجرك' : 'تم إخفاء متجرك', undefined, 'success')
    } catch (err: any) {
      toast.push('فشل تحديث حالة النشر', err?.message || 'حدث خطأ غير متوقع', 'error')
    } finally {
      setPublishing(false)
    }
  }

  const steps: ChecklistStep[] = [
    {
      done: latestSub?.status === 'active',
      label: latestSub?.status === 'active' ? 'اشتراكك مفعل' : 'فعل اشتراكك',
      hint: latestSub?.status === 'pending' ? 'بانتظار موافقة المنصة' : latestSub?.status === 'active' ? undefined : 'تواصل مع المنصة لتفعيل الباقة',
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
            <div className="flex flex-gap-sm">
              <Button variant="ghost" icon="link" onClick={copyLink}>نسخ الرابط</Button>
              <a href={`/store/${store.slug}`} target="_blank" rel="noreferrer">
                <Button variant="outline" icon="store">عرض المتجر</Button>
              </a>
            </div>
          )
        }
      />

      <Card title={allDone ? 'متجرك جاهز' : 'ابدأ تشغيل متجرك'} subtitle={allDone ? 'أنجزت كل خطوات الإطلاق' : 'أكمل الخطوات التالية لنشر متجرك'} className="mb-2">
        <div className="checklist">
          {steps.map((s, i) => (
            <div key={i} className={`checklist-item ${s.done ? 'checklist-item--done' : ''}`}>
              <span className={`checklist-mark ${s.done ? 'checklist-mark--done' : ''}`}>
                <span className="material-symbols-outlined">{s.done ? 'check' : i + 1}</span>
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
                <span className="material-symbols-outlined">link</span>
              </span>
              <div className="grow">
                <div className="font-semibold">شارك رابط متجرك</div>
                <div className="muted small">{storePublicUrl(store)}</div>
              </div>
              <Button variant="soft" size="sm" icon="link" onClick={copyLink}>نسخ</Button>
            </div>
          )}
        </div>
        {store && isOwner && (
          <div className="list-row mt-2" style={{ paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <div>
              <span className="font-semibold">نشر المتجر</span>
              <div className="muted small">{store.published ? 'متجرك ظاهر للعملاء ويمكنه استقبال الطلبات' : 'الطلبات متوقفة حتى نشر المتجر'}</div>
            </div>
            <Toggle checked={!!store.published} onChange={togglePublish} disabled={publishing} label="منشور" />
          </div>
        )}
      </Card>

      {latestSub?.status === 'active' && orderLimit > 0 && (
        <Card title="استهلاك طلبات الدورة" className="mb-2" actions={<Link href="/dashboard/subscription"><Button variant="ghost" size="sm" icon="arrow_forward">تفاصيل</Button></Link>}>
          <div className="flex-between small mb-1">
            <span className="font-semibold">{formatNumber(ordersUsed)} / {formatNumber(orderLimit)} طلب</span>
            <span className="muted">{usagePercent}%</span>
          </div>
          <Progress value={ordersUsed} max={orderLimit} tone={usagePercent >= 100 ? 'red' : usagePercent >= 80 ? 'amber' : 'primary'} />
          <div className="muted small mt-1">{usagePercent >= 100 ? 'استنفدت حد الطلبات لهذه الدورة.' : `لديك ${formatNumber(Math.max(0, orderLimit - ordersUsed))} طلب متبقي.`}</div>
        </Card>
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
