import { FunctionalComponent, Fragment } from 'preact'
import { useState } from 'preact/hooks'
import { Card } from '../../shared/components/ui/Card'
import { Badge } from '../../shared/components/ui/Badge'
import { Button } from '../../shared/components/ui/Button'
import { Modal } from '../../shared/components/ui/Modal'
import { Toggle } from '../../shared/components/ui/Toggle'
import { Search } from '../../shared/components/ui/Search'
import { Select } from '../../shared/components/ui/Select'
import { ConfirmDialog } from '../../shared/components/ui/ConfirmDialog'
import { EmptyState } from '../../shared/components/ui/EmptyState'
import { Loading } from '../../shared/components/ui/Loading'
import { Table } from '../../shared/components/ui/Table'
import { Tabs } from '../../shared/components/ui/Tabs'
import { Drawer } from '../../shared/components/ui/Drawer'
import { useStore } from '../../shared/hooks/useStore'
import { useCollection } from '../../shared/hooks/useCollection'
import { useSubscription } from '../../shared/hooks/useSubscription'
import { useToast } from '../../shared/hooks/useToast'
import { productsService, productCostsService } from '../../shared/services/products'
import { deleteProductImage } from '../../shared/services/uploads'
import { formatCurrency } from '../../shared/utils/format'
import { stockTone } from '../../shared/utils/format'
import { lineProfit } from '../../shared/utils/pricing'
import { variantStock } from '../../shared/utils/product-variants'
import { variantLabel } from '../../shared/types'
import type { Product, ProductCost, Category } from '../../shared/types'
import { LimitRaiser } from '../components/LimitRaiser'
import { Icon } from '../../shared/components/ui/Icon'
import { ProductForm } from '../components/ProductForm'
import { SmartImage } from '../../shared/components/ui/SmartImage'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { StatsCard } from '../../shared/components/ui/StatsCard'
import { SectionHeader } from '../../shared/components/ui/SectionHeader'
import './Products.css'

interface VariantStockCellProps {
  product: Product
}

/**
 * Per-variant (per-size) stock breakdown for a product. Replaces the previous
 * single total, so the merchant can see exactly which size is low/out while
 * others are fine.
 */
function VariantStockCell({ product }: VariantStockCellProps) {
  const variants = (product.variants || []).filter((v) => (v.color || '') === '' || (product.colors || []).includes(v.color || ''))
  if (variants.length === 0) {
    return <span className="muted">—</span>
  }
  const threshold = product.lowStockThreshold ?? 5
  return (
    <div className="variant-stock-cell">
      {variants.map((v) => {
        const label = variantLabel(v.color, v.size)
        const tone = stockTone({ stock: v.stock, lowStockThreshold: threshold })
        return (
          <span key={v.id || label} className="variant-stock-row" title={`${label}: ${v.stock ?? 0}`}>
            <span className="muted small">{label || v.size || '—'}</span>
            <Badge tone={tone}>{v.stock ?? 0}</Badge>
          </span>
        )
      })}
      <span className="muted small" style={{ marginTop: 2 }}>المجموع: {variantStock(product)}</span>
    </div>
  )
}

interface InventoryKpiProps {
  label: string
  icon: string
  value: number
  caption: string
}

const InventoryKpi: FunctionalComponent<InventoryKpiProps> = ({ label, icon, value, caption }) => (
  <StatsCard title={label} value={value} icon={icon} tone="primary" changeLabel={caption} />
)

export const MerchantProducts: FunctionalComponent = () => {
  const { store } = useStore()
  const storeId = store?.id || ''
  const [retryKey, setRetryKey] = useState(0)
  const productsRes = useCollection<Product>('products', { storeId, orderBy: { field: 'createdAt' } }, true, [retryKey])
  const products = productsRes.data
  const costsRes = useCollection<ProductCost>('productCosts', { storeId })
  const costs = costsRes.data
  const categoriesRes = useCollection<Category>('categories', { storeId })
  const categories = categoriesRes.data
  const costByProduct = new Map(costs.map((c) => [c.id, c.costPrice]))
  const costOf = (p: Product): number | null => {
    const c = costByProduct.get(p.id)
    return typeof c === 'number' && c >= 0 ? c : null
  }
  const toast = useToast()
  const sub = useSubscription(storeId)
  const productLimit = Number(sub.plan?.productLimit || 0)
  const atProductLimit = productLimit > 0 && products.length >= productLimit
  const hasPlanLimit = productLimit > 0
  const planUsagePct = hasPlanLimit ? Math.min(100, Math.round((products.length / productLimit) * 100)) : 0

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
    const matchesQuery = (p.name || "").includes(query) || (p.sku || "").includes(query)
    const matchesStatus = !statusFilter || (statusFilter === 'active' ? p.active : !p.active)
    const matchesCategory = !categoryFilter || p.categoryId === categoryFilter
    return matchesQuery && matchesStatus && matchesCategory
  })

  const isLow = (p: Product) => {
    const threshold = p.lowStockThreshold ?? 5
    const vs = (p.variants || []).map((v) => v.stock || 0)
    // Variant products: low if ANY size is at/below the threshold (amber or out).
    if (vs.length > 0) return vs.some((s) => s <= threshold)
    return (p.stock ?? 0) <= threshold
  }

  const isOutOfStock = (p: Product) => {
    const vs = (p.variants || []).map((v) => v.stock || 0)
    if (vs.length > 0) return vs.every((s) => s === 0)
    return (p.stock ?? 0) === 0
  }

  const inventoryFiltered = products.filter((p) => {
    const matchesQuery = (p.name || "").includes(stockQuery) || (p.sku || "").includes(stockQuery)
    const matchesStock = stockFilter === 'all' || (stockFilter === 'low' ? isLow(p) : isOutOfStock(p))
    return matchesQuery && matchesStock
  })

  const lowCount = products.filter(isLow).length
  const outCount = products.filter(isOutOfStock).length

  const remove = async () => {
    if (!deleteTarget) return
    const target = deleteTarget
    try {
      await productsService.remove(target.id)
      // Remove the private cost doc too (productCosts is keyed by product id).
      try {
        await productCostsService.remove(target.id)
      } catch {
        // No cost doc existed — nothing to remove.
      }
      // Best-effort storage cleanup: delete this product's images ONLY if no
      // other product still references them (shared URLs are kept alive).
      await cleanupOrphanedImages(target)
      toast.push('تم حذف المنتج')
    } catch (err: any) {
      toast.push('تعذر حذف المنتج', err?.message || 'حدث خطأ غير متوقع', 'error')
    }
    setDeleteTarget(null)
  }

  const cleanupOrphanedImages = async (target: Product): Promise<void> => {
    const urls = target.images || []
    if (urls.length === 0) return
    try {
      const others = await productsService.all()
      const referenced = new Set<string>()
      for (const p of others) {
        for (const img of p.images || []) referenced.add(img)
      }
      for (const url of urls) {
        if (referenced.has(url)) continue
        try {
          await deleteProductImage(url)
        } catch (err) {
          console.error('storage delete failed', url, err)
        }
      }
    } catch (err) {
      console.error('storage cleanup scan failed', err)
    }
  }

  const toggleActive = async (p: Product) => {
    try {
      await productsService.update(p.id, { active: !p.active })
    } catch (err: any) {
      toast.push('تعذر تحديث حالة النشر', err?.message || 'حدث خطأ غير متوقع', 'error')
    }
  }

  const applyAdjustment = async () => {
    if (!adjusting || !delta) return
    // Variant products split their source-of-truth stock per combo; a flat
    // quick-adjust would silently desync variants and flat stock. Route to the
    // product form where each color/size stock is edited in place.
    if ((adjusting.variants || []).length > 0) {
      setAdjusting(null)
      setDelta(0)
      toast.push('منتج بمتغيرات', 'عدّل مخزون كل مقاس/لون من صفحة تعديل المنتج.', 'info')
      openEdit(adjusting)
      return
    }
    const newStock = Math.max(0, (adjusting.stock ?? 0) + delta)
    try {
      await productsService.update(adjusting.id, { stock: newStock })
      toast.push(`تم تحديث مخزون "${adjusting.name}"`)
    } catch (err: any) {
      toast.push('تعذر تحديث المخزون', err?.message || 'حدث خطأ غير متوقع', 'error')
    }
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
    <div className="merchant-operations merchant-products-page products-page-canonical">
      <PageHeader
        breadcrumb="كتالوج المتجر"
        title="المنتجات والمخزون"
        subtitle={tab === 'products' ? `${products.length} منتج` : `${lowCount} منخفض • ${outCount} نفد المخزون`}
        actions={<Button icon="add" onClick={openCreate}>منتج جديد</Button>}
      />

      {hasPlanLimit && (
        <div className="products-usage-bar">
          <div className="products-usage-head">
            <span>المنتجات المستخدمة من حد الخطة</span>
            <strong>{products.length} / {productLimit}</strong>
          </div>
          <div className="products-usage-track">
            <div className="products-usage-fill" style={{ width: `${planUsagePct}%` }} />
          </div>
        </div>
      )}

      {productsRes.error && (
        <div className="products-error-banner">
          <Icon name="error" ariaHidden />
          <span>فشل في تحميل بعض البيانات. يرجى المحاولة مرة أخرى.</span>
          <button type="button" onClick={() => setRetryKey((k) => k + 1)}>إعادة المحاولة</button>
        </div>
      )}

      {atProductLimit && (
        <div className="mt-2 mb-2">
          <LimitRaiser
            label="المنتجات"
            detail={`باقتك الحالية تسمح بـ ${productLimit} منتج كحد أقصى. ارفع باقتك لإضافة المزيد.`}
          />
        </div>
      )}

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
          <SectionHeader title="كتالوج المنتجات" subtitle="إدارة الأسعار والنشر والمخزون من مساحة عمل واحدة" />
          <Card className="mt-1 products-tab-card">
            <div className="products-toolbar mb-2">
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

          {productsRes.loading ? (
            <Loading variant="table" />
          ) : filtered.length === 0 ? (
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
                  { key: 'price', header: 'سعر البيع', render: (p: Product) => formatCurrency(p.price) },
                  { key: 'costPrice', header: 'سعر التكلفة', render: (p: Product) => { const c = costOf(p); return <span className={c == null ? 'muted' : ''}>{c == null ? '—' : formatCurrency(c)}</span> } },
                  { key: 'profit', header: 'الربح للوحدة', render: (p: Product) => { const c = costOf(p); if (c == null) return <span className="muted">—</span>; const profit = lineProfit(p.price, 1, c, p.pricingMode, p.quantityTiers); return <span className={profit < 0 ? 'text-red' : ''}>{formatCurrency(profit)}</span> } },
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

          {productsRes.loading ? null : filtered.length === 0 ? null : (
            <div className="products-mobile-cards">
              {filtered.map((p) => {
                const cat = categories.find((c) => c.id === p.categoryId)?.name
                const qty = variantStock(p)
                const low = isLow(p)
                return (
                  <div key={p.id} className="pcard" onClick={() => openEdit(p)}>
                    <SmartImage src={p.images?.[0]} alt={p.name} className="pcard-thumb" placeholderClassName="product-thumb" />
                    <div className="pcard-body">
                      <div className="pcard-top">
                        <div className="pcard-info">
                          <h3>{p.name}</h3>
                          <div className="pcard-chips">
                            {p.sku && <span className="pcard-sku">{p.sku}</span>}
                            {cat && <span className="pcard-cat">{cat}</span>}
                          </div>
                        </div>
                        <span className={`pcard-status${p.active ? ' is-on' : ''}`}>
                          <span className="pcard-status-dot" />
                          {p.active ? 'منشور' : 'مسودة'}
                        </span>
                      </div>
                      <div className="pcard-bottom">
                        <div>
                          <span className="pcard-label">السعر</span>
                          <span className="pcard-price">{formatCurrency(p.price)}</span>
                        </div>
                        <div className="pcard-qty">
                          <span className={`pcard-qty-label${low ? ' is-warn' : ''}`}>{low ? <Icon name="warning" ariaHidden /> : <span className="pcard-qty-spacer">.</span>}</span>
                          <span className="pcard-qty-value"><span className="pcard-qty-unit">كمية: </span>{qty}</span>
                        </div>
                        <Toggle checked={p.active} onChange={() => toggleActive(p)} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Fragment>
      ) : (
        <Fragment>
          <div className="stat-grid">
            <InventoryKpi label="إجمالي المنتجات" icon="inventory_2" value={products.length} caption="منتجات كتالوجك" />
            <InventoryKpi label="منخفض المخزون" icon="warning" value={lowCount} caption="تحتاج إعادة تعبئة" />
            <InventoryKpi label="نفد المخزون" icon="cancel" value={outCount} caption="غير متاحة للشراء حالياً" />
          </div>

          <SectionHeader title="حالة المخزون" subtitle="راجع التنبيهات والمخزون حسب المتغيرات" />
          <Card className="mt-1">
            <div className="products-toolbar mb-2">
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
            {productsRes.loading || costsRes.loading ? (
              <Loading variant="table" />
            ) : inventoryFiltered.length === 0 ? (
              <EmptyState icon="inventory_2" title="لا توجد منتجات" description={stockQuery ? 'لا توجد نتائج للبحث' : 'أضف منتجاتك من تبويب المنتجات للبدء.'} />
            ) : (
              <Table cardMode
                columns={[
                  { key: 'name', header: 'المنتج', render: productCell },
                  { key: 'sku', header: 'SKU', render: (p: Product) => <span className="monospace muted">{p.sku || '—'}</span> },
                  { key: 'stock', header: 'المخزون', render: (p: Product) => <Badge tone={stockTone(p)}>{p.stock}</Badge> },
                   { key: 'variants', header: 'المخزون لكل مقاس', render: (p: Product) => <VariantStockCell product={p} /> },
                  { key: 'threshold', header: 'حد التنبيه', render: (p: Product) => <span className="muted">{p.lowStockThreshold ?? 5}</span> },
                  { key: 'actions', header: '', render: (p: Product) =>
                    (p.variants || []).length > 0
                      ? <Button variant="ghost" size="sm" icon="edit" onClick={() => openEdit(p)}>تعديل</Button>
                      : <Button variant="ghost" size="sm" icon="add" onClick={() => { setAdjusting(p); setDelta(0) }}>تعديل</Button>
                  },
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