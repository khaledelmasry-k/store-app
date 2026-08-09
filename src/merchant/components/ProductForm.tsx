import { FunctionalComponent, Fragment } from 'preact'
import { useState } from 'preact/hooks'
import type { Category, ColorOption, Product, ProductVariant, QuantityTier } from '../../shared/types'
import { legacyVariantId } from '../../shared/types'
import { productsService } from '../../shared/services/products'
import { useToast } from '../../shared/hooks/useToast'
import { uid } from '../../shared/utils/validators'
import { Input } from '../../shared/components/ui/Input'
import { Textarea } from '../../shared/components/ui/Textarea'
import { Select } from '../../shared/components/ui/Select'
import { Toggle } from '../../shared/components/ui/Toggle'
import { Button } from '../../shared/components/ui/Button'
import { ImageGalleryUploader } from './ImageGalleryUploader'
import { ColorManager } from './ColorManager'
import { VariantMatrix } from './VariantMatrix'
import { QuantityTiersEditor } from './QuantityTiersEditor'
import { validateQuantityTiers } from '../../shared/utils/pricing'

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
  images: string[]
  colorOptions: ColorOption[]
  sizes: string[]
  variants: ProductVariant[]
  active: boolean
}

function draftFrom(initial?: Product | null): Draft {
  if (!initial) {
    return {
      name: '', sku: '', description: '', categoryId: '', price: '', oldPrice: '', stock: '0',
      lowStockThreshold: '5', pricingMode: 'standard', quantityTiers: [], images: [], colorOptions: [], sizes: [], variants: [], active: true,
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
    quantityTiers: (initial.quantityTiers || []).map((t) =>
      typeof t.quantity === 'number' ? { ...t } : { quantity: t.minQuantity || 1, price: t.price || 0 },
    ),
    images: [...(initial.images || [])],
    colorOptions,
    sizes: [...(initial.sizes || [])],
    variants: (initial.variants || []).map((v) => ({ ...v })),
    active: initial.active ?? true,
  }
}

export const ProductForm: FunctionalComponent<Props> = ({ storeId, initial, categories, onClose, onSaved }) => {
  const toast = useToast()
  const [draft, setDraft] = useState<Draft>(() => draftFrom(initial))
  const [savingAction, setSavingAction] = useState<'draft' | 'save' | 'publish' | null>(null)
  const [error, setError] = useState('')

  const set = (patch: Partial<Draft>) => setDraft((prev) => ({ ...prev, ...patch }))

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
      stock: variants.length > 0 ? variantTotal : Number(draft.stock || 0),
      lowStockThreshold: Number(draft.lowStockThreshold || 5),
      active: draft.active,
    }
  }

  const save = async (action: 'draft' | 'save' | 'publish', activeOverride?: boolean) => {
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
    setError('')
    setSavingAction(action)
    try {
      const data = { ...buildData(), active: activeOverride ?? draft.active }
      if (initial) {
        await productsService.update(initial.id, data)
        toast.push('تم تحديث المنتج')
      } else {
        await productsService.create(storeId, data)
        toast.push('تم إضافة المنتج')
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

  const section = (title: string) => <h4 className="product-form-section">{title}</h4>

  return (
    <div className="product-form">
      {error && <div className="form-error-banner">{error}</div>}

      {section('معلومات المنتج')}
      <div className="grid grid-2">
        <Input label="اسم المنتج" value={draft.name} onChange={(v) => set({ name: v })} required />
        <Input label="SKU" value={draft.sku} onChange={(v) => set({ sku: v })} />
      </div>
      <Textarea label="الوصف" value={draft.description} onChange={(v) => set({ description: v })} rows={3} />
      <Select
        label="الفئة"
        value={draft.categoryId}
        onChange={(v) => set({ categoryId: v })}
        options={[{ value: '', label: 'بدون فئة' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
      />

      {section('التسعير')}
      <div className="grid grid-2">
        <Input label="السعر" type="number" value={draft.price} onChange={(v) => set({ price: v })} required />
        <Input label="السعر قبل الخصم" type="number" value={draft.oldPrice} onChange={(v) => set({ oldPrice: v })} />
      </div>
      <div className="field mt-1">
        <Select
          label="طريقة التسعير"
          value={draft.pricingMode}
          onChange={(v) => set({ pricingMode: v === 'quantity' ? 'quantity' : 'standard' })}
          options={[
            { value: 'standard', label: 'سعر موحد (ثابت)' },
            { value: 'quantity', label: 'سعر حسب الكمية (أسعار متدرجة)' },
          ]}
          hint={draft.pricingMode === 'quantity' ? 'العميل يختار باقة محددة بعدد قطع معين بسعر إجمالي ثابت' : undefined}
        />
      </div>
      {draft.pricingMode === 'quantity' && (
        <QuantityTiersEditor tiers={draft.quantityTiers} onChange={(quantityTiers) => set({ quantityTiers })} />
      )}

      {section('المخزون')}
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

      {section('صور المنتج')}
      <ImageGalleryUploader storeId={storeId} images={draft.images} onChange={(images) => set({ images })} />

      {section('الألوان')}
      <ColorManager
        storeId={storeId}
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

      {section('المقاسات والمتغيرات')}
      <VariantMatrix
        colors={draft.colorOptions}
        sizes={draft.sizes}
        variants={draft.variants}
        onSizesChange={(sizes) => set({ sizes })}
        onVariantsChange={(variants) => set({ variants })}
      />

      {section('النشر')}
      <div className="field">
        <Toggle checked={draft.active} onChange={(v) => set({ active: v })} label="منشور في المتجر" />
      </div>

      <div className="product-form-actions">
        <Fragment>
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button variant="outline" icon="save" onClick={() => save('draft', false)} loading={savingAction === 'draft'}>حفظ كمسودة</Button>
          <Button icon="save" onClick={() => save('save')} loading={savingAction === 'save'}>حفظ المنتج</Button>
          <Button variant="soft" icon="rocket_launch" onClick={() => save('publish', true)} loading={savingAction === 'publish'}>حفظ ونشر</Button>
        </Fragment>
      </div>
    </div>
  )
}
