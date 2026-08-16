import { FunctionalComponent } from 'preact'
import { useState } from 'preact/hooks'
import { Link } from 'wouter'
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
import { orderItemRevenue } from '../../shared/utils/pricing'
import { storePublicUrl } from '../../shared/utils/store-url'
import { STATUS_LABELS, STATUS_COLORS } from '../../shared/utils/constants'
import { setStorePublishedCallable } from '../../shared/services/auth'
import type { Order, Product, ProductCost, StoreLink } from '../../shared/types'
import { Icon } from '../../shared/components/ui/Icon'
import './Dashboard.css'
import { InternalPageHeader, WorkspaceSection } from '../components/InternalWorkspace'
import '../components/InternalWorkspace.css'

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
  const costsRes = useCollection<ProductCost>('productCosts', { storeId }, canProducts)
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

  if (ordersRes.loading || productsRes.loading || costsRes.loading || customersRes.loading || analyticsRes.loading || linksRes.loading) {
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

  // Gross profit over completed (DELIVERED) orders, computed only over lines
  // whose product has a configured cost price (private productCosts data).
  const costByProduct = new Map(costsRes.data.map((c) => [c.id, c.costPrice]))
  const hasAnyCost = [...costByProduct.values()].some((c) => typeof c === 'number' && c >= 0)
  let totalProfit = 0
  let deliveredRevenue = 0
  let totalCost = 0
  for (const o of orders) {
    if (o.status !== 'DELIVERED') continue
    deliveredRevenue += o.totalPrice
    for (const it of o.items) {
      const cost = costByProduct.get(it.productId)
      if (typeof cost !== 'number' || cost < 0) continue
      const lineCost = Math.max(1, it.quantity || 1) * cost
      totalCost += lineCost
      totalProfit += orderItemRevenue(it) - lineCost
    }
  }
  const profitMargin = deliveredRevenue > 0 && hasAnyCost ? (totalProfit / deliveredRevenue) * 100 : 0

  const last14 = Array.from({ length: 14 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (13 - i))
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const revenueSeries = last14.map((key) => analytics.filter((a) => a.date === key).reduce((s, a) => s + (a.revenue || 0), 0))

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
    <div className="merchant-dashboard merchant-dashboard-canonical">
      <InternalPageHeader
        eyebrow="لوحة تشغيل المتجر"
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

      <section className="dashboard-kpi-region" aria-label="مؤشرات الأداء">
      <div className="dashboard-kpi-region-head"><div><span className="internal-page-eyebrow">ملخص الأداء</span><h2>كيف يسير متجرك اليوم؟</h2></div><span className="muted small">محدث من بيانات متجرك الحالية</span></div>
      <div className="stats-grid dashboard-kpi-grid">
        {canOrders && <StatsCard title="طلبات اليوم" value={todayOrders.length} icon="receipt_long" tone="primary" />}
        {canOrders && <StatsCard title="المبيعات" value={todayRevenue} currency icon="payments" tone="green" />}
        {canOrders && hasAnyCost && <StatsCard title="إجمالي الأرباح" value={totalProfit} currency icon="trending_up" tone="violet" />}
        {canOrders && <StatsCard title="طلبات معلقة" value={pendingOrders.length} icon="pending_actions" tone="amber" />}
        {canProducts && <StatsCard title="المنتجات" value={activeProducts} icon="inventory_2" tone="blue" />}
        {canCustomers && <StatsCard title="العملاء" value={customers.length} icon="groups" tone="violet" />}
      </div>
      </section>

      <div className="dashboard-canonical-grid">
        <main className="dashboard-canonical-main">
          {canOrders && (
            <WorkspaceSection title="الصورة المالية" subtitle="الإيرادات والتكلفة والربح من الطلبات المسلّمة" className="dashboard-profit-workspace">
            <Card className="dashboard-profit-panel dashboard-profit-card">
              <div className="dashboard-card-heading">
                <div>
                  <span className="eyebrow">تحليل الأرباح</span>
                  <h2>الصورة المالية لمتجرك</h2>
                  <p className="muted small">من الطلبات المسلمة وأسعار التكلفة المسجلة فقط.</p>
                </div>
                <div className="profit-panel-icon"><Icon name={hasAnyCost ? 'trending_up' : 'analytics'} /></div>
              </div>
              {hasAnyCost ? (
                <div className="dashboard-profit-metrics">
                  <div><span>الإيرادات</span><strong>{formatCurrency(deliveredRevenue)}</strong></div>
                  <div><span>التكلفة</span><strong>{formatCurrency(totalCost)}</strong></div>
                  <div className="is-positive"><span>إجمالي الربح</span><strong>{formatCurrency(totalProfit)}</strong></div>
                  <div><span>هامش الربح</span><strong>{profitMargin.toFixed(1)}%</strong></div>
                </div>
              ) : (
                <div className="dashboard-profit-empty"><Icon name="analytics" /><p>أضف أسعار التكلفة للمنتجات لعرض الأرباح بدقة.</p><Link href="/dashboard/products"><Button variant="outline" icon="inventory_2">إضافة سعر التكلفة</Button></Link></div>
              )}
              {hasAnyCost && <Link href="/dashboard/products" className="dashboard-inline-link">مراجعة تكاليف المنتجات <Icon name="arrow_forward" /></Link>}
            </Card>
            </WorkspaceSection>
          )}

          {canAnalytics && (
            <WorkspaceSection title="اتجاه المبيعات" subtitle="آخر 14 يوماً" className="dashboard-chart-workspace">
            <Card className="dashboard-chart-card">
              <LineChart values={revenueSeries} height={220} />
            </Card>
            </WorkspaceSection>
          )}

          {canOrders ? (
            <WorkspaceSection title="أحدث الطلبات" subtitle={`${orders.length} طلب إجمالي`} className="dashboard-orders-workspace">
            <Card className="dashboard-orders-card">
              {orders.length === 0 ? (
                <EmptyState title="لا توجد طلبات بعد" description="عند وصول طلبات من متجرك ستظهر هنا مباشرة." icon="receipt_long" action={store ? <a href={`/store/${store.slug}`} target="_blank" rel="noreferrer"><Button variant="outline" size="sm">عرض متجرك</Button></a> : null} />
              ) : (
                <Table cardMode columns={[
                  { key: 'orderNumber', header: 'الرقم', render: (o: Order) => <Link href={`/dashboard/orders/${o.id}`}><span className="monospace">{o.orderNumber}</span></Link> },
                  { key: 'customerName', header: 'العميل' },
                  { key: 'totalPrice', header: 'الإجمالي', render: (o: Order) => formatCurrency(o.totalPrice) },
                  { key: 'status', header: 'الحالة', render: (o: Order) => <Badge tone={STATUS_COLORS[o.status as keyof typeof STATUS_COLORS]}>{STATUS_LABELS[o.status as keyof typeof STATUS_LABELS] || o.status}</Badge> },
                  { key: 'createdAt', header: 'التاريخ', render: (o: Order) => <span className="muted">{timeAgo(o.createdAt)}</span> },
                ]} rows={orders.slice(0, 8)} />
              )}
            </Card>
            </WorkspaceSection>
          ) : <Card title="أحدث الطلبات"><EmptyState title="صلاحيات غير كافية" description="حسابك لا يملك صلاحية عرض الطلبات. تواصل مع مالك المتجر لتفعيلها." icon="lock" /></Card>}
        </main>

        <aside className="dashboard-canonical-side">
          <Card title="حالة المتجر" className="dashboard-store-status-card">
            <div className="dashboard-status-line"><span className="dashboard-status-dot" data-published={store?.published ? 'true' : 'false'} /><div><strong>{store?.published ? 'متجرك منشور' : 'المتجر مسودة'}</strong><small>{store?.published ? 'يمكنه استقبال الطلبات' : 'انشر المتجر لبدء البيع'}</small></div></div>
            {store && isOwner && <div className="dashboard-status-actions"><Toggle checked={!!store.published} onChange={togglePublish} disabled={publishing} label="منشور" /><Link href="/dashboard/themes"><Button variant="ghost" size="sm" icon="palette">المظهر</Button></Link></div>}
            {store && <div className="dashboard-store-link" dir="ltr">{storePublicUrl(store) || 'رابط المتجر غير متاح'}</div>}
            <div className="dashboard-action-row"><Button variant="soft" size="sm" icon="link" onClick={copyLink} disabled={!storePublicUrl(store)}>نسخ الرابط</Button>{store && <a href={`/store/${store.slug}`} target="_blank" rel="noreferrer"><Button variant="outline" size="sm" icon="store">فتح المتجر</Button></a>}</div>
          </Card>

          {(subStatus === 'active' || subStatus === 'trialing') && <Card title="استخدام الخطة" className="dashboard-usage-card" actions={<Link href="/dashboard/subscription"><Button variant="ghost" size="sm" icon="arrow_forward">التفاصيل</Button></Link>}>
            {subStatus === 'trialing' && subscription && <div className="dashboard-trial"><Icon name="hourglass_top" /><span><strong>{trialRemaining || 'قاربت على الانتهاء'}</strong><small>الفترة التجريبية نشطة</small></span></div>}
            <UsageCard subscription={subscription} plan={plan} title="الطلبات" compact />
          </Card>}

          <Card title="إجراءات سريعة" className="dashboard-quick-actions">
            {canProducts && <Link href="/dashboard/products"><Icon name="add" /><span>إضافة منتج</span><Icon name="arrow_forward" /></Link>}
            {canOrders && <Link href="/dashboard/orders"><Icon name="receipt_long" /><span>مراجعة الطلبات</span><Icon name="arrow_forward" /></Link>}
            {canAnalytics && <Link href="/dashboard/analytics"><Icon name="analytics" /><span>عرض التحليلات</span><Icon name="arrow_forward" /></Link>}
          </Card>

          {canProducts && <Card title="تنبيهات المخزون" className="dashboard-inventory-card" actions={<Link href="/dashboard/products"><Button variant="ghost" size="sm" icon="arrow_forward">إدارة</Button></Link>}>
            {lowStock.length > 0 ? lowStock.slice(0, 4).map((p) => <div key={p.id} className="dashboard-inventory-row"><span>{p.name}</span><Badge tone={p.stock === 0 ? 'red' : 'amber'}>{p.stock === 0 ? 'نفد المخزون' : `متبقي ${p.stock}`}</Badge></div>) : <div className="dashboard-no-alert"><Icon name="check_circle" /><span>لا توجد تنبيهات مخزون</span></div>}
          </Card>}
        </aside>
      </div>

      {!allDone && <Card title="خطوات إطلاق المتجر" subtitle="أكمل الخطوات التالية لبدء البيع" className="dashboard-launch-card">
        <div className="checklist dashboard-checklist">{steps.map((s, i) => <div key={i} className={`checklist-item ${s.done ? 'checklist-item--done' : ''}`}><span className={`checklist-mark ${s.done ? 'checklist-mark--done' : ''}`}>{s.done ? <Icon name="check" /> : i + 1}</span><div className="grow"><div className="font-semibold">{s.label}</div>{s.hint && <div className="muted small">{s.hint}</div>}</div>{!s.done && s.to && <Link href={s.to}><Button variant="soft" size="sm" icon="arrow_forward">ابدأ</Button></Link>}</div>)}</div>
      </Card>}

      {canLinks && links.length > 0 && <Card title="أداء روابط البيع" subtitle="أفضل الروابط حسب الإيرادات" className="dashboard-links-card">
        <Table cardMode columns={[{ key: 'title', header: 'الرابط' }, { key: 'visits', header: 'الزيارات', render: (l: StoreLink) => <Badge>{l.visits || 0}</Badge> }, { key: 'ordersCount', header: 'الطلبات', render: (l: StoreLink) => <Badge tone="indigo">{l.ordersCount || 0}</Badge> }, { key: 'totalRevenue', header: 'الإيرادات', render: (l: StoreLink) => formatCurrency(l.totalRevenue || 0) }]} rows={[...links].sort((a, b) => (b.totalRevenue || 0) - (a.totalRevenue || 0)).slice(0, 5)} />
      </Card>}
    </div>
  )
}
export default MerchantDashboard
