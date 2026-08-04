import { FunctionalComponent } from 'preact'
import { useState } from 'preact/hooks'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { Table } from '../../shared/components/ui/Table'
import { Badge } from '../../shared/components/ui/Badge'
import { Button } from '../../shared/components/ui/Button'
import { Modal } from '../../shared/components/ui/Modal'
import { Input } from '../../shared/components/ui/Input'
import { ConfirmDialog } from '../../shared/components/ui/ConfirmDialog'
import { useStore } from '../../shared/hooks/useStore'
import { useCollection } from '../../shared/hooks/useCollection'
import { useToast } from '../../shared/hooks/useToast'
import { categoriesService } from '../../shared/services/categories'
import { slugify } from '../../shared/utils/format'
import type { Category } from '../../shared/types'

export const MerchantCategories: FunctionalComponent = () => {
  const { store } = useStore()
  const storeId = store?.id || ''
  const categoriesRes = useCollection<Category>('categories', { storeId, orderBy: { field: 'order' } });
  const categories = categoriesRes.data
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)
  const [name, setName] = useState('')

  const submit = async () => {
    if (!name) return
    await categoriesService.create(storeId, {
      name,
      slug: slugify(name),
      order: categories.length,
      active: true,
    })
    toast.push('تم إضافة الفئة')
    setOpen(false)
    setName('')
  }

  const remove = async () => {
    if (!deleteTarget) return
    await categoriesService.remove(deleteTarget.id)
    toast.push('تم حذف الفئة')
    setDeleteTarget(null)
  }

  return (
    <div>
      <PageHeader title="الفئات" subtitle={`${categories.length} فئة`} actions={<Button icon="add" onClick={() => setOpen(true)}>فئة جديدة</Button>} />
      <Card>
        <Table
          columns={[
            { key: 'name', header: 'الفئة' },
            { key: 'slug', header: 'الرابط', render: (c: Category) => <span className="monospace">{c.slug}</span> },
            { key: 'order', header: 'الترتيب' },
            { key: 'active', header: 'الحالة', render: (c: Category) => <Badge tone={c.active ? 'green' : 'slate'}>{c.active ? 'نشطة' : 'مخفية'}</Badge> },
            { key: 'actions', header: '', render: (c: Category) => <button className="icon-btn" onClick={() => setDeleteTarget(c)}><span className="material-symbols-outlined">delete</span></button> },
          ]}
          rows={categories}
        />
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="فئة جديدة">
        <Input label="اسم الفئة" value={name} onChange={setName} required />
        <div className="flex" style={{ justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={() => setOpen(false)}>إلغاء</Button>
          <Button onClick={submit} disabled={!name}>حفظ</Button>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onCancel={() => setDeleteTarget(null)} onConfirm={remove} title="حذف الفئة" description={`سيتم حذف "${deleteTarget?.name}"`} confirmLabel="حذف" />
    </div>
  )
}
export default MerchantCategories
