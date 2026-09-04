import { FunctionalComponent } from 'preact'
import { useState } from 'preact/hooks'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { StatsCard } from '../../shared/components/ui/StatsCard'
import { Badge } from '../../shared/components/ui/Badge'
import { Button } from '../../shared/components/ui/Button'
import { EmptyState } from '../../shared/components/ui/EmptyState'
import { Modal } from '../../shared/components/ui/Modal'
import { Input } from '../../shared/components/ui/Input'
import { Toggle } from '../../shared/components/ui/Toggle'
import { ConfirmDialog } from '../../shared/components/ui/ConfirmDialog'
import { useStore } from '../../shared/hooks/useStore'
import { useCollection } from '../../shared/hooks/useCollection'
import { useToast } from '../../shared/hooks/useToast'
import { categoriesService } from '../../shared/services/categories'
import { slugify } from '../../shared/utils/format'
import type { Category, Product } from '../../shared/types'
import { Icon } from '../../shared/components/ui/Icon'
import './Categories.css'

export const MerchantCategories: FunctionalComponent = () => {
  const { store } = useStore()
  const storeId = store?.id || ''
  const categoriesRes = useCollection<Category>('categories', { storeId, orderBy: { field: 'order' } })
  const categories = categoriesRes.data
  const productsRes = useCollection<Product>('products', { storeId })
  const products = productsRes.data
  const countByCategory = new Map<string, number>()
  for (const p of products) {
    if (p.categoryId) countByCategory.set(p.categoryId, (countByCategory.get(p.categoryId) || 0) + 1)
  }
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Category | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)
  const [name, setName] = useState('')

  const filtered = categories.filter((c) => (c.name || '').includes(query))

  const openCreate = () => {
    setEditTarget(null)
    setName('')
    setOpen(true)
  }
  const openEdit = (c: Category) => {
    setEditTarget(c)
    setName(c.name)
    setOpen(true)
  }

  const submit = async () => {
    if (!name) return
    try {
      if (editTarget) {
        await categoriesService.update(editTarget.id, { name, slug: slugify(name) })
        toast.push('تم تحديث الفئة')
      } else {
        await categoriesService.create(storeId, {
          name,
          slug: slugify(name),
          order: categories.length,
          active: true,
        })
        toast.push('تم إضافة الفئة')
      }
      setOpen(false)
      setName('')
    } catch (err: any) {
      toast.push(editTarget ? 'تعذر تحديث الفئة' : 'تعذر إضافة الفئة', err?.message || 'حدث خطأ غير متوقع', 'error')
    }
  }

  const toggleActive = async (c: Category, v: boolean) => {
    try {
      await categoriesService.update(c.id, { active: v })
    } catch (err: any) {
      toast.push('تعذر تحديث حالة الفئة', err?.message || 'حدث خطأ غير متوقع', 'error')
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
      <PageHeader
        breadcrumb="كتالوج المتجر"
        title="الفئات"
        subtitle="نظّم منتجاتك في فئات واضحة تظهر للعملاء في المتجر"
        actions={<Button icon="add" onClick={openCreate}>فئة جديدة</Button>}
      />

      <div className="stats-grid">
        <StatsCard title="إجمالي الفئات" value={categories.length} icon="category" tone="primary" />
        <StatsCard title="نشطة" value={categories.filter((c) => c.active).length} icon="check_circle" tone="green" />
        <StatsCard title="مخفية" value={categories.filter((c) => !c.active).length} icon="visibility_off" tone="slate" />
      </div>

      <div className="category-search">
        <Icon name="search" ariaHidden />
        <input type="text" placeholder="ابحث بالاسم..." value={query} onInput={(e) => setQuery((e.target as HTMLInputElement).value)} aria-label="بحث في الفئات" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="category" title={query ? 'لا توجد نتائج' : 'لا توجد فئات'} description={query ? 'جرّب بحثاً آخر.' : 'أضف أول فئة لتنظيم منتجاتك.'} action={!query && <Button icon="add" onClick={openCreate}>فئة جديدة</Button>} />
      ) : (
        <div className="category-list">
          {filtered.map((c) => (
            <div key={c.id} className="category-row">
              <span className="category-icon"><Icon name="category" ariaHidden /></span>
              <span className="category-main">
                <span className="category-name">{c.name}</span>
                <span className="category-slug"><span className="monospace">{c.slug}</span> • <span className="muted">{countByCategory.get(c.id) || 0} منتج</span></span>
              </span>
              <Badge tone={c.active ? 'green' : 'slate'}>{c.active ? 'نشطة' : 'مخفية'}</Badge>
              <span className="category-actions">
                <Toggle checked={c.active} onChange={(v) => toggleActive(c, v)} />
                <button className="icon-btn" onClick={() => openEdit(c)} title="تعديل"><Icon name="edit" /></button>
                <button className="icon-btn icon-btn-danger" onClick={() => setDeleteTarget(c)} title="حذف"><Icon name="delete" /></button>
              </span>
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editTarget ? 'تعديل الفئة' : 'فئة جديدة'} footer={<><Button variant="ghost" onClick={() => setOpen(false)}>إلغاء</Button><Button onClick={submit} icon="check" disabled={!name}>حفظ</Button></>}>
        <Input label="اسم الفئة" value={name} onChange={setName} required />
        <p className="muted small">الرابط التلقائي: <span className="monospace">{slugify(name || '—')}</span></p>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onCancel={() => setDeleteTarget(null)} onConfirm={remove} title="حذف الفئة" description={`سيتم حذف "${deleteTarget?.name}" ولن تظهر منتجاتها في هذه الفئة.`} confirmLabel="حذف" />
    </div>
  )
}
export default MerchantCategories