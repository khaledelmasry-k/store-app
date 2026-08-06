import { FunctionalComponent, Fragment } from 'preact'
import { useState } from 'preact/hooks'
import { Card } from '../../shared/components/ui/Card'
import { Table } from '../../shared/components/ui/Table'
import { Badge } from '../../shared/components/ui/Badge'
import { Button } from '../../shared/components/ui/Button'
import { Modal } from '../../shared/components/ui/Modal'
import { Input } from '../../shared/components/ui/Input'
import { ConfirmDialog } from '../../shared/components/ui/ConfirmDialog'
import { EmptyState } from '../../shared/components/ui/EmptyState'
import { Loading } from '../../shared/components/ui/Loading'
import { useStore } from '../../shared/hooks/useStore'
import { useCollection } from '../../shared/hooks/useCollection'
import { useToast } from '../../shared/hooks/useToast'
import { rolesService } from '../../shared/services/system'
import { PERMISSION_GROUPS, PERMISSION_LABELS, type Permission } from '../../shared/utils/constants'
import { formatDate } from '../../shared/utils/format'
import type { RoleDef } from '../../shared/types'

export const RolesTab: FunctionalComponent = () => {
  const { store } = useStore()
  const storeId = store?.id || ''
  const rolesRes = useCollection<RoleDef>('roles', { storeId })
  const roles = rolesRes.data
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<RoleDef | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<{ name: string; permissions: string[] }>({ name: '', permissions: [] })

  const togglePermission = (perm: string) => {
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(perm) ? prev.permissions.filter((p) => p !== perm) : [...prev.permissions, perm],
    }))
  }

  const submit = async () => {
    if (!form.name) {
      toast.push('أدخل اسم الدور', undefined, 'error')
      return
    }
    setSaving(true)
    await rolesService.create(storeId, { name: form.name, permissions: form.permissions })
    toast.push('تم إضافة الدور')
    setOpen(false)
    setForm({ name: '', permissions: [] })
    setSaving(false)
  }

  const remove = async () => {
    if (!deleteTarget) return
    await rolesService.remove(deleteTarget.id)
    toast.push('تم حذف الدور')
    setDeleteTarget(null)
  }

  if (rolesRes.loading) return <Loading />

  return (
    <Fragment>
      <Card
        title="الأدوار"
        subtitle={`${roles.length} دور`}
        actions={<Button icon="add" size="sm" onClick={() => setOpen(true)}>دور جديد</Button>}
      >
        {roles.length === 0 ? (
          <EmptyState icon="shield" title="لا توجد أدوار" description="أنشئ أدواراً مخصصة لتحكم بصلاحيات فريقك." />
        ) : (
          <Table cardMode
            columns={[
              { key: 'name', header: 'الاسم', render: (r: RoleDef) => <span className="font-semibold">{r.name}</span> },
              {
                key: 'permissions',
                header: 'الصلاحيات',
                render: (r: RoleDef) => (
                  <div className="flex" style={{ flexWrap: 'wrap', gap: 4 }}>
                    {(r.permissions || []).slice(0, 4).map((p) => (
                      <Badge key={p} tone="indigo">{PERMISSION_LABELS[p as Permission] || p}</Badge>
                    ))}
                    {(r.permissions || []).length > 4 && <Badge tone="slate">+{(r.permissions || []).length - 4}</Badge>}
                  </div>
                ),
              },
              { key: 'createdAt', header: 'التاريخ', render: (r: RoleDef) => <span className="muted">{formatDate(r.createdAt)}</span> },
              { key: 'actions', header: '', render: (r: RoleDef) => <button className="icon-btn" onClick={() => setDeleteTarget(r)} title="حذف"><span className="material-symbols-outlined">delete</span></button> },
            ]}
            rows={roles}
          />
        )}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="دور جديد" size="md" footer={<Fragment><Button variant="ghost" onClick={() => setOpen(false)}>إلغاء</Button><Button onClick={submit} loading={saving} icon="check">حفظ الدور</Button></Fragment>}>
        <Input label="اسم الدور" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
        <div className="field">
          <label className="field-label">الصلاحيات</label>
          <div className="perm-grid">
            {Object.entries(PERMISSION_GROUPS).map(([key, group]) => (
              <div key={key} className="perm-group">
                <div className="perm-group-head">
                  <span className="material-symbols-outlined">{group.icon}</span>
                  <span>{group.label}</span>
                </div>
                <div className="perm-group-items">
                  {group.permissions.map((perm) => (
                    <label key={perm} className="perm-item">
                      <input
                        type="checkbox"
                        checked={form.permissions.includes(perm)}
                        onChange={() => togglePermission(perm)}
                      />
                      <span>{PERMISSION_LABELS[perm]}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onCancel={() => setDeleteTarget(null)} onConfirm={remove} title="حذف الدور" description={`سيتم حذف دور "${deleteTarget?.name}"`} confirmLabel="حذف" />
    </Fragment>
  )
}
export default RolesTab