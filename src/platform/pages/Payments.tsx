import { FunctionalComponent } from 'preact'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { StatsCard } from '../../shared/components/ui/StatsCard'
import { Table } from '../../shared/components/ui/Table'
import { Badge } from '../../shared/components/ui/Badge'
import { useCollection } from '../../shared/hooks/useCollection'
import { formatCurrency, formatDateTime } from '../../shared/utils/format'
import type { Payment, Transaction } from '../../shared/types'

const TONES: Record<string, string> = {
  paid: 'green',
  pending: 'amber',
  failed: 'red',
  refunded: 'violet',
}

export const PlatformPayments: FunctionalComponent = () => {
  const paymentsRes = useCollection<Payment>('payments', { orderBy: { field: 'createdAt' } });
  const payments = paymentsRes.data
  const total = payments.reduce((s, p) => s + p.amount, 0)
  const collected = payments.filter((p) => p.status === 'paid').reduce((s, p) => s + p.amount, 0)

  return (
    <div>
      <PageHeader title="المدفوعات" subtitle={`${payments.length} عملية دفع`} />
      <div className="stats-grid">
        <StatsCard title="إجمالي المدفوعات" value={total} currency icon="payments" tone="primary" />
        <StatsCard title="تم تحصيله" value={collected} currency icon="account_balance_wallet" tone="green" />
        <StatsCard title="معلق" value={payments.filter((p) => p.status === 'pending').length} icon="hourglass" tone="amber" />
      </div>
      <Card>
        <Table
          columns={[
            { key: 'method', header: 'الطريقة', render: (p: Payment) => <Badge tone="indigo">{p.method}</Badge> },
            { key: 'amount', header: 'المبلغ', render: (p: Payment) => formatCurrency(p.amount) },
            { key: 'status', header: 'الحالة', render: (p: Payment) => <Badge tone={(TONES[p.status] as any) || 'slate'}>{p.status}</Badge> },
            { key: 'orderId', header: 'الطلب', render: (p: Payment) => p.orderId ? <span className="monospace">{p.orderId.slice(0, 8)}</span> : '—' },
            { key: 'createdAt', header: 'التاريخ', render: (p: Payment) => <span className="muted">{formatDateTime(p.createdAt)}</span> },
          ]}
          rows={payments}
        />
      </Card>
    </div>
  )
}

export const PlatformTransactions: FunctionalComponent = () => {
  const txnsRes = useCollection<Transaction>('transactions', { orderBy: { field: 'createdAt' } });
  const txns = txnsRes.data
  const total = txns.reduce((s, t) => s + t.amount, 0)

  return (
    <div>
      <PageHeader title="المعاملات المالية" subtitle={`${txns.length} معاملة • ${formatCurrency(total)}`} />
      <Card>
        <Table
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
    </div>
  )
}
export default PlatformPayments
