import { FunctionalComponent } from 'preact'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { Table } from '../../shared/components/ui/Table'
import { Badge } from '../../shared/components/ui/Badge'
import { useCollection } from '../../shared/hooks/useCollection'
import { formatDateTime } from '../../shared/utils/format'
import type { AuditLog } from '../../shared/types'

export const PlatformAudit: FunctionalComponent = () => {
  const logsRes = useCollection<AuditLog>('auditLogs', { orderBy: { field: 'createdAt' } });
  const logs = logsRes.data

  return (
    <div>
      <PageHeader title="سجل التدقيق" subtitle={`${logs.length} حدث مسجل`} />
      <Card>
        <Table
          columns={[
            { key: 'action', header: 'الإجراء', render: (l: AuditLog) => <Badge tone="indigo">{l.action}</Badge> },
            { key: 'resource', header: 'الموارد' },
            { key: 'resourceId', header: 'المعرف', render: (l: AuditLog) => l.resourceId ? <span className="monospace">{l.resourceId.slice(0, 8)}</span> : '—' },
            { key: 'userId', header: 'المستخدم', render: (l: AuditLog) => l.userId ? <span className="monospace">{l.userId.slice(0, 8)}</span> : '—' },
            { key: 'createdAt', header: 'التاريخ', render: (l: AuditLog) => <span className="muted">{formatDateTime(l.createdAt)}</span> },
          ]}
          rows={logs.slice(0, 100)}
        />
      </Card>
    </div>
  )
}
export default PlatformAudit
