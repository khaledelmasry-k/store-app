import { FunctionalComponent } from 'preact'
import { useState } from 'preact/hooks'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { StatsCard } from '../../shared/components/ui/StatsCard'
import { Table } from '../../shared/components/ui/Table'
import { Badge } from '../../shared/components/ui/Badge'
import { Button } from '../../shared/components/ui/Button'
import { FilterBar } from '../../shared/components/ui/FilterBar'
import { EmptyState } from '../../shared/components/ui/EmptyState'
import { Modal } from '../../shared/components/ui/Modal'
import { Input } from '../../shared/components/ui/Input'
import { ConfirmDialog } from '../../shared/components/ui/ConfirmDialog'
import { useStore } from '../../shared/hooks/useStore'
import { useCollection } from '../../shared/hooks/useCollection'
import { useToast } from '../../shared/hooks/useToast'
import { categoriesService } from '../../shared/services/categories'
import { slugify } from '../../shared/utils/format'
import type { Category } from '../../shared/types'
import { Icon } from '../../shared/components/ui/Icon'

export const MerchantCategories: FunctionalComponent = () => {
  const { store } = useStore()
  const storeId = store?.id || ''
  const categoriesRes = useCollection<Category>('categories', { storeId, orderBy: { field: 'order' } })
  const categories = categoriesRes.data
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)
  const [name, setName] = useState('')

  const filtered = categories.filter((c) => c.name.includes(query))

  const submit = async () => {
    if (!name) return
    try {
      await categoriesService.create(storeId, {
        name,
        slug: slugify(name),
        order: categories.length,
        active: true,
      })
      toast.push('تم إضافة الفئة')
      setOpen(false)
      setName('')
    } catch (err: any) {
      toast.push('تعذر إضافة الفئة', err?.message || 'حدث خطأ غير متوقع', 'error')
    }
  }

  const remove = async () => {
    if (!deleteTarget) return
    try {
      await categoriesService.remove(deleteTarget.id)
      toast.push('تم حذف الفئة')
    } catch (err: any) {
      toast.push('تعذر حذف الفئة', err?.message || 'حدث خطأ غير متوقع', 'error')
    }
    setDeleteTarget(null)
  }

  if (categoriesRes.loading) return <div className="loading-screen"><span className="spinner spinner-lg" /></div>

  return (
    <div className="merchant-operations merchant-categories-page">
      <PageHeader title="الفئات" subtitle={`${categories.length} فئة`} actions={<Button icon="add" onClick={() => setOpen(true)}>فئة جديدة</Button>} />

      <div className="stats-grid">
        <StatsCard title="إجمالي الفئات" value={categories.length} icon="category" tone="primary" />
        <StatsCard title="نشطة" value={categories.filter((c) => c.active).length} icon="check_circle" tone="green" />
        <StatsCard title="مخفية" value={categories.filter((c) => !c.active).length} icon="visibility_off" tone="slate" />
      </div>

      <Card>
        <FilterBar search={query} onSearch={setQuery} searchPlaceholder="بحث بالاسم..." />
        {filtered.length === 0 ? (
          <EmptyState icon="category" title="لا توجد فئات" description={query ? 'لا توجد نتائج للبحث' : 'لم يتم إضافة أي فئات بعد'} />
        ) : (
          <Table cardMode
            columns={[
              { key: 'name', header: 'الفئة' },
              { key: 'slug', header: 'الرابط', render: (c: Category) => <span className="monospace">{c.slug}</span> },
              { key: 'order', header: 'الترتيب' },
              { key: 'active', header: 'الحالة', render: (c: Category) => <Badge tone={c.active ? 'green' : 'slate'}>{c.active ? 'نشطة' : 'مخفية'}</Badge> },
              { key: 'actions', header: '', render: (c: Category) => <button className="icon-btn" onClick={() => setDeleteTarget(c)}><Icon name="delete" /></button> },
            ]}
            rows={filtered}
          />
        )}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="فئة جديدة">
        <Input label="اسم الفئة" value={name} onChange={setName} required />
        <div className="flex flex-end">
          <Button variant="ghost" onClick={() => setOpen(false)}>إلغاء</Button>
          <Button onClick={submit} disabled={!name}>حفظ</Button>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onCancel={() => setDeleteTarget(null)} onConfirm={remove} title="حذف الفئة" description={`سيتم حذف "${deleteTarget?.name}"`} confirmLabel="حذف" />
    </div>
  )
}
export default MerchantCategories
