import { FunctionalComponent } from 'preact'
import { useRef, useState } from 'preact/hooks'
import { useToast } from '../../shared/hooks/useToast'
import { validateImageFile, uploadProductImage, deleteProductImage } from '../../shared/services/uploads'
import { uid } from '../../shared/utils/validators'
import { Icon } from '../../shared/components/ui/Icon'
import { SmartImage } from '../../shared/components/ui/SmartImage'

interface Uploading {
  id: string
  name: string
  progress: number
  error?: string
}

interface Props {
  storeId: string
  images: string[]
  onChange: (images: string[]) => void
  max?: number
}

export const ImageGalleryUploader: FunctionalComponent<Props> = ({ storeId, images, onChange, max = 8 }) => {
  const toast = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const imagesRef = useRef(images)
  const pickTargetRef = useRef<number | undefined>(undefined)
  imagesRef.current = images
  const [uploading, setUploading] = useState<Uploading[]>([])

  const pickFiles = (targetIndex?: number) => {
    pickTargetRef.current = targetIndex
    inputRef.current?.click()
  }

  const onFilesChosen = (e: Event) => {
    const input = e.target as HTMLInputElement
    const files = Array.from(input.files || [])
    const targetIndex = pickTargetRef.current
    pickTargetRef.current = undefined
    if (targetIndex === undefined && files.length + images.length > max) {
      toast.push(`الحد الأقصى للصور هو ${max}`, undefined, 'error')
    }
    void handleFiles(files, targetIndex)
    input.value = ''
  }

  const handleFiles = async (files: File[], targetIndex?: number) => {
    let index = targetIndex ?? images.length
    const jobs = files
      .filter(() => images.length < max)
      .map((file) => {
        const err = validateImageFile(file)
        if (err) {
          toast.push(err.message, undefined, 'error')
          return null
        }
        return file
      })
      .filter((f): f is File => f !== null)

    for (const file of jobs) {
      const id = uid(6)
      setUploading((prev) => [...prev, { id, name: file.name, progress: 0 }])
      try {
        const url = await uploadProductImage(file, storeId, (progress) => {
          setUploading((prev) => prev.map((u) => (u.id === id ? { ...u, progress } : u)))
        })
        const current = imagesRef.current
        const next = [...current]
        if (targetIndex !== undefined && targetIndex < next.length) {
          // Replace mode: swap the old image at this index for the new one.
          const replaced = next[targetIndex]
          next.splice(targetIndex, 1, url)
          void deleteProductImage(replaced).catch(() => toast.push('تعذر حذف الصورة القديمة من التخزين', undefined, 'error'))
        } else {
          next.splice(index, 0, url)
        }
        imagesRef.current = next
        onChange(next)
        index += 1
      } catch (e) {
        console.error('upload failed', e)
        setUploading((prev) => prev.map((u) => (u.id === id ? { ...u, error: 'فشل رفع الصورة — تحقق من اتصالك وحاول مجدداً' } : u)))
        toast.push('فشل رفع الصورة', 'تحقق من اتصالك وحاول مجدداً', 'error')
      } finally {
        setUploading((prev) => prev.filter((u) => u.id !== id))
      }
    }
  }

  const move = (from: number, dir: -1 | 1) => {
    const to = from + dir
    if (to < 0 || to >= images.length) return
    const next = [...images]
    ;[next[from], next[to]] = [next[to], next[from]]
    onChange(next)
  }

  const removeAt = (index: number) => {
    const removed = images[index]
    onChange(images.filter((_, i) => i !== index))
    if (removed) void deleteProductImage(removed).catch(() => toast.push('تعذر حذف الصورة من التخزين', undefined, 'error'))
  }

  return (
    <div className="image-gallery-field">
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden onChange={onFilesChosen} />

      {images.length === 0 && uploading.length === 0 && (
        <button type="button" className="image-upload-empty" onClick={() => pickFiles()}>
          <Icon name="add_photo_alternate" />
          <strong>إضافة صور</strong>
          <span className="muted small">JPG، PNG، WebP أو GIF — حتى 5 ميجابايت</span>
        </button>
      )}

      {(images.length > 0 || uploading.length > 0) && (
        <div className="image-gallery-grid">
          {images.map((src, i) => (
            <div key={`${src}-${i}`} className="image-tile">
              <SmartImage src={src} alt="" className="image-tile-img" placeholderClassName="image-tile-img image-tile-img--fallback" />
              {i === 0 && <span className="image-tile-primary">رئيسية</span>}
              <div className="image-tile-actions">
                <button type="button" className="icon-btn" title="تحريك للأعلى" disabled={i === 0} onClick={() => move(i, -1)}>
                  <Icon name="arrow_upward" />
                </button>
                <button type="button" className="icon-btn" title="تحريك للأسفل" disabled={i === images.length - 1} onClick={() => move(i, 1)}>
                  <Icon name="arrow_downward" />
                </button>
                <button type="button" className="icon-btn" title="استبدال" onClick={() => pickFiles(i)}>
                  <Icon name="edit" />
                </button>
                <button type="button" className="icon-btn icon-btn-danger" title="حذف" onClick={() => removeAt(i)}>
                  <Icon name="delete" />
                </button>
              </div>
            </div>
          ))}

          {uploading.map((u) => (
            <div key={u.id} className="image-tile image-tile-uploading">
              <div className="upload-progress">
                <span className="spinner" />
                <strong className="small">{u.progress}%</strong>
              </div>
              <span className="muted small image-tile-name">{u.name}</span>
              {u.error && <span className="field-error small">{u.error}</span>}
            </div>
          ))}

          {images.length < max && (
            <button type="button" className="image-tile-add" onClick={() => pickFiles()}>
              <Icon name="add" />
              <span className="small">إضافة</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
