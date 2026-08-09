import { FunctionalComponent } from 'preact'
import { useRef, useState } from 'preact/hooks'
import { useToast } from '../../shared/hooks/useToast'
import { validateImageFile, uploadLandingImage, deleteProductImage } from '../../shared/services/uploads'
import { SmartImage } from '../../shared/components/ui/SmartImage'
import { Icon } from '../../shared/components/ui/Icon'

interface Props {
  storeId: string
  value: string
  onChange: (url: string) => void
  label?: string
}

export const LandingImageUploader: FunctionalComponent<Props> = ({ storeId, value, onChange, label }) => {
  const toast = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)

  const pick = () => inputRef.current?.click()

  const onChosen = async (e: Event) => {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    const err = validateImageFile(file)
    if (err) {
      toast.push(err.message, undefined, 'error')
      return
    }
    setUploading(true)
    setProgress(0)
    try {
      const url = await uploadLandingImage(file, storeId, (p) => setProgress(p))
      if (value && value.startsWith('https://') && value.includes('/o/')) {
        void deleteProductImage(value).catch(() => {})
      }
      onChange(url)
      toast.push('تمت إضافة الصورة')
    } catch (e) {
      console.error('landing image upload failed', e)
      toast.push('فشل رفع الصورة', 'تحقق من اتصالك وحاول مجدداً', 'error')
    } finally {
      setUploading(false)
    }
  }

  const remove = () => {
    if (value.includes('/o/')) void deleteProductImage(value).catch(() => {})
    onChange('')
  }

  return (
    <div className="landing-image-uploader">
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={onChosen} />
      {value ? (
        <div className="landing-image-preview">
          <SmartImage src={value} alt="" className="image-tile-img" placeholderClassName="image-tile-img image-tile-img--fallback" />
          <div className="image-tile-actions">
            <button type="button" className="icon-btn" title="استبدال" disabled={uploading} onClick={pick}>
              {uploading ? <span className="spinner spinner-sm" /> : <Icon name="edit" />}
            </button>
            <button type="button" className="icon-btn icon-btn-danger" title="حذف" disabled={uploading} onClick={remove}>
              <Icon name="delete" />
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="image-upload-empty" onClick={pick} disabled={uploading}>
          {uploading ? (
            <span className="small">{progress}% ...</span>
          ) : (
            <>
              <Icon name="add_photo_alternate" />
              <strong>{label || 'إضافة صورة'}</strong>
              <span className="muted small">JPG، PNG، WebP أو GIF — حتى 5 ميجابايت</span>
            </>
          )}
        </button>
      )}
    </div>
  )
}