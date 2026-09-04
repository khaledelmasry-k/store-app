import { FunctionalComponent } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { Link } from 'wouter'
import { Button } from '../../shared/components/ui/Button'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { useStore } from '../../shared/hooks/useStore'
import { useAuth } from '../../shared/hooks/useAuth'
import { useCollectionOnce } from '../../shared/hooks/useCollectionOnce'
import { useCollection } from '../../shared/hooks/useCollection'
import { useSubscription } from '../../shared/hooks/useSubscription'
import { useToast } from '../../shared/hooks/useToast'
import './Dashboard.css'
import { EmptyState } from '../../shared/components/ui/EmptyState'
import { formatCurrency, formatNumber, timeAgo } from '../../shared/utils/format'
import { getPlanLimit, isPlanLimitUnlimited, usageFrom } from '../../shared/services/subscription'
import { orderItemRevenue } from '../../shared/utils/pricing'
import { storePublicUrl } from '../../shared/utils/store-url'
import { STATUS_LABELS } from '../../shared/utils/constants'
import { visibleOrderStatus, visibleOrderStatusLabel } from '../../shared/utils/order-status'
import { setStorePublishedCallable, getEligiblePromotionsCallable } from '../../shared/services/auth'
import type { Order, Product, ProductCost, Shipment } from '../../shared/types'
import { Icon } from '../../shared/components/ui/Icon'
import { CountdownTimer } from '../../shared/components/subscription/CountdownTimer'

const SUB_STATUS_LABELS: Record<string, string> = {
  active: 'نشط',
  trialing: 'تجربة مجانية',
  expired: 'منتهي',
  pending: 'قيد الانتظار',
  none: 'بدون اشتراك',
}

/** Order-status pill matching the Stitch tone palette. */
const STATUS_PILLS: Record<string, { cls: string; icon?: string }> = {
  NEW: { cls: 'order-pill-new' },
  CONTACTED: { cls: 'order-pill-contacted' },
  PROCESSING: { cls: 'order-pill-processing' },
  SHIPPED: { cls: 'order-pill-shipped' },
  DELIVERED: { cls: 'order-pill-delivered' },
  CANCELLED: { cls: 'order-pill-cancelled' },
  RETURNED: { cls: 'order-pill-returned' },
}

export const MerchantDashboard: FunctionalComponent = () => {
  const { store } = useStore()
  const { user } = useAuth()
  const toast = useToast()
  const storeId = store?.id || ''
  const isOwner = user?.role === 'merchant'
  const [publishing, setPublishing] = useState(false)
  const [promotions, setPromotions] = useState<any[]>([])
  const [promotionNow, setPromotionNow] = useState(Date.now())
  const [secondaryReady, setSecondaryReady] = useState(false)
  useEffect(() => {
    let cancelled = false
    const schedule = window.setTimeout(() => { if (!cancelled) setSecondaryReady(true) }, 0)
    return () => {
      cancelled = true
      window.clearTimeout(schedule)
    }
  }, [])
  useEffect(() => {
    if (!secondaryReady || !storeId || !isOwner) return
    getEligiblePromotionsCallable({ storeId }).then((r: any) => setPromotions(r.data?.promotions || [])).catch(() => setPromotions([]))
  }, [secondaryReady, storeId, isOwner])
  useEffect(() => { const id = window.setInterval(() => setPromotionNow(Date.now()), 60000); return () => window.clearInterval(id) }, [])

  const perms = user?.permissions || []
  const canOrders = isOwner || perms.includes('orders:view')
  const canProducts = isOwner || perms.includes('products:view')
  const canCustomers = isOwner || perms.includes('customers:view')
  const canAnalytics = isOwner || perms.includes('reports:view')

  const ordersRes = useCollectionOnce<Order>('orders', { storeId, orderBy: { field: 'createdAt' } }, secondaryReady && canOrders)
  const productsRes = useCollectionOnce<Product>('products', { storeId }, secondaryReady && canProducts)
  const costsRes = useCollectionOnce<ProductCost>('productCosts', { storeId }, secondaryReady && canProducts)
  const customersRes = useCollectionOnce('customers', { storeId }, secondaryReady && canCustomers)
  // Shipping is live so the dashboard reflects carrier updates without a reload.
  const shipmentsRes = useCollection<Shipment>('shipments', { storeId }, secondaryReady && canOrders)

  const orders = ordersRes.data
  const products = productsRes.data
  const customers = customersRes.data
  const shipments = shipmentsRes.data

  const subState = useSubscription(isOwner ? storeId : '')
  const subscription = subState.subscription
  const plan = subState.plan
  const subStatus = subState.status

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
  const lowStock = products.filter((p) => p.stock <= (p.lowStockThreshold ?? 5) && p.active)

  const costByProduct = new Map(costsRes.data.map((c) => [c.id, c.costPrice]))
  const hasAnyCost = [...costByProduct.values()].some((c) => typeof c === 'number' && c >= 0)
  let totalProfit = 0
  let deliveredRevenue = 0
  let totalCost = 0
  let deliveredCount = 0
  for (const o of orders) {
    if (o.status !== 'DELIVERED') continue
    deliveredRevenue += o.totalPrice
    deliveredCount += 1
    for (const it of o.items) {
      const cost = costByProduct.get(it.productId)
      if (typeof cost !== 'number' || cost < 0) continue
      const lineCost = Math.max(1, it.quantity || 1) * cost
      totalCost += lineCost
      totalProfit += orderItemRevenue(it) - lineCost
    }
  }
  const profitMargin = deliveredRevenue > 0 && hasAnyCost ? (totalProfit / deliveredRevenue) * 100 : 0
  const avgOrderValue = deliveredCount > 0 ? deliveredRevenue / deliveredCount : 0
  const deliveredShipments = shipments.filter((shipment) => shipment.status === 'DELIVERED').length
  const inDistributionShipments = shipments.filter((shipment) => ['PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'].includes(shipment.status)).length
  const returnedShipments = shipments.filter((shipment) => shipment.status === 'RETURNED').length
  const failedShipments = shipments.filter((shipment) => shipment.status === 'FAILED').length

  const copyLink = async () => {
    if (!store) return
    const url = store.published ? storePublicUrl(store) : `${storePublicUrl(store)}?preview=1`
    if (!url) {
      toast.push('رابط المتجر غير متاح بعد', 'حدد رابطاً صالحاً للمتجر من الإعدادات أولاً', 'error')
      return
    }
    try {
      await navigator.clipboard.writeText(url)
      toast.push(store.published ? 'تم نسخ رابط المتجر' : 'تم نسخ رابط المعاينة', url, 'success')
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

  const usage = usageFrom(subscription, plan)
  const resourceUsage = subState.resourceUsage
  const productUsed = resourceUsage?.products.used ?? products.length
  const productLimit = resourceUsage?.products.limit ?? getPlanLimit('products', plan)
  const productUnlimited = productLimit <= 0 && isPlanLimitUnlimited('products', plan)
  const staffUsed = resourceUsage?.team.used ?? 1
  const staffLimit = resourceUsage?.team.limit ?? getPlanLimit('staff', plan)
  const storageUsed = Math.round(Number(resourceUsage?.storage.used ?? (store as any)?.storageUsed ?? 0) / (1024 * 1024))
  const storageLimit = resourceUsage?.storage.limit ? Math.round(resourceUsage.storage.limit / (1024 * 1024)) : getPlanLimit('storage', plan)
  const storefrontPath = store?.slug ? `/store/${store.slug}${store.published ? '' : '?preview=1'}` : ''
  const storefrontLabel = store?.published ? 'فتح المتجر المنشور' : 'معاينة المتجر'
  const primaryPromotion = promotions.find((p) => p.placement?.includes?.('dashboard_banner'))
  const promotionEnds = primaryPromotion?.endsAt ? (primaryPromotion.endsAt.seconds ? primaryPromotion.endsAt.seconds * 1000 : new Date(primaryPromotion.endsAt).getTime()) : 0
  const promotionMinutes = promotionEnds ? Math.max(0, Math.floor((promotionEnds - promotionNow) / 60000)) : 0

  const latestOrders = orders.slice(0, 8)
  const headerActions = (
    <div className="dashboard-header-actions">
      {canProducts && (
        <Link href="/dashboard/products">
          <Button variant="primary" icon="add">منتج جديد</Button>
        </Link>
      )}
    </div>
  )

  const statusbarActions = (
    <div className="dashboard-statusbar-actions">
      {store && (
        <Button variant="outline" icon="content_copy" onClick={copyLink} disabled={!store?.slug} title={!store?.slug ? 'رابط المتجر غير متاح بعد' : undefined}>
          نسخ الرابط
        </Button>
      )}
      {store && (
        <a data-tour="preview-store" href={storefrontPath} target="_blank" rel="noreferrer" className="dashboard-header-link">
          <Button variant="outline" icon="storefront">{storefrontLabel}</Button>
        </a>
      )}
    </div>
  )

  const kpiCards = (
    <div className="dashboard-kpi-stats">
      {canOrders && (
        <div data-tour="kpi-revenue" className="dashboard-kpi">
          <div className="dashboard-kpi-top">
            <span className="dashboard-kpi-label">الإيرادات</span>
            <span className="dashboard-kpi-icon"><Icon name="account_balance_wallet" ariaHidden /></span>
          </div>
          <div className="dashboard-kpi-value-row">
            <span className="dashboard-kpi-value">{formatCurrency(todayRevenue)}</span>
          </div>
          <div className="dashboard-kpi-caption">اليوم مقارنة بالأمس</div>
        </div>
      )}
      {canOrders && (
        <div data-tour="kpi-orders" className="dashboard-kpi">
          <div className="dashboard-kpi-top">
            <span className="dashboard-kpi-label">الطلبات</span>
            <span className="dashboard-kpi-icon"><Icon name="shopping_cart" ariaHidden /></span>
          </div>
          <div className="dashboard-kpi-value-row">
            <span className="dashboard-kpi-value">{formatNumber(todayOrders.length)}</span>
          </div>
          <div className="dashboard-kpi-caption">اليوم مقارنة بالأمس</div>
        </div>
      )}
      {canOrders && (
        <div data-tour="kpi-profit" className="dashboard-kpi">
          <div className="dashboard-kpi-top">
            <span className="dashboard-kpi-label">الربح الإجمالي</span>
            <span className="dashboard-kpi-icon"><Icon name="monitoring" ariaHidden /></span>
          </div>
          <div className="dashboard-kpi-value-row">
            <span className="dashboard-kpi-value">{formatCurrency(totalProfit)}</span>
            {!hasAnyCost && <span className="dashboard-kpi-pill">تكلفة غير مكتملة</span>}
          </div>
          <div className="dashboard-kpi-caption">يجب إدخال تكلفة المنتجات</div>
        </div>
      )}
      {canOrders && (
        <div className="dashboard-kpi">
          <div className="dashboard-kpi-top">
            <span className="dashboard-kpi-label">هامش الربح</span>
            <span className="dashboard-kpi-icon"><Icon name="pie_chart" ariaHidden /></span>
          </div>
          <div className="dashboard-kpi-value-row">
            <span className="dashboard-kpi-value">{`${profitMargin.toFixed(1)}%`}</span>
          </div>
          <div className="dashboard-kpi-caption">متوسط الهامش اليوم</div>
        </div>
      )}
      {canCustomers && (
        <div className="dashboard-kpi">
          <div className="dashboard-kpi-top">
            <span className="dashboard-kpi-label">العملاء</span>
            <span className="dashboard-kpi-icon"><Icon name="group" ariaHidden /></span>
          </div>
          <div className="dashboard-kpi-value-row">
            <span className="dashboard-kpi-value">{formatNumber(customers.length)}</span>
          </div>
          <div className="dashboard-kpi-caption">عملاء جدد اليوم</div>
        </div>
      )}
      {canOrders && (
        <div className="dashboard-kpi">
          <div className="dashboard-kpi-top">
            <span className="dashboard-kpi-label">متوسط قيمة الطلب</span>
            <span className="dashboard-kpi-icon"><Icon name="receipt_long" ariaHidden /></span>
          </div>
          <div className="dashboard-kpi-value-row">
            <span className="dashboard-kpi-value">{formatCurrency(avgOrderValue)}</span>
          </div>
          <div className="dashboard-kpi-caption">قيمة السلة المتوسطة</div>
        </div>
      )}
    </div>
  )

  const profitPanel = canOrders && (
    <div className="dashboard-panel">
      <div className="dashboard-panel-head">
        <h3>تحليل الأرباح</h3>
        {canAnalytics && <Link href="/dashboard/analytics"><span className="dashboard-panel-link">عرض التقرير المفصل</span></Link>}
      </div>
      <div className="dashboard-panel-body dashboard-profit-body">
        <div className="dashboard-profit-rows">
          <div className="dashboard-profit-row">
            <span>الإيرادات</span>
            <strong>{formatCurrency(deliveredRevenue)}</strong>
          </div>
          <div className="dashboard-profit-row">
            <span>التكلفة</span>
            <strong>{formatCurrency(totalCost)}</strong>
          </div>
          <div className="dashboard-profit-row is-total">
            <span>الربح الإجمالي</span>
            <strong>{formatCurrency(totalProfit)}</strong>
          </div>
          <div className="dashboard-profit-row is-total">
            <span>هامش الربح</span>
            <strong>{`${profitMargin.toFixed(1)}%`}</strong>
          </div>
        </div>
        {!hasAnyCost && (
          <div className="dashboard-profit-alert">
            <span className="dashboard-profit-alert-icon"><Icon name="info" ariaHidden /></span>
            <div>
              <h4>تكلفة المنتجات غير مكتملة</h4>
              <p>أدخل تكلفة المنتجات لحساب أرباحك بدقة</p>
              {canProducts && <Link href="/dashboard/products"><Button variant="primary" icon="inventory_2">إضافة سعر التكلفة</Button></Link>}
            </div>
          </div>
        )}
      </div>
    </div>
  )

  const shippingOverview = canOrders && (
    <section className="dashboard-panel dashboard-shipping-overview" data-tour="shipping-summary" aria-label="ملخص تشغيل الشحن">
      <div className="dashboard-panel-head">
        <div>
          <h3>تشغيل الشحن</h3>
          <p className="dashboard-shipping-subtitle">يتحدث تلقائياً مع آخر حالة وصلت من شركة الشحن</p>
        </div>
        <Link href="/dashboard/shipping"><span className="dashboard-panel-link">إدارة الشحن</span></Link>
      </div>
      <div className="dashboard-shipping-cards">
        <Link href="/dashboard/orders" className="dashboard-shipping-card is-delivered">
          <span className="dashboard-shipping-card-icon"><Icon name="task_alt" ariaHidden /></span>
          <span className="dashboard-shipping-card-copy"><b>{formatNumber(deliveredShipments)}</b><small>تم التسليم</small></span>
        </Link>
        <Link href="/dashboard/orders" className="dashboard-shipping-card is-transit">
          <span className="dashboard-shipping-card-icon"><Icon name="local_shipping" ariaHidden /></span>
          <span className="dashboard-shipping-card-copy"><b>{formatNumber(inDistributionShipments)}</b><small>تحت التوزيع</small></span>
        </Link>
        <Link href="/dashboard/orders" className="dashboard-shipping-card is-returned">
          <span className="dashboard-shipping-card-icon"><Icon name="assignment_return" ariaHidden /></span>
          <span className="dashboard-shipping-card-copy"><b>{formatNumber(returnedShipments)}</b><small>مرتجع للمخزون</small></span>
        </Link>
        <Link href="/dashboard/orders" className="dashboard-shipping-card is-failed">
          <span className="dashboard-shipping-card-icon"><Icon name="error_outline" ariaHidden /></span>
          <span className="dashboard-shipping-card-copy"><b>{formatNumber(failedShipments)}</b><small>تعذر التسليم</small></span>
        </Link>
      </div>
      <div className="dashboard-shipping-note"><Icon name="inventory_2" ariaHidden /><span>عند وصول حالة <strong>مرتجع</strong> من وصلة أو أي شركة مربوطة، تعود كمية المنتجات إلى مخزون المتجر مرة واحدة تلقائياً.</span></div>
    </section>
  )

  const checklist = [
    { label: 'أضف أول منتج', done: products.length > 0, href: '/dashboard/products' },
    { label: 'اختر ثيم المتجر', done: Boolean(store?.theme?.template), href: '/dashboard/themes' },
    { label: 'أضف وسيلة شحن', done: Boolean(store?.shipping?.enabled), href: '/dashboard/shipping' },
    { label: 'راجع إعدادات المتجر', done: Boolean(store?.name && store?.phone), href: '/dashboard/settings' },
    { label: 'انشر المتجر', done: store?.storeStatus === 'published' || store?.published === true, href: '/dashboard/settings' },
  ]
  const checklistDone = checklist.filter((item) => item.done).length

  const planPanel = (subStatus === 'active' || subStatus === 'trialing') && (
    <div data-tour="plan-usage" className="dashboard-panel dashboard-plan-panel">
      <div className="dashboard-plan-head">
        <h3>استهلاك الخطة</h3>
        {plan && <span className="dashboard-plan-badge">{plan.name}</span>}
      </div>
      <div className="dashboard-plan-rows">
        <div className="dashboard-usage-row">
          <div className="dashboard-usage-row-top">
            <span>الطلبات المستخدمة</span>
            <span>{formatNumber(usage.used)} / {usage.limit > 0 ? formatNumber(usage.limit) : '∞'}</span>
          </div>
          <div className="dashboard-usage-bar">
            <span className="dashboard-usage-bar-fill is-orders" style={{ width: `${usage.percent}%` }} />
          </div>
        </div>
        {canProducts && (
          <div className="dashboard-usage-row">
            <div className="dashboard-usage-row-top">
              <span>المنتجات</span>
              <span>{formatNumber(productUsed)}{productUnlimited || productLimit <= 0 ? '' : ` / ${formatNumber(productLimit)}`}</span>
            </div>
            {!(productUnlimited || productLimit <= 0) && (
              <div className="dashboard-usage-bar">
                <span className="dashboard-usage-bar-fill is-products" style={{ width: `${Math.min(100, (productUsed / productLimit) * 100)}%` }} />
              </div>
            )}
          </div>
        )}
        {isOwner && (
          <div className="dashboard-usage-row">
            <div className="dashboard-usage-row-top">
              <span>المساحة التخزينية</span>
              <span>{formatNumber(storageUsed)} / {storageLimit > 0 ? `${formatNumber(storageLimit)} MB` : '∞'}</span>
            </div>
            {storageLimit > 0 && (
              <div className="dashboard-usage-bar">
                <span className="dashboard-usage-bar-fill is-storage" style={{ width: `${Math.min(100, (storageUsed / storageLimit) * 100)}%` }} />
              </div>
            )}
          </div>
        )}
        {isOwner && staffLimit > 0 && (
          <div className="dashboard-usage-row">
            <div className="dashboard-usage-row-top">
              <span>عدد المستخدمين</span>
              <span>{formatNumber(staffUsed)} / {formatNumber(staffLimit)}</span>
            </div>
            <div className="dashboard-usage-bar">
              <span className="dashboard-usage-bar-fill is-staff" style={{ width: `${Math.min(100, (staffUsed / staffLimit) * 100)}%` }} />
            </div>
          </div>
        )}
      </div>
      <Link href="/dashboard/subscription"><Button variant="outline" block icon="arrow_forward">ترقية الخطة</Button></Link>
    </div>
  )

  const inventoryPanel = canProducts && (
    <div className="dashboard-panel">
      <div className="dashboard-panel-head">
        <h3>تنبيهات المخزون</h3>
        {lowStock.length > 0 && <span className="dashboard-alert-badge">{formatNumber(lowStock.length)} تنبيهات</span>}
      </div>
      {lowStock.length > 0 ? (
        <div className="dashboard-inventory-list">
          {lowStock.slice(0, 4).map((p) => (
            <div key={p.id} className="dashboard-inventory-row">
              <div className="dashboard-inventory-main">
                <span className="dashboard-inventory-thumb"><Icon name="inventory_2" ariaHidden /></span>
                <span className="dashboard-inventory-name">{p.name}</span>
              </div>
              <span className={`dashboard-inventory-pill${p.stock === 0 ? ' is-empty' : ''}`}>
                {p.stock === 0 ? 'نفد من المخزون' : 'مخزون منخفض'}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="dashboard-no-alert"><Icon name="check_circle" ariaHidden /><span>لا توجد تنبيهات مخزون</span></div>
      )}
    </div>
  )

  const ordersPanel = (
    <div className="dashboard-panel">
      <div className="dashboard-panel-head">
        <h3>أحدث الطلبات</h3>
        {canOrders && <Link href="/dashboard/orders"><span className="dashboard-panel-link">عرض الكل</span></Link>}
      </div>
      {canOrders ? (
        orders.length === 0 ? (
          <EmptyState
            icon="receipt_long"
            title="لا توجد طلبات حتى الآن"
            description="بمجرد أن يقوم العملاء بالشراء من متجرك، ستظهر طلباتهم هنا. ابدأ بإضافة المنتجات لجذب العملاء."
            action={<Link href="/dashboard/products"><Button variant="primary">ابدأ بإضافة أول منتج</Button></Link>}
          />
        ) : (
          <div className="dashboard-table-wrap">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>رقم الطلب</th>
                  <th>العميل</th>
                  <th>التاريخ</th>
                  <th>الحالة</th>
                  <th>الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {latestOrders.map((o) => {
                  const displayStatus = visibleOrderStatus(o)
                  const pill = STATUS_PILLS[displayStatus] || { cls: displayStatus === 'FAILED' ? 'order-pill-cancelled' : 'order-pill-new' }
                  return (
                    <tr key={o.id}>
                      <td><Link href={`/dashboard/orders/${o.id}`}><span className="monospace dashboard-order-link">{o.orderNumber}</span></Link></td>
                      <td className="dashboard-cell-muted">{o.customerName}</td>
                      <td className="dashboard-cell-muted">{timeAgo(o.createdAt)}</td>
                      <td><span className={`order-pill ${pill.cls}`}>{visibleOrderStatusLabel(o)}</span></td>
                      <td>{formatCurrency(o.totalPrice)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <EmptyState title="صلاحيات غير كافية" description="حسابك لا يملك صلاحية عرض الطلبات. تواصل مع مالك المتجر لتفعيلها." icon="lock" />
      )}
    </div>
  )

  return (
    <div className="merchant-dashboard-canonical">
      {primaryPromotion && promotionMinutes > 0 && <div className="dashboard-promotion-banner"><strong>{primaryPromotion.title}</strong><span>{primaryPromotion.message}</span><CountdownTimer endsAt={primaryPromotion.endsAt} label="ينتهي خلال" />{primaryPromotion.ctaTarget && <a href={primaryPromotion.ctaTarget}>{primaryPromotion.ctaLabel || 'استفد من العرض'}</a>}</div>}
      {checklistDone < checklist.length && <section data-tour="onboarding-checklist" className="dashboard-onboarding-checklist" aria-label="خطوات بدء المتجر">
        <div className="dashboard-checklist-head"><div><h3>ابدأ متجرك خطوة بخطوة</h3><span>{checklistDone} من {checklist.length} مكتملة</span></div><div className="dashboard-checklist-progress"><i style={{ width: `${(checklistDone / checklist.length) * 100}%` }} /></div></div>
        <div className="dashboard-checklist-items">{checklist.map((item) => <Link key={item.label} href={item.href} className={`dashboard-checklist-item${item.done ? ' is-done' : ''}`}><span className="dashboard-checklist-box">{item.done ? '✓' : ''}</span><span>{item.label}</span></Link>)}</div>
      </section>}
      {/* ─────────── Desktop composition (Stitch 5ecc1fa6e7f5) ─────────── */}
      <div className="dashboard-desktop">
        <PageHeader
          title="لوحة المتجر"
          subtitle="نظرة عامة على أداء متجرك اليوم"
          actions={headerActions}
        />

        <div className="dashboard-statusbar">
          <div className="dashboard-statusbar-info">
            <div className="dashboard-statusbar-item">
              <span className="dashboard-statusbar-label">حالة المتجر:</span>
              <span className="dashboard-statusbar-dot" data-published={store?.published} />
              <span className="dashboard-statusbar-value">{store?.published ? 'منشور' : 'مسودة'}</span>
            </div>
            <span className="dashboard-statusbar-divider" />
            <div className="dashboard-statusbar-item">
              <span className="dashboard-statusbar-label">حالة الاشتراك:</span>
              <span className="dashboard-statusbar-icon"><Icon name="stars" ariaHidden /></span>
              <span className="dashboard-statusbar-value">{SUB_STATUS_LABELS[subStatus] || plan?.name || 'الباقة'}</span>
            </div>
          </div>
          {store && isOwner && (
            <button data-tour="publish-store" type="button" className="dashboard-statusbar-action" onClick={() => togglePublish(!store.published)} disabled={publishing}>
              {store.published ? 'إيقاف النشر المؤقت' : 'نشر المتجر'}
            </button>
          )}
          {statusbarActions}
        </div>

        <div className="dashboard-grid">
          <main className="dashboard-grid-main">
            {kpiCards}
            {shippingOverview}
            {profitPanel}
            {ordersPanel}
          </main>
          <aside className="dashboard-grid-side">
            {planPanel}
            {inventoryPanel}
          </aside>
        </div>
      </div>

      {/* ─────────── Mobile composition (Stitch 02784270f5674093) ─────────── */}
      <div className="dashboard-mobile">
        <div className="dashboard-mobile-header">
          <div className="dashboard-mobile-brand">
            <span className="dashboard-mobile-avatar"><Icon name="store" ariaHidden /></span>
            <div>
              <div className="dashboard-mobile-storeline">
                <span className="dashboard-mobile-storename">{store?.name || 'Matjari'}</span>
                <span className="dashboard-mobile-published">{store?.published ? 'منشور' : 'مسودة'}</span>
              </div>
            </div>
          </div>
          <button type="button" className="dashboard-mobile-sync" aria-label="تحديث البيانات" onClick={() => window.location.reload()}>
            <Icon name="sync_alt" ariaHidden />
          </button>
        </div>

        <div className="dashboard-mobile-main">
          <section className="dashboard-mobile-greeting">
            <h1>كيف أداء متجري الآن؟</h1>
            <p>نظرة عامة على أداء اليوم</p>
          </section>

          <section className="dashboard-mobile-kpis">
            {canOrders && (
              <div className="dashboard-mobile-kpi">
                <div className="dashboard-mobile-kpi-top">
                  <div className="dashboard-mobile-kpi-titles">
                    <span className="dashboard-mobile-kpi-label">الإيرادات</span>
                    <span className="dashboard-mobile-kpi-sub">بيانات خاصة بالتاجر</span>
                  </div>
                  <span className="dashboard-mobile-kpi-icon"><Icon name="payments" ariaHidden /></span>
                </div>
                <div className="dashboard-mobile-kpi-value">{formatCurrency(todayRevenue)}</div>
                <div className="dashboard-mobile-kpi-trend"><Icon name="trending_up" ariaHidden /></div>
              </div>
            )}
            {canOrders && (
              <div className="dashboard-mobile-kpi">
                <div className="dashboard-mobile-kpi-top">
                  <div className="dashboard-mobile-kpi-titles">
                    <span className="dashboard-mobile-kpi-label">الطلبات</span>
                    <span className="dashboard-mobile-kpi-sub">بيانات خاصة بالتاجر</span>
                  </div>
                  <span className="dashboard-mobile-kpi-icon"><Icon name="shopping_bag" ariaHidden /></span>
                </div>
                <div className="dashboard-mobile-kpi-value">{formatNumber(todayOrders.length)}</div>
                <div className="dashboard-mobile-kpi-trend"><Icon name="trending_up" ariaHidden /></div>
              </div>
            )}
            {canOrders && (
              <div className="dashboard-mobile-kpi dashboard-mobile-kpi-wide dashboard-mobile-kpi-profit">
                <div className="dashboard-mobile-kpi-profit-inner">
                  <div className="dashboard-mobile-kpi-top">
                    <div className="dashboard-mobile-kpi-titles">
                      <span className="dashboard-mobile-kpi-label">إجمالي الربح</span>
                      {!hasAnyCost && <span className="dashboard-mobile-kpi-warn"><Icon name="warning" ariaHidden /> بيانات خاصة بالتاجر</span>}
                    </div>
                    <span className="dashboard-mobile-kpi-icon"><Icon name="account_balance_wallet" ariaHidden /></span>
                  </div>
                  <div className="dashboard-mobile-kpi-value is-dim">{formatCurrency(totalProfit)}</div>
                  {canProducts && !hasAnyCost && (
                    <Link href="/dashboard/products" className="dashboard-mobile-kpi-link"><Icon name="arrow_forward" ariaHidden /> إضافة تكلفة المنتجات</Link>
                  )}
                </div>
              </div>
            )}
            {canOrders && (
              <div className="dashboard-mobile-kpi dashboard-mobile-kpi-wide">
                <div className="dashboard-mobile-kpi-avg">
                  <span className="dashboard-mobile-kpi-avg-icon"><Icon name="receipt_long" ariaHidden /></span>
                  <div className="dashboard-mobile-kpi-titles">
                    <span className="dashboard-mobile-kpi-label">متوسط قيمة الطلب</span>
                    <span className="dashboard-mobile-kpi-sub">بيانات خاصة بالتاجر</span>
                  </div>
                </div>
                <div className="dashboard-mobile-kpi-avg-value">{formatCurrency(avgOrderValue)}</div>
              </div>
            )}
          </section>

          {canOrders && (
            <section className="dashboard-mobile-shipping" aria-label="ملخص تشغيل الشحن">
              <div className="dashboard-mobile-section-head"><h2>تشغيل الشحن</h2><Link href="/dashboard/shipping"><span className="dashboard-panel-link">إدارة الشحن</span></Link></div>
              <div className="dashboard-mobile-shipping-grid">
                <Link href="/dashboard/orders"><span>{formatNumber(deliveredShipments)}</span><small>تم التسليم</small></Link>
                <Link href="/dashboard/orders"><span>{formatNumber(inDistributionShipments)}</span><small>تحت التوزيع</small></Link>
                <Link href="/dashboard/orders"><span>{formatNumber(returnedShipments)}</span><small>مرتجع للمخزون</small></Link>
                <Link href="/dashboard/orders"><span>{formatNumber(failedShipments)}</span><small>تعذر التسليم</small></Link>
              </div>
              <p><Icon name="inventory_2" ariaHidden /> المرتجع يعيد الكمية للمخزون تلقائياً.</p>
            </section>
          )}

          <section className="dashboard-quick-actions" aria-label="إجراءات سريعة">
            {canProducts && (
              <Link href="/dashboard/products"><button type="button" className="dashboard-quick-btn dashboard-quick-btn-primary"><Icon name="add_circle" ariaHidden /> إضافة منتج</button></Link>
            )}
            {store && isOwner && (
              <button type="button" className="dashboard-quick-btn" onClick={() => togglePublish(!store.published)} disabled={publishing}>
                <Icon name={store.published ? 'visibility_off' : 'visibility'} ariaHidden /> {store.published ? 'إيقاف النشر المؤقت' : 'نشر المتجر'}
              </button>
            )}
            {store && (
              <button type="button" className="dashboard-quick-btn" onClick={copyLink}><Icon name="share" ariaHidden /> مشاركة المتجر</button>
            )}
            {store && (
              <a href={storefrontPath} target="_blank" rel="noreferrer" className="dashboard-quick-link"><button type="button" className="dashboard-quick-btn"><Icon name="open_in_new" ariaHidden /> {storefrontLabel}</button></a>
            )}
            {canProducts && (
              <Link href="/dashboard/coupons"><button type="button" className="dashboard-quick-btn"><Icon name="local_offer" ariaHidden /> إنشاء كوبون</button></Link>
            )}
          </section>

          {canProducts && (
            <section className="dashboard-mobile-alert">
              <span className="dashboard-mobile-alert-icon"><Icon name="inventory_2" ariaHidden /></span>
              <div>
                <h3>تنبيهات المخزون</h3>
                <p>{lowStock.length > 0 ? `${formatNumber(lowStock.length)} منتجات تحتاج إلى إعادة تزويد` : 'لا توجد تنبيهات مخزون حالياً'}</p>
                <Link href="/dashboard/products"><span className="dashboard-mobile-alert-link">تحديث المخزون</span></Link>
              </div>
            </section>
          )}

          <section className="dashboard-mobile-orders">
            <div className="dashboard-mobile-section-head">
              <h2>أحدث الطلبات</h2>
              {canOrders && <Link href="/dashboard/orders"><span className="dashboard-panel-link">عرض الكل</span></Link>}
            </div>
            {canOrders ? (
              orders.length === 0 ? (
                <EmptyState
                  icon="receipt_long"
                  title="لا توجد طلبات حتى الآن"
                  description="بمجرد أن يقوم العملاء بالشراء من متجرك، ستظهر طلباتهم هنا."
                  action={<Link href="/dashboard/products"><Button variant="primary">ابدأ بإضافة أول منتج</Button></Link>}
                />
              ) : (
                <div className="dashboard-mobile-order-list">
                  {latestOrders.map((o, i) => {
                    const pill = STATUS_PILLS[o.status] || { cls: 'order-pill-new' }
                    return (
                      <Link key={o.id} href={`/dashboard/orders/${o.id}`} className="dashboard-mobile-order-card">
                        <div className="dashboard-mobile-order-main">
                          <span className="dashboard-mobile-order-icon"><Icon name={i % 2 === 0 ? 'package' : 'package_2'} ariaHidden /></span>
                          <div>
                            <div className="dashboard-mobile-order-number">{o.orderNumber}</div>
                            <div className="dashboard-mobile-order-meta">{o.customerName} • {timeAgo(o.createdAt)}</div>
                          </div>
                        </div>
                        <div className="dashboard-mobile-order-side">
                          <span className={`order-pill ${pill.cls}`}>{STATUS_LABELS[o.status as keyof typeof STATUS_LABELS] || o.status}</span>
                          <span className="dashboard-mobile-order-amount">{formatCurrency(o.totalPrice)}</span>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )
            ) : (
              <EmptyState title="صلاحيات غير كافية" description="حسابك لا يملك صلاحية عرض الطلبات." icon="lock" />
            )}
          </section>

          {(subStatus === 'active' || subStatus === 'trialing') && (
            <section className="dashboard-mobile-usage">
              <h2>استهلاك الباقة</h2>
              <div className="dashboard-mobile-usage-card">
                <div className="dashboard-usage-row">
                  <div className="dashboard-usage-row-top">
                    <span>الطلبات المستنفدة</span>
                    <span>{formatNumber(usage.used)} / {usage.limit > 0 ? formatNumber(usage.limit) : '∞'}</span>
                  </div>
                  <div className="dashboard-usage-bar">
                    <span className="dashboard-usage-bar-fill is-orders" style={{ width: `${usage.percent}%` }} />
                  </div>
                </div>
                {canProducts && (
                  <div className="dashboard-usage-row">
                    <div className="dashboard-usage-row-top">
                      <span>المنتجات المضافة</span>
                    <span>{formatNumber(productUsed)}{productUnlimited || productLimit <= 0 ? '' : ` / ${formatNumber(productLimit)}`}</span>
                    </div>
                    {!(productUnlimited || productLimit <= 0) && (
                      <div className="dashboard-usage-bar">
                        <span className="dashboard-usage-bar-fill is-products" style={{ width: `${Math.min(100, (productUsed / productLimit) * 100)}%` }} />
                      </div>
                    )}
                  </div>
                )}
                {isOwner && (
                  <div className="dashboard-usage-row">
                    <div className="dashboard-usage-row-top">
                      <span>المساحة المستخدمة</span>
                      <span>{formatNumber(storageUsed)} / {storageLimit > 0 ? `${formatNumber(storageLimit)} MB` : '∞'}</span>
                    </div>
                    {storageLimit > 0 && (
                      <div className="dashboard-usage-bar">
                        <span className="dashboard-usage-bar-fill is-storage" style={{ width: `${Math.min(100, (storageUsed / storageLimit) * 100)}%` }} />
                      </div>
                    )}
                  </div>
                )}
                {isOwner && staffLimit > 0 && (
                  <div className="dashboard-usage-row">
                    <div className="dashboard-usage-row-top">
                      <span>الفريق</span>
                      <span>{formatNumber(staffUsed)} / {formatNumber(staffLimit)}</span>
                    </div>
                    <div className="dashboard-usage-bar">
                      <span className="dashboard-usage-bar-fill is-staff" style={{ width: `${Math.min(100, (staffUsed / staffLimit) * 100)}%` }} />
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

export default MerchantDashboard
