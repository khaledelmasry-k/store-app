import { FunctionalComponent, Fragment } from 'preact'
import { useState } from 'preact/hooks'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { Table } from '../../shared/components/ui/Table'
import { Badge } from '../../shared/components/ui/Badge'
import { Button } from '../../shared/components/ui/Button'
import { Modal } from '../../shared/components/ui/Modal'
import { Input } from '../../shared/components/ui/Input'
import { Textarea } from '../../shared/components/ui/Textarea'
import { Toggle } from '../../shared/components/ui/Toggle'
import { Search } from '../../shared/components/ui/Search'
import { ConfirmDialog } from '../../shared/components/ui/ConfirmDialog'
import { useStore } from '../../shared/hooks/useStore'
import { useCollection } from '../../shared/hooks/useCollection'
import { useToast } from '../../shared/hooks/useToast'
import { productsService } from '../../shared/services/products'
import { formatCurrency } from '../../shared/utils/format'
import type { Product } from '../../shared/types'

export const MerchantProducts: FunctionalComponent = () => {
  const { store } = useStore()
  const storeId = store?.id || ''
  const productsRes = useCollection<Product>('products', { storeId, orderBy: { field: 'createdAt' } });
  const products = productsRes.data
  const categoriesRes = useCollection('categories', { storeId });
  const categories = categoriesRes.data
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<Partial<Product>>({ active: true, images: [] as string[], colors: [] as string[], sizes: [] as string[], variants: [] })

  const filtered = products.filter((p) => p.name.includes(query) || (p.sku || '').includes(query))

  const submit = async () => {
    if (!form.name || !form.price) {
      toast.push('أدخل اسم وسعر المنتج', undefined, 'error')
      return
    }
    setSaving(true)
    await productsService.create(storeId, {
      name: form.name,
      description: form.description || '',
      price: Number(form.price),
      oldPrice: form.oldPrice ? Number(form.oldPrice) : null,
      sku: form.sku || null,
      categoryId: form.categoryId || null,
      images: form.images || [],
      stock: Number(form.stock || 0),
      variants: form.variants || [],
      colors: form.colors || [],
      sizes: form.sizes || [],
      active: form.active ?? true,
      featured: form.featured || false,
      lowStockThreshold: form.lowStockThreshold ?? 5,
    })
    toast.push('تم إضافة المنتج')
    setOpen(false)
    setForm({ active: true, images: [], colors: [], sizes: [], variants: [] })
    setSaving(false)
  }

  const remove = async () => {
    if (!deleteTarget) return
    await productsService.remove(deleteTarget.id)
    toast.push('تم حذف المنتج')
    setDeleteTarget(null)
  }

  const toggleActive = async (p: Product) => {
    await productsService.update(p.id, { active: !p.active })
  }

  return (
    <div>
      <PageHeader title="المنتجات" subtitle={`${products.length} منتج`} actions={<Button icon="add" onClick={() => setOpen(true)}>منتج جديد</Button>} />
      <div className="toolbar">
        <Search value={query} onChange={setQuery} placeholder="بحث باسم المنتج أو SKU..." />
      </div>
      <Card>
        <Table
          columns={[
            { key: 'name', header: 'المنتج', render: (p: Product) => <span className="flex"><img src={p.images?.[0]} style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }} /><span className="grow">{p.name}</span></span> },
            { key: 'categoryId', header: 'الفئة', render: (p: Product) => (categories.find((c: any) => c.id === p.categoryId) as any)?.name || '—' },
            { key: 'price', header: 'السعر', render: (p: Product) => formatCurrency(p.price) },
            { key: 'stock', header: 'المخزون', render: (p: Product) => <Badge tone={p.stock === 0 ? 'red' : p.stock <= (p.lowStockThreshold ?? 5) ? 'amber' : 'green'}>{p.stock}</Badge> },
            { key: 'active', header: 'النشر', render: (p: Product) => <Toggle checked={p.active} onChange={() => toggleActive(p)} /> },
            { key: 'actions', header: '', render: (p: Product) => <button className="icon-btn" onClick={() => setDeleteTarget(p)}><span className="material-symbols-outlined">delete</span></button> },
          ]}
          rows={filtered}
        />
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="منتج جديد" size="lg" footer={<Fragment><Button variant="ghost" onClick={() => setOpen(false)}>إلغاء</Button><Button onClick={submit} loading={saving}>حفظ المنتج</Button></Fragment>}>
        <div className="grid grid-2">
          <Input label="اسم المنتج" value={form.name || ''} onChange={(v) => setForm({ ...form, name: v })} required />
          <Input label="SKU" value={form.sku || ''} onChange={(v) => setForm({ ...form, sku: v })} />
        </div>
        <Textarea label="الوصف" value={form.description || ''} onChange={(v) => setForm({ ...form, description: v })} rows={3} />
        <div className="grid grid-3">
          <Input label="السعر" type="number" value={form.price || ''} onChange={(v) => setForm({ ...form, price: Number(v) })} required />
          <Input label="السعر قبل الخصم" type="number" value={form.oldPrice || ''} onChange={(v) => setForm({ ...form, oldPrice: Number(v) })} />
          <Input label="المخزون" type="number" value={form.stock || ''} onChange={(v) => setForm({ ...form, stock: Number(v) })} />
        </div>
        <select className="input" value={form.categoryId || ''} onChange={(e) => setForm({ ...form, categoryId: (e.target as HTMLSelectElement).value })}>
          <option value="">بدون فئة</option>
          {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className="grid grid-2 mt-1">
          <Input label="الألوان (فاصلة ,)" value={(form.colors || []).join(',')} onChange={(v) => setForm({ ...form, colors: v.split(',').map((x) => x.trim()).filter(Boolean) })} />
          <Input label="المقاسات (فاصلة ,)" value={(form.sizes || []).join(',')} onChange={(v) => setForm({ ...form, sizes: v.split(',').map((x) => x.trim()).filter(Boolean) })} />
        </div>
        <Input label="رابط الصورة" value={(form.images || [])[0] || ''} onChange={(v) => setForm({ ...form, images: v ? [v] : [] })} />
        <div className="field mt-1">
          <Toggle checked={form.active ?? true} onChange={(v) => setForm({ ...form, active: v })} label="منشور في المتجر" />
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onCancel={() => setDeleteTarget(null)} onConfirm={remove} title="حذف المنتج" description={`سيتم حذف "${deleteTarget?.name}" نهائياً.`} confirmLabel="حذف" />
    </div>
  )
}
export default MerchantProducts
