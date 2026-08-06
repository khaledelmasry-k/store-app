import { FunctionalComponent, Fragment } from 'preact'
import { useState } from 'preact/hooks'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { Table } from '../../shared/components/ui/Table'
import { Badge } from '../../shared/components/ui/Badge'
import { Button } from '../../shared/components/ui/Button'
import { Modal } from '../../shared/components/ui/Modal'
import { Input } from '../../shared/components/ui/Input'
import { Select } from '../../shared/components/ui/Select'
import { Tabs } from '../../shared/components/ui/Tabs'
import { useStore } from '../../shared/hooks/useStore'
import { useCollection } from '../../shared/hooks/useCollection'
import { useToast } from '../../shared/hooks/useToast'
import { inviteStaffCallable } from '../../shared/services/auth'
import { formatDate } from '../../shared/utils/format'
import { RolesTab } from './Roles'
import type { TeamMember, RoleDef } from '../../shared/types'

export const MerchantTeam: FunctionalComponent = () => {
  const { store } = useStore()
  const storeId = store?.id || ''
  const teamRes = useCollection<TeamMember>('team', { storeId })
  const team = teamRes.data
  const rolesRes = useCollection<RoleDef>('roles', { storeId })
  const roles = rolesRes.data
  const toast = useToast()
  const [tab, setTab] = useState('members')
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [roleId, setRoleId] = useState('')
  const [loading, setLoading] = useState(false)
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null)

  const invite = async () => {
    if (!email || !name || !roleId) {
      toast.push('أكمل بيانات الدعوة', undefined, 'error')
      return
    }
    setLoading(true)
    try {
      const res = await inviteStaffCallable({ storeId, name, email, roleId })
      const data = res.data as { email: string; initialPassword: string }
      setCredentials({ email: data.email, password: data.initialPassword })
      toast.push('تم إنشاء حساب الموظف')
    } catch (err: any) {
      toast.push('فشلت الدعوة', err?.message || 'حدث خطأ', 'error')
    } finally {
      setLoading(false)
    }
  }

  const close = () => {
    setOpen(false)
    setCredentials(null)
    setEmail('')
    setName('')
    setRoleId('')
  }

  return (
    <div>
      <PageHeader
        title="الفريق والصلاحيات"
        subtitle={tab === 'members' ? `إدارة أعضاء فريقك ودعوة موظفين (${team.length} عضو)` : `إدارة الأدوار والصلاحيات (${roles.length} دور)`}
        actions={
          tab === 'members' ? (
            <Button icon="person_add" onClick={() => setOpen(true)}>دعوة عضو</Button>
          ) : undefined
        }
      />

      <Tabs
        tabs={[
          { key: 'members', label: 'الأعضاء', count: team.length },
          { key: 'roles', label: 'الأدوار والصلاحيات', count: roles.length },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'members' ? (
        <Card title="الأعضاء">
          <Table cardMode
            columns={[
              { key: 'name', header: 'الاسم' },
              { key: 'email', header: 'البريد' },
              { key: 'role', header: 'الدور', render: (m: TeamMember) => <Badge tone="indigo">{(roles.find((r: any) => r.id === m.role) as any)?.name || m.role}</Badge> },
              { key: 'active', header: 'الحالة', render: (m: TeamMember) => <Badge tone={m.active ? 'green' : 'slate'}>{m.active ? 'نشط' : 'موقوف'}</Badge> },
              { key: 'createdAt', header: 'الانضمام', render: (m: TeamMember) => <span className="muted">{formatDate(m.createdAt)}</span> },
            ]}
            rows={team}
          />
        </Card>
      ) : (
        <RolesTab />
      )}

      <Modal open={open} onClose={close} title={credentials ? 'حساب الموظف جاهز' : 'دعوة عضو جديد'} footer={!credentials && <><Button variant="ghost" onClick={close}>إلغاء</Button><Button onClick={invite} loading={loading}>إنشاء الحساب</Button></>}>
        {credentials ? (
          <div>
            <p className="mb-2">
              تم إنشاء الحساب. سلّم هذه البيانات للموظف لتسجيل الدخول، وسيتمكن من تغيير كلمة المرور لاحقاً:
            </p>
            <div className="field">
              <label className="field-label">البريد الإلكتروني</label>
              <input className="input" readOnly value={credentials.email} />
            </div>
            <div className="field">
              <label className="field-label">كلمة المرور المؤقتة</label>
              <input className="input" readOnly value={credentials.password} />
            </div>
            <Button onClick={close} block icon="done">تم</Button>
          </div>
        ) : (
          <Fragment>
            <Input label="الاسم" value={name} onChange={setName} required />
            <Input label="البريد الإلكتروني" type="email" value={email} onChange={setEmail} required />
            <Select label="الدور" value={roleId} onChange={(v) => setRoleId(v)} options={roles.map((r: any) => ({ value: r.id, label: r.name }))} />
            {roles.length === 0 && <p className="muted small">أنشئ دوراً أولاً من تبويب «الأدوار والصلاحيات».</p>}
          </Fragment>
        )}
      </Modal>
    </div>
  )
}
export default MerchantTeam