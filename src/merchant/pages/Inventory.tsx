import { FunctionalComponent } from 'preact'
import { useState } from 'preact/hooks'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { Table } from '../../shared/components/ui/Table'
import { Badge } from '../../shared/components/ui/Badge'
import { Button } from '../../shared/components/ui/Button'
import { Search } from '../../shared/components/ui/Search'
import { useStore } from '../../shared/hooks/useStore'
import { useCollection } from '../../shared/hooks/useCollection'
import { useToast } from '../../shared/hooks/useToast'
import { productsService } from '../../shared/services/products'
import { EmptyState } from '../../shared/components/ui/EmptyState'
import { Modal } from '../../shared/components/ui/Modal'
import type { Product, ProductVariant } from '../../shared/types'

export const MerchantInventory: FunctionalComponent = () => {
  const { store } = useStore()
  const storeId = store?.id || ''
  const productsRes = useCollection<Product>('products', { storeId, orderBy: { field: 'createdAt' } })
  const products = productsRes.data
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [stockOnly, setStockOnly] = useState(false)
  const [adjusting, setAdjusting] = useState<Product | null>(null)
  const [delta, setDelta] = useState(0)

  const filtered = products.filter((p) => {
    const matchesQuery = p.name.includes(query) || (p.sku || '').includes(query)
    const isLow = (p.stock ?? 0) <= (p.lowStockThreshold ?? 5)
    return matchesQuery && (!stockOnly || isLow)
  })

  const lowCount = products.filter((p) => (p.stock ?? 0) <= (p.lowStockThreshold ?? 5)).length
  const outCount = products.filter((p) => (p.stock ?? 0) === 0).length

  const applyAdjustment = async () => {
    if (!adjusting || !delta) return
    const newStock = Math.max(0, (adjusting.stock ?? 0) + delta)
    await productsService.update(adjusting.id, { stock: newStock })
    toast.push(`تم تحديث مخزون "${adjusting.name}"`)
    setAdjusting(null)
    setDelta(0)
  }

  const variantStock = (p: Product): number => (p.variants || []).reduce((s, v: ProductVariant) => s + (v.stock || 0), 0)

  return (
    <div>
      <PageHeader
        title="المخزون"
        subtitle={`${products.length} منتج • ${lowCount} منخفض • ${outCount} نفد`}
      />
      <div className="grid grid-3" style={{ marginBottom: '1rem' }}>
        <div className="stat-card">
          <span className="stat-card-label">إجمالي المنتجات</span>
          <strong className="stat-value">{products.length}</strong>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">منخفض المخزون</span>
          <strong className="stat-value">{lowCount}</strong>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">نفد المخزون</span>
          <strong className="stat-value">{outCount}</strong>
        </div>
      </div>

      <div className="toolbar">
        <Search value={query} onChange={setQuery} placeholder="بحث بالاسم أو SKU..." />
        <label className="flex align-center" style={{ gap: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          <input type="checkbox" checked={stockOnly} onChange={(e) => setStockOnly((e.target as HTMLInputElement).checked)} />
          منخفض فقط
        </label>
      </div>

      <Card>
        {filtered.length === 0 ? (
          <EmptyState icon="inventory_2" title="لا توجد منتجات" description={stockOnly ? 'لا توجد منتجات منخفضة المخزون.' : 'أضف منتجاتك من صفحة المنتجات للبدء.'} />
        ) : (
          <Table
            columns={[
              { key: 'name', header: 'المنتج', render: (p: Product) => <span className="flex"><img src={p.images?.[0]} style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }} /><span className="grow">{p.name}</span></span> },
              { key: 'sku', header: 'SKU', render: (p: Product) => <span className="monospace muted">{p.sku || '—'}</span> },
              { key: 'stock', header: 'المخزون الحالي', render: (p: Product) => <Badge tone={p.stock === 0 ? 'red' : p.stock <= (p.lowStockThreshold ?? 5) ? 'amber' : 'green'}>{p.stock}</Badge> },
              { key: 'variants', header: 'مخزون المتغيرات', render: (p: Product) => (p.variants || []).length > 0 ? <span className="muted">{variantStock(p)}</span> : <span className="muted">—</span> },
              { key: 'threshold', header: 'حد التنبيه', render: (p: Product) => <span className="muted">{p.lowStockThreshold ?? 5}</span> },
              { key: 'actions', header: '', render: (p: Product) => <Button variant="ghost" size="sm" icon="add" onClick={() => { setAdjusting(p); setDelta(0) }}>تعديل</Button> },
            ]}
            rows={filtered}
          />
        )}
      </Card>

      <Modal open={!!adjusting} onClose={() => setAdjusting(null)} title={`تعديل مخزون: ${adjusting?.name || ''}`} footer={<><Button variant="ghost" onClick={() => setAdjusting(null)}>إلغاء</Button><Button onClick={applyAdjustment} icon="check" disabled={!delta}>حفظ</Button></>}>
        <p className="muted small mb-2">المخزون الحالي: <strong>{adjusting?.stock}</strong></p>
        <div className="field">
          <label className="field-label">الكمية (موجب للإضافة / سالب للخصم)</label>
          <input className="input" type="number" value={delta} onChange={(e) => setDelta(Number((e.target as HTMLInputElement).value))} />
        </div>
      </Modal>
    </div>
  )
}
export default MerchantInventory