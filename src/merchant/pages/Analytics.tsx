import { FunctionalComponent } from 'preact'
import { useState, useMemo, useEffect } from 'preact/hooks'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { StatsCard } from '../../shared/components/ui/StatsCard'
import { Card } from '../../shared/components/ui/Card'
import { Table } from '../../shared/components/ui/Table'
import { Button } from '../../shared/components/ui/Button'
import { Input } from '../../shared/components/ui/Input'
import { Loading } from '../../shared/components/ui/Loading'
import { EmptyState } from '../../shared/components/ui/EmptyState'
import { DonutChart } from '../../shared/components/charts/DonutChart'
import { Icon } from '../../shared/components/ui/Icon'
import { Badge } from '../../shared/components/ui/Badge'
import { useStore } from '../../shared/hooks/useStore'
import { useAuth } from '../../shared/hooks/useAuth'
import { useCollection } from '../../shared/hooks/useCollection'
import { useToast } from '../../shared/hooks/useToast'
import { STATUS_LABELS, STATUS_COLORS } from '../../shared/utils/constants'
import { formatCurrency, formatDateTime, formatNumber, downloadFile, deliveredRevenue } from '../../shared/utils/format'
import { orderItemRevenue } from '../../shared/utils/pricing'
import { csvEscape } from '../../shared/utils/validators'
import { createAdCampaignCallable, listAdCampaignsCallable } from '../../shared/services/auth'
import type { Order, ProductCost, Product, OrderCost } from '../../shared/types'
import './Analytics.css'

const PERIODS = [
  { value: 'today', label: 'اليوم' },
  { value: 'yesterday', label: 'أمس' },
  { value: '7', label: '7 أيام' },
  { value: '30', label: '30 يوماً' },
  { value: '90', label: '90 يوماً' },
] as const

type Period = (typeof PERIODS)[number]['value']

export const MerchantAnalytics: FunctionalComponent = () => {
  const { store } = useStore()
  const { user } = useAuth()
  const storeId = store?.id || ''
  const canCustomers = user?.role === 'merchant' || (user?.permissions || []).includes('customers:view')
  const ordersRes = useCollection<Order>('orders', { storeId })
  const orders = ordersRes.data
  const customersRes = useCollection('customers', { storeId }, canCustomers)
  const customers = customersRes.data
  const analyticsRes = useCollection<any>('analytics', { storeId })
  const analytics = analyticsRes.data
  const productsRes = useCollection<Product>('products', { storeId })
  const products = productsRes.data
  const costsRes = useCollection<ProductCost>('productCosts', { storeId }, !!storeId)
  const orderCostsRes = useCollection<OrderCost>('orderCosts', { storeId }, !!storeId)
  const costByProduct = useMemo(() => new Map(costsRes.data.map((c) => [c.id, c.costPrice])), [costsRes.data])
  const toast = useToast()
  const [period, setPeriod] = useState<Period>('30')
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [campaignForm, setCampaignForm] = useState({ name: '', platform: 'facebook', totalSpend: '' })

  useEffect(() => {
    if (!storeId) return
    listAdCampaignsCallable({ storeId }).then((r: any) => setCampaigns(r.data?.campaigns || [])).catch(() => setCampaigns([]))
  }, [storeId])
  const addCampaign = async () => {
    if (!campaignForm.name.trim()) return toast.push('أدخل اسم الحملة', undefined, 'error')
    const spend = Number(campaignForm.totalSpend || 0)
    if (!Number.isFinite(spend) || spend < 0) return toast.push('الإنفاق غير صالح', undefined, 'error')
    try {
      await createAdCampaignCallable({ storeId, name: campaignForm.name, platform: campaignForm.platform, totalSpend: spend, attributionMode: 'manual' })
      setCampaignForm({ name: '', platform: 'facebook', totalSpend: '' })
      const r: any = await listAdCampaignsCallable({ storeId }); setCampaigns(r.data?.campaigns || [])
      toast.push('تمت إضافة الحملة')
    } catch (e: any) { toast.push(e?.message || 'تعذر إضافة الحملة', undefined, 'error') }
  }

  const periodDays = period === 'today' || period === 'yesterday' ? 1 : Number(period)
  const periodOffset = period === 'yesterday' ? 1 : 0
  const dateKeys = Array.from({ length: periodDays }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - periodOffset - (periodDays - 1 - i))
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const profitForOrder = (o: Order): number | null => {
    let hasCost = false
    let profit = 0
    for (const it of o.items || []) {
      const cost = costByProduct.get(it.productId)
      if (typeof cost !== 'number' || cost < 0) continue
      hasCost = true
      profit += orderItemRevenue(it) - Math.max(1, it.quantity || 1) * cost
    }
    return hasCost ? profit : null
  }
  const deliveredProfit = orders.filter((o) => o.status === 'DELIVERED').reduce((sum, o) => sum + (profitForOrder(o) ?? 0), 0)
  const hasAnyCost = costsRes.data.some((c) => typeof c.costPrice === 'number' && c.costPrice >= 0)
  const conversion = customers.length ? orders.length / Math.max(customers.length, 1) : 0
  const revenue = deliveredRevenue(orders)
  const orderCostById = useMemo(() => new Map(orderCostsRes.data.map((c) => [c.orderId, c])), [orderCostsRes.data])
  const attributedOrders = orders.filter((o) => o.status === 'DELIVERED' && o.campaignId)
  const campaignSpend = campaigns.reduce((sum, c) => sum + Number(c.totalSpend || 0), 0)
  const campaignRevenue = attributedOrders.reduce((sum, o) => sum + Number(o.totalPrice || 0), 0)
  const advertisingCost = orders.filter((o) => o.status === 'DELIVERED').reduce((sum, o) => {
    const snapshot = orderCostById.get(o.id)
    const lineAd = (snapshot?.items || []).reduce((s, item: any) => s + Number(item.estimatedAdCostSnapshot || 0) * (item.estimatedAdCostMode === 'per_item' ? Math.max(1, Number(item.quantity || 1)) : 1), 0)
    return sum + lineAd
  }, 0)
  const contributionProfit = deliveredProfit - advertisingCost

  const prevDateKeys = dateKeys.map((key) => {
    const d = new Date(`${key}T00:00:00`)
    d.setDate(d.getDate() - periodDays)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const revenueSeries = dateKeys.map((key) => analytics.filter((a) => a.date === key).reduce((s, a) => s + (a.revenue || 0), 0))
  const prevRevenue = prevDateKeys.reduce((s, key) => s + analytics.filter((a) => a.date === key).reduce((p, a) => p + (a.revenue || 0), 0), 0)
  const prevOrders = orders.filter((o) => {
    const t = o.createdAt
    if (!t || !('seconds' in t)) return false
    const d = new Date(t.seconds * 1000)
    return d.getTime() > Date.now() - periodDays * 2 * 86400000 && d.getTime() <= Date.now() - periodDays * 86400000
  }).length
  const deltaRevenue = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : null

  const statusData = (Object.keys(STATUS_LABELS) as (keyof typeof STATUS_LABELS)[]).map((statusKey) => ({
    label: STATUS_LABELS[statusKey],
    value: orders.filter((o) => o.status === statusKey).length,
    color: `var(--${STATUS_COLORS[statusKey]})`,
  }))

  const productRevenue = useMemo(() => {
    const map = new Map<string, { name: string; revenue: number; orders: number }>()
    for (const o of orders) {
      if (o.status !== 'DELIVERED') continue
      for (const it of o.items) {
        const existing = map.get(it.productId) || { name: it.name, revenue: 0, orders: 0 }
        existing.revenue += orderItemRevenue(it)
        existing.orders += it.quantity || 1
        map.set(it.productId, existing)
      }
    }
    return map
  }, [orders])

  const topProducts = useMemo(() => [...productRevenue.entries()].sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 5), [productRevenue])
  const stockByProduct = useMemo(() => new Map(products.map((p) => [p.id, p.stock ?? 0])), [products])

  const margin = revenue > 0 && hasAnyCost ? Math.max(0, Math.min(100, (deliveredProfit / revenue) * 100)) : 0
  const aov = orders.length ? revenue / orders.length : 0
  const maxBar = Math.max(...revenueSeries, 1)
  const last14Series = Array.from({ length: 14 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (13 - i))
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return analytics.filter((a) => a.date === key).reduce((s, a) => s + (a.revenue || 0), 0)
  })

  const exportCsv = () => {
    const header = ['orderNumber', 'customerName', 'phone', 'governorate', 'city', 'address', 'totalPrice', 'status', 'createdAt']
    const lines = orders.map((o) => [o.orderNumber, o.customerName, o.phone, o.governorate, o.city, o.address, o.totalPrice, o.status, o.createdAt ? formatDateTime(o.createdAt) : ''].map(csvEscape).join(','))
    downloadFile(`orders-${store?.ref || 'store'}-${Date.now()}.csv`, '\uFEFF' + [header.join(','), ...lines].join('\n'), 'text/csv')
    toast.push('تم تصدير الطلبات')
  }

  if (ordersRes.loading || costsRes.loading || productsRes.loading || orderCostsRes.loading) return <Loading variant="screen" message="جاري تحميل التقارير..." />

  return (
    <div data-tour="analytics-workspace" className="merchant-operations merchant-analytics-page">
      <PageHeader
        breadcrumb="مركز الأداء"
        title="التحليلات والتقارير"
        subtitle={`مؤشرات الأداء على مدار ${periodDays} يوماً`}
        actions={
          <div className="flex flex-gap-sm flex-wrap">
            <div className="analytics-period-segmented">
              {PERIODS.map((p) => (
                <button key={p.value} type="button" className={period === p.value ? 'is-active' : ''} onClick={() => setPeriod(p.value)}>{p.label}</button>
              ))}
            </div>
            <Button variant="outline" icon="download" onClick={exportCsv}>تصدير CSV</Button>
          </div>
        }
      />

      {(ordersRes.error || analyticsRes.error) && !bannerDismissed && (
        <div className="analytics-error-banner">
          <Icon name="error" ariaHidden />
          <span>فشل في تحميل بعض البيانات، يرجى إعادة المحاولة.</span>
          <button type="button" onClick={() => setBannerDismissed(true)} aria-label="إغلاق"><Icon name="close" ariaHidden /></button>
        </div>
      )}

      {/* PRIMARY KPIs — exactly 4 equal cards */}
      <section className="analytics-section" aria-label="المؤشرات الأساسية">
        <div className="analytics-primary-grid">
          <StatsCard title="الإيرادات" value={revenue} currency icon="payments" tone="primary" change={deltaRevenue ?? undefined} changeLabel={deltaRevenue == null ? 'لا توجد بيانات للفترة السابقة' : 'مقارنة بالفترة السابقة'} />
          <StatsCard title="الأرباح" value={hasAnyCost ? deliveredProfit : 0} currency icon="trending_up" tone="green" changeLabel={!hasAnyCost ? 'بيانات التكلفة غير مكتملة' : 'من الطلبات المسلّمة'} />
          <StatsCard title="الطلبات" value={orders.length} icon="receipt_long" tone="amber" changeLabel={orders.length - prevOrders > 0 ? `+${orders.length - prevOrders} عن السابق` : `${orders.length - prevOrders} عن السابق`} />
          <StatsCard title="متوسط الطلب (AOV)" value={aov} currency icon="payments" tone="blue" />
        </div>
      </section>

      {/* SALES PERFORMANCE — 2fr / 1fr */}
      <section className="analytics-section" aria-label="أداء المبيعات">
        <h2 className="analytics-section-title">أداء المبيعات</h2>
        <div className="analytics-sales-grid">
          <Card title="اتجاه المبيعات اليومية" subtitle={`${periodDays} يوم`}>
            <div className="analytics-bars">
              {revenueSeries.map((v, i) => (
                <div key={i} className="analytics-bar-col" title={`${dateKeys[i]} — ${formatCurrency(v)}`}>
                  <div className="analytics-bar" style={{ height: `${Math.max(2, (v / maxBar) * 100)}%` }} />
                  <span className="analytics-bar-label">{new Date(dateKeys[i] + 'T00:00:00').toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card title="حالة الطلبات" subtitle={`${orders.length} طلب`}>
            <DonutChart data={statusData} />
          </Card>
        </div>
      </section>

      {/* CUSTOMER / BUSINESS PERFORMANCE — secondary metrics */}
      <section className="analytics-section" aria-label="أداء العملاء والأعمال">
        <h2 className="analytics-section-title">أداء العملاء والأعمال</h2>
        <div className="analytics-business-grid">
          <StatsCard title="العملاء" value={canCustomers ? customers.length : '—'} icon="groups" tone="violet" />
          <Card title="معدل التحويل" subtitle="طلبات لكل عميل — 14 يوماً">
            <div className="analytics-conversion-value">{canCustomers && customers.length ? `${(conversion * 100).toFixed(1)}%` : '—'}</div>
            <div className="analytics-bars is-compact">
              {last14Series.map((v, i) => (
                <div key={i} className="analytics-bar-col" title={`${formatCurrency(v)}`}>
                  <div className="analytics-bar" style={{ height: `${Math.max(2, (v / Math.max(...last14Series, 1)) * 100)}%` }} />
                </div>
              ))}
            </div>
          </Card>
          <StatsCard title="هامش الربح" value={hasAnyCost && revenue > 0 ? `${margin.toFixed(1)}%` : '—'} icon="analytics" tone="indigo" changeLabel="Target: 30%" />
        </div>
      </section>

      {/* ADVERTISING — separate section with manual note */}
      <section className="analytics-section" aria-label="الإعلانات">
        <h2 className="analytics-section-title">الإعلانات</h2>
        <p className="analytics-ad-note">بيانات الحملات الإعلانية تُدخل يدويًا حاليًا ولا يوجد ربط مباشر بمنصات الإعلانات.</p>
        <div className="analytics-ad-grid">
          <StatsCard title="الإنفاق الإعلاني" value={campaignSpend || advertisingCost} currency icon="campaign" tone="amber" changeLabel="من الحملات أو snapshots" />
          <StatsCard title="تكلفة الطلب" value={attributedOrders.length > 0 && campaignSpend > 0 ? campaignSpend / attributedOrders.length : '—'} currency icon="ads_click" tone="violet" />
          <StatsCard title="الربح بعد الإعلانات" value={hasAnyCost ? contributionProfit : '—'} currency icon="trending_down" tone="green" changeLabel="تقديري قبل الشحن والرسوم" />
        </div>
        <Card title="أداء الحملات الإعلانية" subtitle="بيانات يدوية — لا يوجد ربط تلقائي بمنصات الإعلانات">
          <div className="campaign-summary"><span>الطلبات المنسوبة: <strong>{attributedOrders.length}</strong></span><span>الإيراد المنسوب: <strong>{campaignRevenue ? formatCurrency(campaignRevenue) : '—'}</strong></span><span>ROAS: <strong>{campaignSpend > 0 && campaignRevenue > 0 ? `${(campaignRevenue / campaignSpend).toFixed(2)}x` : '—'}</strong></span></div>
          <div className="form-grid campaign-form">
            <Input label="اسم الحملة" value={campaignForm.name} onChange={(v) => setCampaignForm({ ...campaignForm, name: v })} placeholder="حملة الصيف" />
            <label className="field-label">المنصة<select className="input" value={campaignForm.platform} onChange={(e) => setCampaignForm({ ...campaignForm, platform: (e.currentTarget as HTMLSelectElement).value })}><option value="facebook">Facebook</option><option value="instagram">Instagram</option><option value="tiktok">TikTok</option><option value="google">Google</option><option value="other">أخرى</option></select></label>
            <Input label="إجمالي الإنفاق (ج.م)" type="number" min="0" value={campaignForm.totalSpend} onChange={(v) => setCampaignForm({ ...campaignForm, totalSpend: v })} />
            <div className="campaign-form-action"><Button variant="secondary" onClick={addCampaign}>إضافة حملة</Button></div>
          </div>
          {campaigns.length === 0 ? (
            <p className="muted small">لم تُضف حملات إعلانية بعد. سجّل الإنفاق وربطه بمصادر البيع لقياس تكلفة الحصول على الطلب.</p>
          ) : (
            <div className="table-scroll">
              <Table
                columns={[
                  { key: 'name', header: 'الحملة' },
                  { key: 'platform', header: 'المنصة' },
                  { key: 'spend', header: 'الإنفاق', render: (c: any) => formatCurrency(Number(c.totalSpend || 0)) },
                  { key: 'orders', header: 'الطلبات المنسوبة', render: (c: any) => formatNumber(Number(c.attributedOrders || 0)) },
                  { key: 'cost', header: 'تكلفة الطلب', render: (c: any) => c.costPerOrder == null ? '—' : formatCurrency(c.costPerOrder) },
                ]}
                rows={campaigns}
              />
            </div>
          )}
        </Card>
      </section>

      {/* PRODUCTS — standalone */}
      <section className="analytics-section" aria-label="المنتجات">
        <h2 className="analytics-section-title">المنتجات</h2>
        <Card title="أفضل المنتجات مبيعاً" subtitle="حسب الإيرادات">
          {topProducts.length === 0 ? (
            <EmptyState icon="inventory" title="لا توجد مبيعات مسلمة بعد" description="ستظهر المنتجات الأكثر مبيعاً هنا بعد استلام أول طلب." />
          ) : (
            <Table
              cardMode
              columns={[
                { key: 'name', header: 'المنتج', render: (p: any) => <span className="font-semibold">{p.name}</span> },
                { key: 'orders', header: 'الكمية المباعة', render: (p: any) => <span className="monospace" dir="ltr">{p.orders}</span> },
                { key: 'revenue', header: 'الإيرادات', render: (p: any) => <span className="font-semibold" dir="ltr">{formatCurrency(p.revenue)}</span> },
                { key: 'stock', header: 'حالة المخزون', render: (p: any) => {
                  const stock = stockByProduct.get(p.id)
                  const out = typeof stock === 'number' && stock <= 0
                  return <Badge tone={out ? 'red' : 'green'}>{out ? 'نفذ المخزون' : 'متوفر'}</Badge>
                } },
              ]}
              rows={topProducts.map(([productId, p]) => ({ id: productId, name: p.name, orders: p.orders, revenue: p.revenue }))}
            />
          )}
        </Card>
      </section>

      {/* ORDERS — bottom */}
      <Card title="تفاصيل الطلبات" subtitle={`${orders.length} طلب • ${formatCurrency(orders.reduce((s, o) => s + o.totalPrice, 0))}`} actions={<Button variant="outline" icon="download" onClick={exportCsv}>تصدير CSV</Button>}>
        <Table
          cardMode
          columns={[
            { key: 'orderNumber', header: 'الرقم', render: (o: Order) => <span className="monospace font-semibold">{o.orderNumber}</span> },
            { key: 'customerName', header: 'العميل' },
            { key: 'totalPrice', header: 'الإجمالي', render: (o: Order) => formatCurrency(o.totalPrice) },
            { key: 'profit', header: 'الربح', render: (o: Order) => {
              const profit = profitForOrder(o)
              if (profit == null) return <Badge tone="slate">تكلفة غير مكتملة</Badge>
              return <Badge tone={profit < 0 ? 'red' : 'green'}>{formatCurrency(profit)}</Badge>
            } },
            { key: 'status', header: 'الحالة', render: (o: Order) => <Badge tone={STATUS_COLORS[o.status as keyof typeof STATUS_COLORS] || 'slate'}>{STATUS_LABELS[o.status as keyof typeof STATUS_LABELS] || o.status}</Badge> },
            { key: 'createdAt', header: 'التاريخ', render: (o: Order) => <span className="muted">{formatDateTime(o.createdAt)}</span> },
          ]}
          rows={orders.slice(0, 50)}
        />
      </Card>
    </div>
  )
}
export default MerchantAnalytics
