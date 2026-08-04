import { FunctionalComponent } from 'preact'
import { useState, useMemo } from 'preact/hooks'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { Badge } from '../../shared/components/ui/Badge'
import { Button } from '../../shared/components/ui/Button'
import { Modal } from '../../shared/components/ui/Modal'
import { Input } from '../../shared/components/ui/Input'
import { useStore } from '../../shared/hooks/useStore'
import { useCollection } from '../../shared/hooks/useCollection'
import { useToast } from '../../shared/hooks/useToast'
import { rolesService } from '../../shared/services/system'
import { PERMISSION_GROUPS, PERMISSION_LABELS, type Permission } from '../../shared/utils/constants'
import type { RoleDef } from '../../shared/types'

export const MerchantRoles: FunctionalComponent = () => {
  const { store } = useStore()
  const storeId = store?.id || ''
  const rolesRes = useCollection<RoleDef>('roles', { storeId })
  const roles = rolesRes.data
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<{ name: string; permissions: Permission[] }>({ name: '', permissions: [] })

  const allPerms = useMemo(() => {
    const p = new Set<string>()
    Object.values(PERMISSION_GROUPS).forEach((g: { permissions: Permission[] }) => g.permissions.forEach((perm: Permission) => p.add(perm)))
    return Array.from(p) as Permission[]
  }, [])

  const groupKeys = Object.keys(PERMISSION_GROUPS)

  const togglePerm = (perm: Permission) => {
    const current = form.permissions
    if (current.includes(perm)) {
      setForm({ ...form, permissions: current.filter((p) => p !== perm) })
    } else {
      setForm({ ...form, permissions: [...current, perm] })
    }
  }

  const toggleGroup = (groupId: string) => {
    const group = PERMISSION_GROUPS[groupId]
    const current = form.permissions
    const groupPerms = group.permissions
    const allInGroup = groupPerms.every((p) => current.includes(p))
    if (allInGroup) {
      setForm({ ...form, permissions: current.filter((p) => !groupPerms.includes(p)) })
    } else {
      setForm({ ...form, permissions: [...current, ...groupPerms.filter((p) => !current.includes(p))] })
    }
  }

  const isGroupAll = (groupId: string) => {
    const group = PERMISSION_GROUPS[groupId]
    return group.permissions.every((p) => form.permissions.includes(p))
  }

  const isGroupPartial = (groupId: string) => {
    const group = PERMISSION_GROUPS[groupId]
    const included = group.permissions.filter((p) => form.permissions.includes(p)).length
    return included > 0 && included < group.permissions.length
  }

  const selectAll = () => setForm({ ...form, permissions: [...allPerms] })
  const clearAll = () => setForm({ ...form, permissions: [] })

  const submit = async () => {
    if (!form.name) return
    await rolesService.create(storeId, {
      name: form.name,
      permissions: form.permissions,
    })
    toast.push('تم إنشاء الدور')
    setOpen(false)
    setForm({ name: '', permissions: [] })
  }

  return (
    <div>
      <PageHeader title="الأدوار والصلاحيات" subtitle={`${roles.length} دور`} actions={<Button icon="add" onClick={() => setOpen(true)}>دور جديد</Button>} />
      <div className="grid grid-2">
        {roles.map((r) => (
          <Card key={r.id} title={r.name} subtitle={r.isSystem ? 'دور نظامي' : 'دور مخصص'}>
            <div className="flex" style={{ flexWrap: 'wrap', gap: 6 }}>
              {(r.permissions || []).map((p: string) => <Badge key={p} tone="indigo">{PERMISSION_LABELS[p as Permission] || p}</Badge>)}
            </div>
          </Card>
        ))}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="دور جديد">
        <Input label="اسم الدور" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
        <div className="field">
          <div className="flex-between mb-1">
            <span className="field-label">الصلاحيات</span>
            <div className="flex" style={{ gap: 8 }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={selectAll}>اختر الكل</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={clearAll}>مسح الكل</button>
            </div>
          </div>
          {groupKeys.map((groupId) => {
            const group = PERMISSION_GROUPS[groupId]
            const all = isGroupAll(groupId)
            const partial = isGroupPartial(groupId)
            return (
              <div key={groupId} className="perm-group mb-2">
                <div className="flex-between perm-group-header">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => toggleGroup(groupId)}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{group.icon}</span>
                    {group.label}
                    {all && <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--success)' }}>check_circle</span>}
                    {partial && <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--amber)' }}>indeterminate_check_box</span>}
                  </button>
                </div>
                <div className="perm-group-items">
                  {group.permissions.map((perm: Permission) => (
                    <label key={perm} className="flex mb-1 perm-checkbox">
                      <input
                        type="checkbox"
                        checked={form.permissions.includes(perm)}
                        onChange={() => togglePerm(perm)}
                      />
                      <span>{PERMISSION_LABELS[perm as Permission]}</span>
                    </label>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
        <div className="flex" style={{ justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={() => setOpen(false)}>إلغاء</Button>
          <Button onClick={submit} disabled={!form.name}>حفظ</Button>
        </div>
      </Modal>
    </div>
  )
}
export default MerchantRoles