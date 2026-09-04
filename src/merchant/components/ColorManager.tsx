import { FunctionalComponent } from 'preact'
import { useRef, useState } from 'preact/hooks'
import type { ColorOption } from '../../shared/types'
import { uid } from '../../shared/utils/validators'
import { Icon } from '../../shared/components/ui/Icon'
import { Button } from '../../shared/components/ui/Button'
import { SmartImage } from '../../shared/components/ui/SmartImage'
import { useToast } from '../../shared/hooks/useToast'
import { validateImageFile, uploadProductImage, uploadErrorMessage } from '../../shared/services/uploads'

interface Props {
  storeId: string
  productId: string
  colors: ColorOption[]
  images: string[]
  onChange: (colors: ColorOption[]) => void
  /** Called after a color-image upload succeeds so the parent can append the URL to the product images. */
  onImageUploaded?: (url: string, colorId: string) => void
}

const DEFAULT_HEX = '#6366f1'

// One-tap preset colors — merchants add these without touching any inputs.
const PRESET_COLORS = [
  { name: 'أسود', hex: '#111111' },
  { name: 'أبيض', hex: '#f5f5f5' },
  { name: 'أحمر', hex: '#dc2626' },
  { name: 'أزرق', hex: '#2563eb' },
  { name: 'أخضر', hex: '#16a34a' },
  { name: 'أصفر', hex: '#eab308' },
]

export const ColorManager: FunctionalComponent<Props> = ({ storeId, productId, colors, images, onChange, onImageUploaded }) => {
  const toast = useToast()
  const [customOpen, setCustomOpen] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customHex, setCustomHex] = useState(DEFAULT_HEX)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const imageInputsRef = useRef<Record<string, HTMLInputElement | null>>({})

  const addPreset = (name: string, hex: string) => {
    if (colors.some((c) => c.name === name)) {
      toast.push('هذا اللون مضاف مسبقاً', undefined, 'error')
      return
    }
    onChange([...colors, { id: uid(), name, hex }])
  }

  const addCustom = () => {
    const name = customName.trim()
    if (!name) {
      toast.push('أدخل اسم اللون المخصص', undefined, 'error')
      return
    }
    onChange([...colors, { id: uid(), name, hex: /^#[0-9a-fA-F]{6}$/.test(customHex) ? customHex : DEFAULT_HEX }])
    setCustomName('')
    setCustomHex(DEFAULT_HEX)
    setCustomOpen(false)
  }

  const update = (index: number, patch: Partial<ColorOption>) => {
    onChange(colors.map((c, i) => (i === index ? { ...c, ...patch } : c)))
  }

  const remove = (index: number) => onChange(colors.filter((_, i) => i !== index))

  const move = (from: number, dir: -1 | 1) => {
    const to = from + dir
    if (to < 0 || to >= colors.length) return
    const next = [...colors]
    ;[next[from], next[to]] = [next[to], next[from]]
    onChange(next)
  }

  const pickColorImage = (colorId: string) => imageInputsRef.current[colorId]?.click()

  const onColorImageChosen = async (e: Event, colorId: string) => {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    const err = validateImageFile(file)
    if (err) {
      toast.push(err.message, undefined, 'error')
      return
    }
    setUploadingId(colorId)
    try {
      const url = await uploadProductImage(file, storeId, productId)
      onImageUploaded?.(url, colorId)
    } catch (e) {
      console.error('color image upload failed', e)
      toast.push(uploadErrorMessage(e), undefined, 'error')
    } finally {
      setUploadingId(null)
    }
  }

  return (
    <div className="color-manager">
      <div className="color-presets">
        {PRESET_COLORS.map((p) => (
          <button
            key={p.name}
            type="button"
            className="color-preset-chip"
            onClick={() => addPreset(p.name, p.hex)}
            title={`إضافة ${p.name}`}
          >
            <span className="color-preset-swatch" style={{ background: p.hex }} />
            {p.name}
          </button>
        ))}
      </div>
      <p className="muted small mb-1">أضف الألوان المتاحة للمنتج — يمكنك أيضاً إضافة لون مخصص بصورته الخاصة.</p>

      {colors.map((c, i) => (
        <div key={c.id} className="color-row">
          <label className="color-swatch-input" title={c.hex}>
            <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(c.hex) ? c.hex : DEFAULT_HEX} onChange={(e) => update(i, { hex: (e.target as HTMLInputElement).value })} />
          </label>
          <input
            className="input color-name-input"
            placeholder="اسم اللون — مثال: أسود"
            value={c.name}
            onInput={(e) => update(i, { name: (e.target as HTMLInputElement).value })}
          />
          <button
            type="button"
            className="icon-btn"
            title="صورة لهذا اللون"
            onClick={() => pickColorImage(c.id)}
            disabled={uploadingId === c.id}
          >
            {uploadingId === c.id ? <span className="spinner spinner-sm" /> : <Icon name="add_photo_alternate" />}
          </button>
          <input
            ref={(el) => { imageInputsRef.current[c.id] = el }}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            hidden
            onChange={(e) => onColorImageChosen(e, c.id)}
          />
          {c.imageIndex != null && images[c.imageIndex] && (
            <SmartImage src={images[c.imageIndex]} alt="" className="color-row-thumb" placeholderClassName="color-row-thumb" />
          )}
          <button type="button" className="icon-btn" title="تحريك للأعلى" disabled={i === 0} onClick={() => move(i, -1)}>
            <Icon name="arrow_upward" />
          </button>
          <button type="button" className="icon-btn" title="تحريك للأسفل" disabled={i === colors.length - 1} onClick={() => move(i, 1)}>
            <Icon name="arrow_downward" />
          </button>
          <button type="button" className="icon-btn icon-btn-danger" title="حذف اللون" onClick={() => remove(i)}>
            <Icon name="delete" />
          </button>
        </div>
      ))}

      {customOpen ? (
        <div className="color-custom-form">
          <input
            className="input color-name-input"
            placeholder="اسم اللون المخصص"
            value={customName}
            onInput={(e) => setCustomName((e.target as HTMLInputElement).value)}
          />
          <label className="color-swatch-input" title={customHex}>
            <input type="color" value={customHex} onChange={(e) => setCustomHex((e.target as HTMLInputElement).value)} />
          </label>
          <div className="flex flex-gap-sm">
            <Button size="sm" icon="check" onClick={addCustom}>إضافة</Button>
            <Button size="sm" variant="ghost" onClick={() => setCustomOpen(false)}>إلغاء</Button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setCustomOpen(true)}>
          <Icon name="add" /> إضافة لون مخصص
        </button>
      )}
    </div>
  )
}