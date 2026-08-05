import { FunctionalComponent } from 'preact'
import { Link } from 'wouter'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { StatsCard } from '../../shared/components/ui/StatsCard'
import { Card } from '../../shared/components/ui/Card'
import { Table } from '../../shared/components/ui/Table'
import { Badge } from '../../shared/components/ui/Badge'
import { LineChart } from '../../shared/components/charts/LineChart'
import { useCollection } from '../../shared/hooks/useCollection'
import { Loading } from '../../shared/components/ui/Loading'
import { formatCurrency, timeAgo } from '../../shared/utils/format'
import { EmptyState } from '../../shared/components/ui/EmptyState'
import { Button } from '../../shared/components/ui/Button'
import type { Store, Subscription, Transaction } from '../../shared/types'

export const PlatformDashboard: FunctionalComponent = () => {
  const storesRes = useCollection<Store>('stores', { orderBy: { field: 'createdAt' } })
  const subsRes = useCollection<Subscription>('subscriptions', { orderBy: { field: 'createdAt' } })
  const transactionsRes = useCollection<Transaction>('transactions', { orderBy: { field: 'createdAt' } })
  const analyticsRes = useCollection<any>('analytics', { orderBy: { field: 'date' } })

  const stores = storesRes.data
  const subs = subsRes.data
  const transactions = transactionsRes.data
  const analytics = analyticsRes.data

  if (storesRes.loading || subsRes.loading || transactionsRes.loading || analyticsRes.loading) {
    return <Loading />
  }

  const activeStores = stores.filter((s) => s.active).length
  const suspendedStores = stores.filter((s) => !s.active).length
  const activeSubs = subs.filter((s) => s.status === 'active').length
  const expiredSubs = subs.filter((s) => s.status === 'expired' || s.status === 'rejected').length

  const platformRevenue = transactions
    .filter((t) => t.type === 'subscription' && t.status === 'completed')
    .reduce((s, t) => s + (t.amount || 0), 0)

  const last14 = Array.from({ length: 14 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (13 - i))
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return { key, date: d }
  })

  const platformRevenueSeries = last14.map(({ key }) =>
    transactions
      .filter((t) => t.type === 'subscription' && t.status === 'completed')
      .reduce((s, t) => {
        const createdDate = new Date((t.createdAt?.seconds || 0) * 1000)
        const tKey = `${createdDate.getFullYear()}-${String(createdDate.getMonth() + 1).padStart(2, '0')}-${String(createdDate.getDate()).padStart(2, '0')}`
        return tKey === key ? s + (t.amount || 0) : s
      }, 0)
  )

  const ordersSeries = last14.map(({ key }) => analytics.filter((a: any) => a.date === key).reduce((s, a: any) => s + (a.orders || 0), 0))
  const storesSeries = last14.map(({ key }) => analytics.filter((a: any) => a.date === key).reduce((s, a: any) => s + (a.stores || 0), 0))

  const totalOrders = ordersSeries.reduce((s, v) => s + v, 0)

  const latestStores = [...stores].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).slice(0, 5)
  const latestSubs = [...subs].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).slice(0, 5)

  return (
    <div>
      <PageHeader
        title="لوحة تحكم المنصة"
        subtitle="نظرة عامة على أداء المنصة والتجار"
        actions={
          <Link href="/platform/merchants">
            <Button variant="outline" icon="add">إضافة تاجر</Button>
          </Link>
        }
      />
      <div className="stats-grid">
        <StatsCard title="إجمالي التجار" value={stores.length} icon="storefront" tone="primary" />
        <StatsCard title="المتاجر النشطة" value={activeStores} icon="store" tone="green" changeLabel={`${suspendedStores} موقوف`} />
        <StatsCard title="الاشتراكات النشطة" value={activeSubs} icon="card_membership" tone="blue" changeLabel={`${expiredSubs} منتهية`} />
        <StatsCard title="إيرادات المنصة" value={platformRevenue} currency icon="payments" tone="amber" />
      </div>
      <div className="stats-grid">
        <StatsCard title="إجمالي طلبات المتاجر" value={totalOrders} icon="receipt_long" tone="violet" />
        <StatsCard title="نمو التجار" value={storesSeries.length > 0 ? storesSeries[storesSeries.length - 1] : 0} icon="trending_up" tone="green" />
      </div>
      <div className="grid grid-2 mb-2">
        <Card title="إيرادات المنصة (آخر 14 يوم)" subtitle="إيرادات الاشتراكات والمدفوعات">
          {platformRevenueSeries.every((v) => v === 0) ? (
            <EmptyState title="لا توجد إيرادات" description="ستظهر إيرادات الاشتراكات والمدفوعات هنا" />
          ) : (
            <div style={{ height: 220 }}><LineChart values={platformRevenueSeries} /></div>
          )}
        </Card>
        <Card title="طلبات المتاجر (آخر 14 يوم)" subtitle="إجمالي الطلبات عبر جميع المتاجر">
          {ordersSeries.every((v) => v === 0) ? (
            <EmptyState title="لا توجد طلبات" description="ستظهر طلبات المتاجر هنا" />
          ) : (
            <div style={{ height: 220 }}><LineChart values={ordersSeries} color="var(--success)" /></div>
          )}
        </Card>
      </div>
      <div className="grid grid-2 mb-2">
        <Card title="نمو المتاجر (آخر 14 يوم)">
          {storesSeries.every((v) => v === 0) ? (
            <EmptyState title="لا توجد بيانات" description="ستظهر بيانات المتاجر هنا" />
          ) : (
            <div style={{ height: 220 }}><LineChart values={storesSeries} color="var(--primary)" /></div>
          )}
        </Card>
        <Card title="الاشتراكات (آخر 14 يوم)">
          {ordersSeries.every((v) => v === 0) ? (
            <EmptyState title="لا توجد بيانات" description="ستظهر بيانات الاشتراكات هنا" />
          ) : (
            <div style={{ height: 220 }}><LineChart values={ordersSeries} color="var(--info)" /></div>
          )}
        </Card>
      </div>
      <div className="grid grid-2">
        <Card title="آخر التجار" subtitle={`${latestStores.length} من أصل ${stores.length}`}>
          {latestStores.length === 0 ? (
            <EmptyState title="لا توجد تجار" description="لم يتم إنشاء أي تجار بعد" />
          ) : (
            <Table
              columns={[
                { key: 'name', header: 'اسم التاجر' },
                { key: 'email', header: 'البريد' },
                { key: 'active', header: 'الحالة', render: (s: Store) => <Badge tone={s.active ? 'green' : 'red'}>{s.active ? 'نشط' : 'موقوف'}</Badge> },
                { key: 'createdAt', header: 'التاريخ', render: (s: Store) => <span className="muted">{timeAgo(s.createdAt)}</span> },
              ]}
              rows={latestStores}
            />
          )}
        </Card>
        <Card title="آخر الاشتراكات" subtitle={`${latestSubs.length} من أصل ${subs.length}`}>
          {latestSubs.length === 0 ? (
            <EmptyState title="لا توجد اشتراكات" description="لم يتم إنشاء أي اشتراكات بعد" />
          ) : (
            <Table
              columns={[
                { key: 'merchantName', header: 'التاجر' },
                { key: 'planId', header: 'الخطة' },
                { key: 'status', header: 'الحالة', render: (s: Subscription) => <Badge tone={s.status === 'active' ? 'green' : 'amber'}>{s.status}</Badge> },
                { key: 'createdAt', header: 'التاريخ', render: (s: Subscription) => <span className="muted">{timeAgo(s.createdAt)}</span> },
              ]}
              rows={latestSubs}
            />
          )}
        </Card>
      </div>
    </div>
  )
}
export default PlatformDashboard