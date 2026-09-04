import { FunctionalComponent, Fragment } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { Link } from 'wouter'
import type { Category, ColorOption, Product, ProductCost, ProductVariant, QuantityPricingStrategy, QuantityTier } from '../../shared/types'
import { legacyVariantId } from '../../shared/types'
import { productCostsService } from '../../shared/services/products'
import { createProductCallable, updateProductCallable } from '../../shared/services/auth'
import { useToast } from '../../shared/hooks/useToast'
import { useSubscription } from '../../shared/hooks/useSubscription'
import { useDocument } from '../../shared/hooks/useDocument'
import { canUseFeature } from '../../shared/services/subscription'
import { uid } from '../../shared/utils/validators'
import { formatCurrency } from '../../shared/utils/format'
import { Input } from '../../shared/components/ui/Input'
import { Textarea } from '../../shared/components/ui/Textarea'
import { Select } from '../../shared/components/ui/Select'
import { Toggle } from '../../shared/components/ui/Toggle'
import { Button } from '../../shared/components/ui/Button'
import { SectionHeader } from '../../shared/components/ui/SectionHeader'
import { ImageGalleryUploader } from './ImageGalleryUploader'
import { ColorManager } from './ColorManager'
import { VariantMatrix } from './VariantMatrix'
import { QuantityTiersEditor } from './QuantityTiersEditor'
import { validateQuantityTiers, lineProfit, profitMargin, piecesLabel } from '../../shared/utils/pricing'
import { Icon } from '../../shared/components/ui/Icon'
import './ProductForm.css'

interface Props {
  storeId: string
  initial?: Product | null
  categories: Category[]
  onClose: () => void
  onSaved: () => void
}

interface Draft {
  name: string
  sku: string
  description: string
  categoryId: string
  price: string
  oldPrice: string
  stock: string
  lowStockThreshold: string
  pricingMode: 'standard' | 'quantity'
  quantityTiers: QuantityTier[]
  quantityPricingStrategy: QuantityPricingStrategy
  images: string[]
  colorOptions: ColorOption[]
  sizes: string[]
  variants: ProductVariant[]
  active: boolean
  isFeatured: boolean
}

function draftFrom(initial?: Product | null): Draft {
  if (!initial) {
    return {
      name: '', sku: '', description: '', categoryId: '', price: '', oldPrice: '', stock: '0',
      lowStockThreshold: '5', pricingMode: 'standard', quantityTiers: [], quantityPricingStrategy: 'cap', images: [], colorOptions: [], sizes: [], variants: [], active: true, isFeatured: false,
    }
  }
  const colorOptions: ColorOption[] =
    initial.colorOptions && initial.colorOptions.length > 0
      ? initial.colorOptions.map((c) => ({ ...c }))
      : (initial.colors || []).map((name) => ({ id: uid(), name, hex: '#6366f1' }))
  return {
    name: initial.name || '',
    sku: initial.sku || '',
    description: initial.description || '',
    categoryId: initial.categoryId || '',
    price: String(initial.price ?? ''),
    oldPrice: initial.oldPrice ? String(initial.oldPrice) : '',
    stock: String(initial.stock ?? 0),
    lowStockThreshold: String(initial.lowStockThreshold ?? 5),
    pricingMode: initial.pricingMode === 'quantity' ? 'quantity' : 'standard',
    quantityPricingStrategy: initial.quantityPricingStrategy || 'cap',
    quantityTiers: (initial.quantityTiers || []).map((t) =>
      typeof t.quantity === 'number' ? { ...t } : { quantity: t.minQuantity || 1, price: t.price || 0 },
    ),
    images: [...(initial.images || [])],
    colorOptions,
    sizes: [...(initial.sizes || [])],
    variants: (initial.variants || []).map((v) => ({ ...v })),
    active: initial.active ?? true,
    isFeatured: initial.isFeatured ?? initial.featured ?? false,
  }
}

/**
 * Stitch editor section card: white surface, 12px radius, icon header with a
 * divider rail (matching the dashboard/orders panel language).
 */
const Section: FunctionalComponent<{ title: string; id: string; icon: string; children?: any }> = ({ title, id, children }) => (
  <section className="product-form-section" id={id}>
    <SectionHeader title={title} />
    <div className="product-form-section-body">{children}</div>
  </section>
)

export const ProductForm: FunctionalComponent<Props> = ({ storeId, initial, categories, onClose, onSaved }) => {
  const toast = useToast()
  const { plan } = useSubscription(storeId)
  const isNew = !initial
  const qtyAllowed = canUseFeature('quantityPricing', plan)
  const variantAllowed = canUseFeature('variantInventory', plan)
  // Defer the client-side feature lock until the store's plan has actually
  // resolved. While `plan` is still null (async load), the server remains the
  // authoritative gate (createProduct rejects variant/quantity products on
  // ineligible plans), so the client must not false-deny and show a stale
  // "upgrade required" error before the plan is even known.
  const qtyLocked = isNew && plan !== null && !qtyAllowed
  const variantLocked = isNew && plan !== null && !variantAllowed
  const [draft, setDraft] = useState<Draft>(() => draftFrom(initial))
  const [savingAction, setSavingAction] = useState<'draft' | 'save' | 'publish' | null>(null)
  const [error, setError] = useState('')
  // A blocked attempt at a plan-locked mode freezes saves for this drawer
  // session: even after the merchant reverts the field, the product must not
  // be written while the lock banner is still up.
  const [lockAttempt, setLockAttempt] = useState(false)

  // Private cost price — loaded from the separate `productCosts` collection so
  // it never travels through the public `products` document.
  const [costPrice, setCostPrice] = useState('')
  const [estimatedAdCost, setEstimatedAdCost] = useState('0')
  const { data: costDoc } = useDocument<ProductCost>('productCosts', initial?.id || null)
  useEffect(() => {
    if (costDoc && typeof costDoc.costPrice === 'number') setCostPrice(String(costDoc.costPrice))
    if (costDoc && typeof costDoc.estimatedAdCostPerSale === 'number') setEstimatedAdCost(String(costDoc.estimatedAdCostPerSale))
  }, [costDoc])

  const set = (patch: Partial<Draft>) => setDraft((prev) => ({ ...prev, ...patch }))

  // For a NEW product the id is generated once, before any image upload, so every
  // image lands in `stores/{storeId}/products/{productId}/...` and the product is
  // later CREATED with that same id. For edits the id already exists.
  const productIdRef = useRef<string | null>(initial?.id ?? null)
  const getProductId = (): string => {
    if (!productIdRef.current) productIdRef.current = uid(20)
    return productIdRef.current
  }

  const buildData = (): Omit<Product, 'id' | 'storeId'> => {
    const colorOptions = draft.colorOptions.map((c) => ({ ...c }))
    const colors = colorOptions.map((c) => c.name.trim()).filter(Boolean)
    const sizes = draft.sizes.map((s) => s.trim()).filter(Boolean)
    const variants = draft.variants
      .filter((v) => (v.color || '') === '' || colors.includes(v.color || ''))
      .filter((v) => (v.size || '') === '' || sizes.includes(v.size || ''))
      .map((v) => ({
        ...v,
        id: v.id || legacyVariantId(v.color, v.size),
        colorId: v.colorId || colorOptions.find((c) => c.name === v.color)?.id,
      }))
    const variantTotal = variants.reduce((s, v) => s + (v.stock || 0), 0)
    const pricingMode = draft.pricingMode === 'quantity' ? 'quantity' : 'standard'
    return {
      name: draft.name.trim(),
      sku: draft.sku.trim() || null,
      description: draft.description.trim(),
      categoryId: draft.categoryId || null,
      price: Number(draft.price),
      oldPrice: draft.oldPrice ? Number(draft.oldPrice) : null,
      images: draft.images,
      colorOptions,
      colors,
      sizes,
      variants,
      pricingMode,
      quantityTiers: pricingMode === 'quantity' ? draft.quantityTiers.map((t) => ({ ...t })) : [],
      quantityPricingStrategy: pricingMode === 'quantity' ? draft.quantityPricingStrategy : undefined,
      stock: variants.length > 0 ? variantTotal : Number(draft.stock || 0),
      lowStockThreshold: Number(draft.lowStockThreshold || 5),
      active: draft.active,
      isFeatured: draft.isFeatured,
    }
  }

  const save = async (action: 'draft' | 'save' | 'publish', activeOverride?: boolean) => {
    if (lockAttempt) {
      setError('ميزة التسعير حسب الكمية تتطلب ترقية الباقة')
      return
    }
    if (!draft.name.trim()) {
      setError('اسم المنتج مطلوب')
      return
    }
    if (!Number(draft.price) || Number(draft.price) < 0) {
      setError('أدخل سعراً صحيحاً')
      return
    }
    if (draft.pricingMode === 'quantity') {
      const tierErr = validateQuantityTiers(draft.quantityTiers)
      if (tierErr) {
        setError(tierErr)
        return
      }
    }
    if (costPrice !== '') {
      const costNum = Number(costPrice)
      if (!Number.isFinite(costNum) || costNum < 0) {
        setError('أدخل سعر تكلفة صحيحاً (قيمة 0 أو أكثر)')
        return
      }
    }
    const adCostNum = estimatedAdCost === '' ? 0 : Number(estimatedAdCost)
    if (!Number.isFinite(adCostNum) || adCostNum < 0) {
      setError('أدخل تكلفة إعلان صحيحة (قيمة 0 أو أكثر)')
      return
    }
    setError('')
    setSavingAction(action)
    try {
      const data = { ...buildData(), active: activeOverride ?? draft.active }
      if (initial) {
        await updateProductCallable({ storeId, productId: initial.id, data })
        toast.push('تم تحديث المنتج')
      } else {
        const productId = getProductId()
        await createProductCallable({ storeId, productId, data })
        toast.push('تم إضافة المنتج')
      }
      // Persist the private cost price separately from the public product doc.
      const productId = getProductId()
      const costNum = costPrice === '' ? null : Number(costPrice)
      if ((costNum != null && Number.isFinite(costNum)) || adCostNum > 0) {
        await productCostsService.set(productId, storeId, { costPrice: costNum ?? 0, estimatedAdCostPerSale: adCostNum, estimatedAdCostMode: 'per_order' })
      } else if (initial) {
        try {
          await productCostsService.remove(initial.id)
        } catch {
          // No cost doc existed yet — nothing to remove.
        }
      }
      onSaved()
    } catch (e) {
      console.error('save product failed', e)
      setError('تعذر حفظ المنتج — تحقق من اتصالك وحاول مجدداً')
      toast.push('تعذر حفظ المنتج', undefined, 'error')
    } finally {
      setSavingAction(null)
    }
  }

  const lockedFeatures: string[] = []
  if (qtyLocked) lockedFeatures.push('التسعير حسب الكمية')
  if (variantLocked) lockedFeatures.push('المخزون حسب المقاس/اللون')

  return (
    <div className="product-form merchant-product-form-canonical">
      <div className="product-editor-header">
        <div className="product-editor-breadcrumb">
          <button type="button" className="product-editor-crumb" onClick={onClose}>المنتجات</button>
          <Icon name="chevron_left" ariaHidden />
          <span>{initial ? 'تعديل المنتج' : 'إضافة منتج جديد'}</span>
        </div>
        <div className="product-editor-publish-toggle">
          <Toggle checked={draft.active} onChange={(v) => set({ active: v })} label="نشط / منشور" />
          <Toggle checked={draft.isFeatured} onChange={(v) => set({ isFeatured: v })} label="منتج مميز" />
          <span className="field-hint">سيظهر المنتج في قسم المنتجات المميزة داخل واجهة المتجر.</span>
        </div>
      </div>
      {error && <div className="form-error-banner">{error}</div>}

      {lockedFeatures.length > 0 && (
        <div className="feature-lock-banner">
          <span className="feature-lock-icon"><Icon name="lock" /></span>
          <div>
            <strong>هذه المزايا غير متوفرة في باقتك الحالية</strong>
            <p className="muted small m-0">
              {lockedFeatures.join(' و ')} متوفرة في باقات أعلى. رقِّ باقتك لفتحها.
            </p>
            <Link to="/dashboard/subscription" className="feature-lock-cta">ترقية الباقة</Link>
          </div>
        </div>
      )}

      <Section title="المعلومات الأساسية" id="product-basic" icon="info">
        <Input label="اسم المنتج" value={draft.name} onChange={(v) => set({ name: v })} required />
        <div className="grid grid-2">
          <Input label="SKU" value={draft.sku} onChange={(v) => set({ sku: v })} />
          <Select
            label="الفئة"
            value={draft.categoryId}
            onChange={(v) => set({ categoryId: v })}
            options={[{ value: '', label: 'بدون فئة' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
          />
        </div>
        <Textarea label="الوصف" value={draft.description} onChange={(v) => set({ description: v })} rows={3} />
      </Section>

      <Section title="التسعير والتكلفة" id="product-pricing" icon="payments">
        <div className="grid grid-2">
          <Input label="السعر" type="number" value={draft.price} onChange={(v) => set({ price: v })} required />
          <Input label="السعر قبل الخصم" type="number" value={draft.oldPrice} onChange={(v) => set({ oldPrice: v })} />
        </div>
        <Input
          label="سعر التكلفة"
          type="number"
          min={0}
          value={costPrice}
          onChange={setCostPrice}
          hint="سعر التكلفة خاص بك ولن يظهر للعملاء."
        />
        <Input
          label="تكلفة الإعلان لكل عملية بيع"
          type="number"
          min={0}
          step="0.01"
          value={estimatedAdCost}
          onChange={setEstimatedAdCost}
          hint="قيمة تقديرية لما تنفقه على الإعلان للحصول على عملية بيع لهذا المنتج."
        />
        <ProfitSummary draft={draft} costPrice={costPrice} estimatedAdCost={estimatedAdCost} />
        <Select
          label="طريقة التسعير"
          value={draft.pricingMode}
          onChange={(v) => {
            const mode = v === 'quantity' ? 'quantity' : 'standard'
            if (mode === 'quantity' && qtyLocked) {
              setError('ميزة التسعير حسب الكمية تتطلب ترقية الباقة')
              setLockAttempt(true)
              return
            }
            set({ pricingMode: mode })
          }}
          options={[
            { value: 'standard', label: 'سعر موحد (ثابت)' },
            { value: 'quantity', label: 'سعر حسب الكمية (أسعار متدرجة)' },
          ]}
          hint={draft.pricingMode === 'quantity' ? 'العميل يختار باقة محددة بعدد قطع معين بسعر إجمالي ثابت' : qtyLocked ? 'التسعير حسب الكمية يتطلب ترقية الباقة' : undefined}
        />
        {draft.pricingMode === 'quantity' && (
          <Fragment>
            <QuantityTiersEditor tiers={draft.quantityTiers} onChange={(quantityTiers) => set({ quantityTiers })} />
            <Select
              label="سياسة السعر عند تجاوز أعلى باقة"
              value={draft.quantityPricingStrategy}
              onChange={(v) => set({ quantityPricingStrategy: (v === 'repeat' || v === 'last' ? v : 'cap') as QuantityPricingStrategy })}
              options={[
                { value: 'cap', label: 'أعلى باقة + المتبقي بالسعر الأساسي (الأكثر أماناً)' },
                { value: 'repeat', label: 'تكرار أعلى باقة للمتبقي' },
                { value: 'last', label: 'دائماً سعر أعلى باقة (تجاهل الزيادة)' },
              ]}
              hint="ماذا يحدث لو طلب العميل عدداً أكبر من أكبر باقة معروضة؟"
            />
          </Fragment>
        )}
      </Section>

      <Section title="المخزون" id="product-stock" icon="inventory">
        <div className="grid grid-2">
          <Input
            label={draft.variants.length > 0 ? 'المخزون (يُحسب تلقائياً من المتغيرات)' : 'المخزون'}
            type="number"
            value={draft.variants.length > 0 ? String(draft.variants.reduce((s, v) => s + (v.stock || 0), 0)) : draft.stock}
            onChange={(v) => set({ stock: v })}
            disabled={draft.variants.length > 0}
          />
          <Input label="حد التنبيه المنخفض" type="number" value={draft.lowStockThreshold} onChange={(v) => set({ lowStockThreshold: v })} />
        </div>
      </Section>

      <Section title="الألوان" id="product-colors" icon="palette">
        <ColorManager
          storeId={storeId}
          productId={getProductId()}
          colors={draft.colorOptions}
          images={draft.images}
          onChange={(colorOptions) => set({ colorOptions })}
          onImageUploaded={(url, colorId) =>
            setDraft((prev) => {
              const index = prev.images.length
              return {
                ...prev,
                images: [...prev.images, url],
                colorOptions: prev.colorOptions.map((c) => (c.id === colorId ? { ...c, imageIndex: index } : c)),
              }
            })
          }
        />
      </Section>

      <Section title="المقاسات والمتغيرات" id="product-variants" icon="tune">
        {variantLocked && draft.variants.length > 0 && (
          <div className="form-error-banner mb-1">
            المخزون حسب المقاس/اللون غير متوفر في باقتك الحالية — رقِّ باقتك لحفظ المتغيرات.
          </div>
        )}
        <VariantMatrix
          colors={draft.colorOptions}
          sizes={draft.sizes}
          variants={draft.variants}
          onSizesChange={(sizes) => set({ sizes })}
          onVariantsChange={(variants) => set({ variants })}
        />
      </Section>

      <Section title="الوسائط" id="product-media" icon="photo_library">
        <ImageGalleryUploader storeId={storeId} productId={getProductId()} images={draft.images} onChange={(images) => set({ images })} />
      </Section>

      <div className="product-form-actions">
        <Button variant="ghost" onClick={onClose}>إلغاء</Button>
        <Button variant="outline" icon="save" onClick={() => save('draft', false)} loading={savingAction === 'draft'}>حفظ كمسودة</Button>
        <Button variant="soft" icon="save" onClick={() => save('save')} loading={savingAction === 'save'}>حفظ المنتج</Button>
        <Button icon="rocket_launch" onClick={() => save('publish', true)} loading={savingAction === 'publish'}>حفظ ونشر</Button>
      </div>
    </div>
  )
}

/**
 * Live profit preview: selling − cost per unit, margin %, and — when quantity
 * pricing is used — the profit of every bundle tier based on its ACTUAL total
 * price (never `qty × base price`).
 */
function ProfitSummary({ draft, costPrice, estimatedAdCost }: { draft: Draft; costPrice: string; estimatedAdCost: string }) {
  const unitPrice = Number(draft.price) || 0
  const costValid = costPrice !== '' && Number.isFinite(Number(costPrice)) && Number(costPrice) >= 0
  const cost = costValid ? Number(costPrice) : null
  const adCost = Number.isFinite(Number(estimatedAdCost)) && Number(estimatedAdCost) >= 0 ? Number(estimatedAdCost) : 0

  if (!costValid) {
    return (
      <div className="cost-profit-summary is-empty">
        <Icon name="trending_up" ariaHidden />
        <div>
          <strong>الربح المتوقع</strong>
          <p className="muted small m-0">أدخل سعر التكلفة لعرض الربح وهامش الربح.</p>
        </div>
      </div>
    )
  }

  const unitProfit = unitPrice - (cost as number)
  const contributionProfit = unitProfit - adCost
  const margin = profitMargin(unitProfit, unitPrice)
  const profitTone = unitProfit < 0 ? 'negative' : 'positive'

  const tierRows: { qty: number; price: number; profit: number; contribution: number }[] = draft.pricingMode === 'quantity'
    ? draft.quantityTiers
        .filter((t) => Number.isFinite(t.price))
        .map((t) => ({
          qty: t.quantity,
          price: t.price,
          profit: lineProfit(unitPrice, t.quantity, cost as number, 'quantity', draft.quantityTiers, draft.quantityPricingStrategy),
          contribution: lineProfit(unitPrice, t.quantity, cost as number, 'quantity', draft.quantityTiers, draft.quantityPricingStrategy) - adCost,
        }))
    : []

  return (
    <div className={`cost-profit-summary ${profitTone}`}>
      <div className="cost-profit-summary-head">
        <span className="cost-profit-summary-title">
          <Icon name="trending_up" ariaHidden />
          الربح المتوقع
        </span>
        <span className="cost-profit-summary-margin">
          {margin != null ? `هامش الربح: ${margin.toFixed(1).replace(/\.0$/, '')}%` : 'هامش الربح: —'}
        </span>
      </div>
      <div className="cost-profit-summary-row">
        <span>سعر البيع</span>
        <strong>{formatCurrency(unitPrice)}</strong>
      </div>
      <div className="cost-profit-summary-row">
        <span>التكلفة</span>
        <strong>{formatCurrency(cost as number)}</strong>
      </div>
      <div className="cost-profit-summary-row is-profit">
        <span>الربح قبل الإعلان</span>
        <strong>{formatCurrency(unitProfit)}</strong>
      </div>
      <div className="cost-profit-summary-row is-profit">
        <span>الربح التقديري بعد الإعلان</span>
        <strong>{formatCurrency(contributionProfit)}</strong>
      </div>
      {tierRows.length > 0 && (
        <div className="cost-profit-tiers">
          <div className="cost-profit-tiers-title">الربح حسب باقات الكمية</div>
          {tierRows.map((t) => (
            <div key={t.qty} className="cost-profit-summary-row">
              <span>{t.qty} {piecesLabel(t.qty)}</span>
              <strong>{formatCurrency(t.profit)} قبل / {formatCurrency(t.contribution)} بعد الإعلان</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
