import { FunctionalComponent, Fragment } from 'preact'
import { useState } from 'preact/hooks'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { StatsCard } from '../../shared/components/ui/StatsCard'
import { Badge } from '../../shared/components/ui/Badge'
import { Button } from '../../shared/components/ui/Button'
import { Modal } from '../../shared/components/ui/Modal'
import { Toggle } from '../../shared/components/ui/Toggle'
import { Search } from '../../shared/components/ui/Search'
import { Select } from '../../shared/components/ui/Select'
import { ConfirmDialog } from '../../shared/components/ui/ConfirmDialog'
import { EmptyState } from '../../shared/components/ui/EmptyState'
import { Table } from '../../shared/components/ui/Table'
import { Tabs } from '../../shared/components/ui/Tabs'
import { Drawer } from '../../shared/components/ui/Drawer'
import { useStore } from '../../shared/hooks/useStore'
import { useCollection } from '../../shared/hooks/useCollection'
import { useToast } from '../../shared/hooks/useToast'
import { productsService } from '../../shared/services/products'
import { formatCurrency } from '../../shared/utils/format'
import { stockTone } from '../../shared/utils/format'
import type { Product, Category, ProductVariant } from '../../shared/types'
import { Icon } from '../../shared/components/ui/Icon'
import { ProductForm } from '../components/ProductForm'
import { SmartImage } from '../../shared/components/ui/SmartImage'

export const MerchantProducts: FunctionalComponent = () => {
  const { store } = useStore()
  const storeId = store?.id || ''
  const productsRes = useCollection<Product>('products', { storeId, orderBy: { field: 'createdAt' } })
  const products = productsRes.data
  const categoriesRes = useCollection<Category>('categories', { storeId })
  const categories = categoriesRes.data
  const toast = useToast()

  const [tab, setTab] = useState<'products' | 'inventory'>('products')

  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)

  const [stockQuery, setStockQuery] = useState('')
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all')
  const [adjusting, setAdjusting] = useState<Product | null>(null)
  const [delta, setDelta] = useState(0)

  const openCreate = () => {
    setEditing(null)
    setDrawerOpen(true)
  }
  const openEdit = (p: Product) => {
    setEditing(p)
    setDrawerOpen(true)
  }

  const filtered = products.filter((p) => {
    const matchesQuery = p.name.includes(query) || (p.sku || '').includes(query)
    const matchesStatus = !statusFilter || (statusFilter === 'active' ? p.active : !p.active)
    const matchesCategory = !categoryFilter || p.categoryId === categoryFilter
    return matchesQuery && matchesStatus && matchesCategory
  })

  const isLow = (p: Product) => (p.stock ?? 0) <= (p.lowStockThreshold ?? 5)

  const inventoryFiltered = products.filter((p) => {
    const matchesQuery = p.name.includes(stockQuery) || (p.sku || '').includes(stockQuery)
    const matchesStock = stockFilter === 'all' || (stockFilter === 'low' ? isLow(p) : (p.stock ?? 0) === 0)
    return matchesQuery && matchesStock
  })

  const lowCount = products.filter(isLow).length
  const outCount = products.filter((p) => (p.stock ?? 0) === 0).length

  const variantStock = (p: Product): number => (p.variants || []).reduce((s, v: ProductVariant) => s + (v.stock || 0), 0)

  const remove = async () => {
    if (!deleteTarget) return
    await productsService.remove(deleteTarget.id)
    toast.push('تم حذف المنتج')
    setDeleteTarget(null)
  }

  const toggleActive = async (p: Product) => {
    await productsService.update(p.id, { active: !p.active })
  }

  const applyAdjustment = async () => {
    if (!adjusting || !delta) return
    const newStock = Math.max(0, (adjusting.stock ?? 0) + delta)
    await productsService.update(adjusting.id, { stock: newStock })
    toast.push(`تم تحديث مخزون "${adjusting.name}"`)
    setAdjusting(null)
    setDelta(0)
  }

  const productCell = (p: Product) => (
    <span className="flex" style={{ gap: 10 }}>
      <SmartImage src={p.images?.[0]} alt={p.name} className="product-cell-thumb" placeholderClassName="product-thumb" />
      <span className="grow font-semibold">
        {p.name}
        {!p.active && <span className="ms-1"><Badge tone="amber">مسودة</Badge></span>}
      </span>
    </span>
  )

  return (
    <div>
      <PageHeader
        title="المنتجات والمخزون"
        subtitle={tab === 'products' ? `${products.length} منتج` : `${lowCount} منخفض • ${outCount} نفد المخزون`}
        actions={<Button icon="add" onClick={openCreate}>منتج جديد</Button>}
      />

      <Tabs
        tabs={[
          { key: 'products', label: 'المنتجات', count: products.length },
          { key: 'inventory', label: 'المخزون', count: lowCount },
        ]}
        active={tab}
        onChange={(k) => setTab(k as 'products' | 'inventory')}
      />

      {tab === 'products' ? (
        <Fragment>
          <div className="toolbar">
            <Search value={query} onChange={setQuery} placeholder="بحث باسم المنتج أو SKU..." />
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              placeholder="الحالة"
              options={[{ value: '', label: 'كل الحالات' }, { value: 'active', label: 'منشور' }, { value: 'inactive', label: 'مسودة' }]}
            />
            <Select
              value={categoryFilter}
              onChange={setCategoryFilter}
              placeholder="الفئة"
              options={[{ value: '', label: 'كل الفئات' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
            />
          </div>

          <Card>
            {filtered.length === 0 ? (
              <EmptyState
                title="لا توجد منتجات"
                description={query ? 'لا توجد نتائج تطابق بحثك.' : 'أضف منتجاتك للبدء.'}
                icon="inventory_2"
                action={!query && <Button icon="add" onClick={openCreate}>إضافة منتج</Button>}
              />
            ) : (
              <Table cardMode
                columns={[
                  { key: 'name', header: 'المنتج', render: productCell },
                  { key: 'category', header: 'الفئة', render: (p: Product) => <span className="muted">{categories.find((c) => c.id === p.categoryId)?.name || '—'}</span> },
                  { key: 'price', header: 'السعر', render: (p: Product) => formatCurrency(p.price) },
                  { key: 'stock', header: 'المخزون', render: (p: Product) => <Badge tone={stockTone(p)}>{p.stock}</Badge> },
                  { key: 'active', header: 'النشر', render: (p: Product) => <Toggle checked={p.active} onChange={() => toggleActive(p)} /> },
                  { key: 'actions', header: '', render: (p: Product) => (
                    <span className="flex" style={{ gap: 4 }}>
                      <button className="icon-btn" onClick={() => openEdit(p)} title="تعديل"><Icon name="edit" /></button>
                      <button className="icon-btn icon-btn-danger" onClick={() => setDeleteTarget(p)} title="حذف"><Icon name="delete" /></button>
                    </span>
                  ) },
                ]}
                rows={filtered}
              />
            )}
          </Card>
        </Fragment>
      ) : (
        <Fragment>
          <div className="stats-grid">
            <StatsCard title="إجمالي المنتجات" value={products.length} icon="inventory_2" tone="primary" />
            <StatsCard title="منخفض المخزون" value={lowCount} icon="warning" tone="amber" />
            <StatsCard title="نفد المخزون" value={outCount} icon="cancel" tone="red" />
          </div>

          <Card>
            <div className="toolbar">
              <Search value={stockQuery} onChange={setStockQuery} placeholder="بحث بالاسم أو SKU..." />
              <Select
                value={stockFilter}
                onChange={(v) => setStockFilter(v as 'all' | 'low' | 'out')}
                placeholder="المخزون"
                options={[
                  { value: 'all', label: 'كل المنتجات' },
                  { value: 'low', label: 'منخفض المخزون' },
                  { value: 'out', label: 'نفد المخزون' },
                ]}
              />
            </div>
            {inventoryFiltered.length === 0 ? (
              <EmptyState icon="inventory_2" title="لا توجد منتجات" description={stockQuery ? 'لا توجد نتائج للبحث' : 'أضف منتجاتك من تبويب المنتجات للبدء.'} />
            ) : (
              <Table cardMode
                columns={[
                  { key: 'name', header: 'المنتج', render: productCell },
                  { key: 'sku', header: 'SKU', render: (p: Product) => <span className="monospace muted">{p.sku || '—'}</span> },
                  { key: 'stock', header: 'المخزون', render: (p: Product) => <Badge tone={stockTone(p)}>{p.stock}</Badge> },
                  { key: 'variants', header: 'مخزون المتغيرات', render: (p: Product) => (p.variants || []).length > 0 ? <span className="muted">{variantStock(p)}</span> : <span className="muted">—</span> },
                  { key: 'threshold', header: 'حد التنبيه', render: (p: Product) => <span className="muted">{p.lowStockThreshold ?? 5}</span> },
                  { key: 'actions', header: '', render: (p: Product) => <Button variant="ghost" size="sm" icon="add" onClick={() => { setAdjusting(p); setDelta(0) }}>تعديل</Button> },
                ]}
                rows={inventoryFiltered}
              />
            )}
          </Card>
        </Fragment>
      )}

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={editing ? 'تعديل المنتج' : 'منتج جديد'} size="lg">
        <ProductForm
          key={editing?.id || 'new'}
          storeId={storeId}
          initial={editing}
          categories={categories}
          onClose={() => setDrawerOpen(false)}
          onSaved={() => setDrawerOpen(false)}
        />
      </Drawer>

      <Modal open={!!adjusting} onClose={() => setAdjusting(null)} title={`تعديل مخزون: ${adjusting?.name || ''}`} footer={<><Button variant="ghost" onClick={() => setAdjusting(null)}>إلغاء</Button><Button onClick={applyAdjustment} icon="check" disabled={!delta}>حفظ</Button></>}>
        <p className="muted small mb-2">المخزون الحالي: <strong>{adjusting?.stock}</strong></p>
        <div className="field">
          <label className="field-label">الكمية (موجب للإضافة / سالب للخصم)</label>
          <input className="input" type="number" value={delta} onChange={(e) => setDelta(Number((e.target as HTMLInputElement).value))} />
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onCancel={() => setDeleteTarget(null)} onConfirm={remove} title="حذف المنتج" description={`سيتم حذف "${deleteTarget?.name}" نهائياً.`} confirmLabel="حذف" />
    </div>
  )
}
export default MerchantProducts
