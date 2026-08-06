import { FunctionalComponent } from 'preact'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { Table } from '../../shared/components/ui/Table'
import { Badge } from '../../shared/components/ui/Badge'
import { useCollection } from '../../shared/hooks/useCollection'
import { formatDateTime } from '../../shared/utils/format'
import { AUDIT_ACTION_TONES } from '../../shared/utils/constants'
import type { AuditLog } from '../../shared/types'

export const PlatformAudit: FunctionalComponent = () => {
  const auditRes = useCollection<AuditLog>('auditLogs', { orderBy: { field: 'createdAt' } })
  const logs = auditRes.data

  return (
    <div>
      <PageHeader title="سجل التدقيق" subtitle={`${logs.length} إدخال`} />
      <Card>
        <Table cardMode
          columns={[
            { key: 'action', header: 'الإجراء', render: (l: AuditLog) => <Badge tone={(AUDIT_ACTION_TONES[l.action] as any) || 'slate'}>{l.action}</Badge> },
            { key: 'userId', header: 'المستخدم', render: (l: AuditLog) => <span className="monospace">{l.userId?.slice(0, 8)}</span> },
            { key: 'entity', header: 'الكيان' },
            { key: 'resourceId', header: 'المعرف', render: (l: AuditLog) => <span className="monospace">{l.resourceId?.slice(0, 8)}</span> },
            { key: 'details', header: 'التفاصيل' },
            { key: 'createdAt', header: 'التاريخ', render: (l: AuditLog) => <span className="muted">{formatDateTime(l.createdAt)}</span> },
          ]}
          rows={logs}
        />
      </Card>
    </div>
  )
}
export default PlatformAudit