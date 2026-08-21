import { FunctionalComponent, Fragment } from 'preact'
import { useState } from 'preact/hooks'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Button } from '../../shared/components/ui/Button'
import { Modal } from '../../shared/components/ui/Modal'
import { Input } from '../../shared/components/ui/Input'
import { Select } from '../../shared/components/ui/Select'
import { Tabs } from '../../shared/components/ui/Tabs'
import { EmptyState } from '../../shared/components/ui/EmptyState'
import { useStore } from '../../shared/hooks/useStore'
import { useCollection } from '../../shared/hooks/useCollection'
import { useToast } from '../../shared/hooks/useToast'
import { inviteStaffCallable } from '../../shared/services/auth'
import { formatDate } from '../../shared/utils/format'
import { useSubscription } from '../../shared/hooks/useSubscription'
import { getPlanLimit } from '../../shared/services/subscription'
import { RolesTab } from './Roles'
import type { TeamMember, RoleDef } from '../../shared/types'
import { Icon } from '../../shared/components/ui/Icon'
import './Team.css'

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0] || '')
    .join('')
    .toUpperCase()

export const MerchantTeam: FunctionalComponent = () => {
  const { store } = useStore()
  const storeId = store?.id || ''
  const teamRes = useCollection<TeamMember>('team', { storeId })
  const team = teamRes.data
  const rolesRes = useCollection<RoleDef>('roles', { storeId })
  const roles = rolesRes.data
  const { plan } = useSubscription(storeId)
  const staffLimit = getPlanLimit('staff', plan)
  const staffFull = staffLimit > 0 && team.length >= staffLimit
  const toast = useToast()
  const [tab, setTab] = useState('members')
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [roleId, setRoleId] = useState('')
  const [loading, setLoading] = useState(false)
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null)

  const filtered = team.filter(
    (m) => (m.name || '').includes(query) || (m.email || '').includes(query),
  )

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
    <div className="merchant-operations merchant-team-page">
      <PageHeader
        title="إدارة الفريق والأدوار"
        subtitle={tab === 'members' ? `قم بإدارة وصول الموظفين وصلاحياتهم داخل المتجر (${team.length} عضو)` : `إدارة الأدوار والصلاحيات (${roles.length} دور)`}
        actions={
          tab === 'members' ? (
            <Button icon="person_add" disabled={staffFull} onClick={() => setOpen(true)}>دعوة عضو</Button>
          ) : undefined
        }
      />

      {staffFull && (
        <div className="team-limit-banner">
          <Icon name="warning" ariaHidden />
          <div>
            <h4>تم بلوغ الحد الأقصى للموظفين</h4>
            <p>لقد وصلت إلى الحد الأقصى لعدد الموظفين المسموح به في باقتك الحالية ({staffLimit} موظف).</p>
          </div>
          <a href="/dashboard/subscription"><button type="button" className="team-limit-upgrade">ترقية</button></a>
        </div>
      )}

      <Tabs
        tabs={[
          { key: 'members', label: 'الأعضاء', count: team.length },
          { key: 'roles', label: 'الأدوار', count: roles.length },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'members' ? (
        <Fragment>
          <div className="team-toolbar">
            <div className="team-search">
              <Icon name="search" ariaHidden />
              <input type="text" placeholder="ابحث بالاسم أو البريد..." value={query} onInput={(e) => setQuery((e.target as HTMLInputElement).value)} aria-label="بحث في الفريق" />
            </div>
            <Button icon="person_add" disabled={staffFull} onClick={() => setOpen(true)}>إضافة عضو</Button>
          </div>

          {teamRes.loading ? (
            <div className="loading-screen"><span className="spinner spinner-lg" /></div>
          ) : filtered.length === 0 ? (
            <EmptyState icon="group_add" title={query ? 'لا توجد نتائج' : 'لا يوجد أعضاء بعد'} description={query ? 'جرّب بحثاً آخر.' : 'ادعُ أول عضو للفريق للبدء.'} />
          ) : (
            <div className="team-table">
              <table>
                <thead>
                  <tr>
                    <th>العضو</th>
                    <th>الدور</th>
                    <th>الحالة</th>
                    <th>تاريخ الانضمام</th>
                    <th className="actions">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <span className="team-member-cell">
                          <span className="team-avatar">{initials(m.name || m.email || '?')}</span>
                          <span>
                            <span className="team-member-name">{m.name || '—'}</span>
                            <span className="team-member-email">{m.email}</span>
                          </span>
                        </span>
                      </td>
                      <td>
                        <span className="team-role-chip">{(roles.find((r: any) => r.id === m.role) as any)?.name || m.role}</span>
                      </td>
                      <td>
                        <span className={`team-status${m.active ? ' is-active' : ''}`}>
                          <span className="team-status-dot" />
                          {m.active ? 'نشط' : 'موقوف'}
                        </span>
                      </td>
                      <td><span className="muted">{formatDate(m.createdAt)}</span></td>
                      <td className="actions">
                        <button className="icon-btn" title="تعديل"><Icon name="edit" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Fragment>
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
            <Button onClick={close} block icon="check">تم</Button>
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