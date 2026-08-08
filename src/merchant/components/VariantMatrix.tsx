import { FunctionalComponent } from 'preact'
import { useState } from 'preact/hooks'
import type { ColorOption, ProductVariant } from '../../shared/types'
import { uid } from '../../shared/utils/validators'
import { Icon } from '../../shared/components/ui/Icon'

interface Props {
  colors: ColorOption[]
  sizes: string[]
  variants: ProductVariant[]
  onSizesChange: (sizes: string[]) => void
  onVariantsChange: (variants: ProductVariant[]) => void
}

export const VariantMatrix: FunctionalComponent<Props> = ({ colors, sizes, variants, onSizesChange, onVariantsChange }) => {
  const [sizeInput, setSizeInput] = useState('')

  const SIZE_PRESETS = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
  const NUM_PRESETS = ['36', '37', '38', '39', '40', '41', '42']

  const addSize = (s: string) => {
    const clean = s.trim()
    if (!clean || sizes.includes(clean)) return
    onSizesChange([...sizes, clean])
  }

  const addSizeFromInput = () => {
    const s = sizeInput.trim()
    if (!s || sizes.includes(s)) {
      setSizeInput('')
      return
    }
    onSizesChange([...sizes, s])
    setSizeInput('')
  }

  const removeSize = (size: string) => {
    onSizesChange(sizes.filter((s) => s !== size))
    onVariantsChange(variants.filter((v) => v.size !== size))
  }

  const moveSize = (index: number, dir: -1 | 1) => {
    const to = index + dir
    if (to < 0 || to >= sizes.length) return
    const next = [...sizes]
    ;[next[index], next[to]] = [next[to], next[index]]
    onSizesChange(next)
  }

  const generate = () => {
    const combos: { color: string; colorId: string | undefined; size: string }[] = []
    if (colors.length > 0 && sizes.length > 0) {
      for (const c of colors) for (const s of sizes) combos.push({ color: c.name, colorId: c.id, size: s })
    } else if (colors.length > 0) {
      for (const c of colors) combos.push({ color: c.name, colorId: c.id, size: '' })
    } else if (sizes.length > 0) {
      for (const s of sizes) combos.push({ color: '', colorId: undefined, size: s })
    }
    const next = combos.map((combo) => {
      const existing = variants.find((v) => (v.color || '') === combo.color && (v.size || '') === combo.size)
      return existing ? { ...existing } : { id: uid(), color: combo.color, colorId: combo.colorId, size: combo.size, stock: 0 }
    })
    onVariantsChange(next)
  }

  const updateVariant = (index: number, patch: Partial<ProductVariant>) => {
    onVariantsChange(variants.map((v, i) => (i === index ? { ...v, ...patch } : v)))
  }

  const hasVariants = colors.length > 0 || sizes.length > 0
  const rows = colors.length > 0 ? colors : sizes.map((s) => ({ id: s, name: s, hex: '' }))
  const cols = colors.length > 0 ? sizes : ['']

  return (
    <div className="variant-matrix">
      <div className="size-preset-groups">
        <div className="size-preset-group">
          <span className="muted small">ملابس</span>
          <div className="flex flex-wrap" style={{ gap: 6 }}>
            {SIZE_PRESETS.map((s) => (
              <button
                key={s}
                type="button"
                className={`size-preset-chip${sizes.includes(s) ? ' size-preset-chip--active' : ''}`}
                onClick={() => (sizes.includes(s) ? removeSize(s) : addSize(s))}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="size-preset-group">
          <span className="muted small">أحذية</span>
          <div className="flex flex-wrap" style={{ gap: 6 }}>
            {NUM_PRESETS.map((s) => (
              <button
                key={s}
                type="button"
                className={`size-preset-chip${sizes.includes(s) ? ' size-preset-chip--active' : ''}`}
                onClick={() => (sizes.includes(s) ? removeSize(s) : addSize(s))}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="size-chips">
        {sizes.map((s, i) => (
          <span key={s} className="size-chip">
            <button type="button" className="size-chip-move" onClick={() => moveSize(i, -1)} disabled={i === 0} title="تحريك لأعلى">
              <Icon name="chevron_right" />
            </button>
            <button type="button" className="size-chip-move" onClick={() => moveSize(i, 1)} disabled={i === sizes.length - 1} title="تحريك لأسفل">
              <Icon name="chevron_left" />
            </button>
            {s}
            <button type="button" className="size-chip-remove" onClick={() => removeSize(s)}>
              <Icon name="close" />
            </button>
          </span>
        ))}
        <input
          className="input size-input"
          placeholder="مقاس مخصص..."
          value={sizeInput}
          onInput={(e) => setSizeInput((e.target as HTMLInputElement).value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addSizeFromInput()
            }
          }}
        />
        <button type="button" className="btn btn-outline btn-sm" onClick={addSizeFromInput}>
          <Icon name="add" /> مقاس
        </button>
      </div>

      {hasVariants && (
        <button type="button" className="btn btn-soft btn-sm mt-1" onClick={generate}>
          <Icon name="sync" /> إنشاء المتغيرات
        </button>
      )}

      {variants.length > 0 && colors.length > 0 && (
        <div className="variant-table mt-2">
          <div className="variant-grid" style={{ gridTemplateColumns: `120px repeat(${cols.length || 1}, minmax(140px, 1fr))` }}>
            <div className="variant-cell variant-cell-head">اللون</div>
            {cols.map((s, i) => (
              <div key={i} className="variant-cell variant-cell-head">
                {s || '—'}
              </div>
            ))}
            {rows.map((row) => (
              <VariantRow
                key={row.id}
                row={row}
                cols={cols}
                variants={variants}
                updateVariant={updateVariant}
              />
            ))}
          </div>
        </div>
      )}

      {variants.length === 0 && hasVariants && (
        <p className="muted small mt-1">اضغط "إنشاء المتغيرات" لتوليد مجموعات الألوان والمقاسات، ثم حدد المخزون لكل متغير.</p>
      )}
    </div>
  )
}

function VariantRow({
  row,
  cols,
  variants,
  updateVariant,
}: {
  row: { id: string; name: string }
  cols: string[]
  variants: ProductVariant[]
  updateVariant: (index: number, patch: Partial<ProductVariant>) => void
}) {
  const cellFor = (size: string, colIndex: number) => {
    const baseIndex = variants.findIndex((v) => (v.color || '') === row.name && (v.size || '') === size)
    const v = baseIndex >= 0 ? variants[baseIndex] : null
    return (
      <div key={colIndex} className="variant-cell">
        {v ? (
          <div className="variant-cell-fields">
            <input
              className="input variant-stock"
              type="number"
              min={0}
              title="المخزون"
              value={v.stock ?? 0}
              onInput={(e) => updateVariant(baseIndex, { stock: Math.max(0, Number((e.target as HTMLInputElement).value) || 0) })}
            />
            <input
              className="input variant-sku"
              placeholder="SKU"
              title="SKU"
              value={v.sku || ''}
              onInput={(e) => updateVariant(baseIndex, { sku: (e.target as HTMLInputElement).value })}
            />
            <input
              className="input variant-price"
              type="number"
              placeholder="سعر"
              title="السعر (اختياري)"
              value={v.price ?? ''}
              onInput={(e) => {
                const val = (e.target as HTMLInputElement).value
                updateVariant(baseIndex, { price: val === '' ? undefined : Number(val) })
              }}
            />
          </div>
        ) : (
          <span className="muted small">—</span>
        )}
      </div>
    )
  }

  return (
    <>
      <div className="variant-cell variant-cell-label">
        {row.name}
        <span className="variant-cell-hex" style={{ background: (row as ColorOption).hex || '#999' }} />
      </div>
      {cols.map((s, i) => cellFor(s, i))}
    </>
  )
}
