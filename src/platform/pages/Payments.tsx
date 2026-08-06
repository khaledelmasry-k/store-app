import { FunctionalComponent, Fragment } from 'preact'
import { useState } from 'preact/hooks'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { StatsCard } from '../../shared/components/ui/StatsCard'
import { Table } from '../../shared/components/ui/Table'
import { Badge } from '../../shared/components/ui/Badge'
import { Tabs } from '../../shared/components/ui/Tabs'
import { Loading } from '../../shared/components/ui/Loading'
import { useCollection } from '../../shared/hooks/useCollection'
import { formatCurrency, formatDateTime } from '../../shared/utils/format'
import { PAYMENT_STATUS_TONES } from '../../shared/utils/constants'
import type { Payment, Transaction } from '../../shared/types'

export const PlatformPayments: FunctionalComponent = () => {
  const [tab, setTab] = useState<'payments' | 'transactions'>('payments')
  const paymentsRes = useCollection<Payment>('payments', { orderBy: { field: 'createdAt' } })
  const payments = paymentsRes.data
  const txnsRes = useCollection<Transaction>('transactions', { orderBy: { field: 'createdAt' } })
  const txns = txnsRes.data

  const total = payments.reduce((s, p) => s + (p.amount || 0), 0)
  const collected = payments.filter((p) => p.status === 'paid').reduce((s, p) => s + (p.amount || 0), 0)
  const txnTotal = txns.reduce((s, t) => s + (t.amount || 0), 0)

  if (paymentsRes.loading || txnsRes.loading) return <Loading />

  return (
    <div>
      <PageHeader
        title="المدفوعات والمعاملات"
        subtitle={tab === 'payments' ? `${payments.length} عملية دفع` : `${txns.length} معاملة • ${formatCurrency(txnTotal)}`}
      />

      <Tabs
        tabs={[
          { key: 'payments', label: 'المدفوعات', count: payments.length },
          { key: 'transactions', label: 'سجل المعاملات', count: txns.length },
        ]}
        active={tab}
        onChange={(k) => setTab(k as 'payments' | 'transactions')}
      />

      {tab === 'payments' ? (
        <Fragment>
          <div className="stats-grid">
            <StatsCard title="إجمالي المدفوعات" value={total} currency icon="payments" tone="primary" />
            <StatsCard title="تم تحصيله" value={collected} currency icon="account_balance_wallet" tone="green" />
            <StatsCard title="معلق" value={payments.filter((p) => p.status === 'pending').length} icon="hourglass" tone="amber" />
          </div>
          <Card>
            <Table cardMode
              columns={[
                { key: 'method', header: 'الطريقة', render: (p: Payment) => <Badge tone="indigo">{p.method}</Badge> },
                { key: 'amount', header: 'المبلغ', render: (p: Payment) => formatCurrency(p.amount) },
                { key: 'status', header: 'الحالة', render: (p: Payment) => <Badge tone={(PAYMENT_STATUS_TONES[p.status] as any) || 'slate'}>{p.status}</Badge> },
                { key: 'orderId', header: 'الطلب', render: (p: Payment) => p.orderId ? <span className="monospace">{p.orderId.slice(0, 8)}</span> : '—' },
                { key: 'createdAt', header: 'التاريخ', render: (p: Payment) => <span className="muted">{formatDateTime(p.createdAt)}</span> },
              ]}
              rows={payments}
            />
          </Card>
        </Fragment>
      ) : (
        <Fragment>
          <div className="stats-grid">
            <StatsCard title="إجمالي المعاملات" value={txnTotal} currency icon="sync" tone="primary" />
            <StatsCard title="مكتملة" value={txns.filter((t) => t.status === 'completed').length} icon="check_circle" tone="green" />
            <StatsCard title="معلقة" value={txns.filter((t) => t.status === 'pending').length} icon="hourglass" tone="amber" />
          </div>
          <Card>
            <Table cardMode
              columns={[
                { key: 'type', header: 'النوع', render: (t: Transaction) => <Badge tone="blue">{t.type}</Badge> },
                { key: 'description', header: 'الوصف' },
                { key: 'amount', header: 'المبلغ', render: (t: Transaction) => formatCurrency(t.amount) },
                { key: 'status', header: 'الحالة', render: (t: Transaction) => <Badge tone={t.status === 'completed' ? 'green' : t.status === 'pending' ? 'amber' : 'red'}>{t.status}</Badge> },
                { key: 'reference', header: 'المرجع', render: (t: Transaction) => t.reference ? <span className="monospace">{t.reference}</span> : '—' },
                { key: 'createdAt', header: 'التاريخ', render: (t: Transaction) => <span className="muted">{formatDateTime(t.createdAt)}</span> },
              ]}
              rows={txns}
            />
          </Card>
        </Fragment>
      )}
    </div>
  )
}
export default PlatformPayments