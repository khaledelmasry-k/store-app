import { FunctionalComponent } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import './Themes.css'
import { Button } from '../../shared/components/ui/Button'
import { Toggle } from '../../shared/components/ui/Toggle'
import { Loading } from '../../shared/components/ui/Loading'
import { SmartImage } from '../../shared/components/ui/SmartImage'
import { Icon } from '../../shared/components/ui/Icon'
import { useStore } from '../../shared/hooks/useStore'
import { useToast } from '../../shared/hooks/useToast'
import { storesService } from '../../shared/services/stores'
import { uploadStoreLogo, uploadStoreHero, validateImageFile, uploadErrorMessage } from '../../shared/services/uploads'
import { STORE_TEMPLATES } from '../../shared/utils/themes'
import { STORE_LOGO_PRESETS, storeLogoKey, storeLogoKind, presetFromLogo, isPersistableImageUrl } from '../../shared/utils/store-brand'
import type { StoreTheme } from '../../shared/types'
import { ThemePreviewStorefront } from '../../store/components/ThemePreviewStorefront'

const PRIMARY_SWATCHES = ['#0b766e', '#073f49', '#0f8f5f', '#075985', '#be3a34', '#102327', '#111827']
const SECONDARY_SWATCHES = ['#c78a25', '#2dd4bf', '#b87512', '#0f748c', '#64748b', '#f4bf55', '#4f6265']
const CANONICAL_TEMPLATES = STORE_TEMPLATES.filter((tpl) => tpl.canonical)
const LEGACY_TEMPLATES = STORE_TEMPLATES.filter((tpl) => tpl.legacy)

export const MerchantThemes: FunctionalComponent = () => {
  const { store } = useStore()
  const toast = useToast()
  const [themeForm, setThemeForm] = useState<StoreTheme>({ primary: '#0b766e', secondary: '#c78a25', darkMode: false, template: 'modern', imageFit: 'contain' })
  const [savingTheme, setSavingTheme] = useState(false)
  const [applying, setApplying] = useState<string | null>(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const [heroUploading, setHeroUploading] = useState(false)
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')
  const logoInputRef = useRef<HTMLInputElement>(null)
  const heroInputRef = useRef<HTMLInputElement>(null)
  const undoStack = useRef<StoreTheme[]>([])
  const redoStack = useRef<StoreTheme[]>([])

  useEffect(() => {
    const theme = store?.theme
    if (!theme) return
    setThemeForm({
      primary: theme.primary || '#0b766e',
      secondary: theme.secondary || '#c78a25',
      darkMode: !!theme.darkMode,
      template: theme.template || 'modern',
      imageFit: theme.imageFit || 'contain',
    })
  }, [store?.theme])

  const updateTheme = (patch: Partial<StoreTheme>) => {
    const next = { ...themeForm, ...patch }
    undoStack.current.push(themeForm)
    if (undoStack.current.length > 20) undoStack.current.shift()
    redoStack.current = []
    setThemeForm(next)
    if (store) {
      setSavingTheme(true)
      void storesService.update(store.id, { theme: next })
        .catch((err: any) => toast.push('فشل حفظ المظهر', err?.message || 'حدث خطأ غير متوقع', 'error'))
        .finally(() => setSavingTheme(false))
    }
  }

  const undoTheme = () => {
    const prev = undoStack.current.pop()
    if (!prev) return
    redoStack.current.push(themeForm)
    setThemeForm(prev)
  }

  const redoTheme = () => {
    const next = redoStack.current.pop()
    if (!next) return
    undoStack.current.push(themeForm)
    setThemeForm(next)
  }

  const saveNow = async () => {
    if (!store) return
    setSavingTheme(true)
    try {
      await storesService.update(store.id, { theme: themeForm })
      toast.push('تم حفظ التغييرات', undefined, 'success')
    } catch (err: any) {
      toast.push('فشل حفظ المظهر', err?.message || 'حدث خطأ غير متوقع', 'error')
    } finally {
      setSavingTheme(false)
    }
  }

  const applyTemplate = async (id: string) => {
    if (!store || applying) return
    const tpl = STORE_TEMPLATES.find((t) => t.id === id)
    if (!tpl) return
    setApplying(id)
    try {
      const next: StoreTheme = {
        primary: tpl.defaultPrimary,
        secondary: tpl.defaultSecondary,
        darkMode: tpl.darkMode,
        template: id,
        imageFit: themeForm.imageFit || 'contain',
      }
      setThemeForm(next)
      await storesService.update(store.id, { theme: next })
      toast.push('تم تطبيق القالب', tpl.name, 'success')
    } catch (err: any) {
      toast.push('فشل تطبيق القالب', err?.message || 'حدث خطأ غير متوقع', 'error')
    } finally {
      setApplying(null)
    }
  }

  const pickLogo = () => logoInputRef.current?.click()

  const onLogoChosen = async (e: Event) => {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file || !store) return
    const err = validateImageFile(file)
    if (err) {
      toast.push(err.message, undefined, 'error')
      return
    }
    setLogoUploading(true)
    try {
      const url = await uploadStoreLogo(file, store.id)
      if (!isPersistableImageUrl(url)) {
        throw new Error('رابط الصورة المرفوعة غير صالح للحفظ')
      }
      await storesService.update(store.id, { logo: url })
      toast.push('تم تحديث شعار المتجر', `تم الحفظ في تخزين Firebase`, 'success')
    } catch (e: any) {
      console.error('logo upload failed', e)
      toast.push('فشل رفع الشعار', `${uploadErrorMessage(e)}${e?.code ? ` — ${e.code}` : ''}`, 'error')
    } finally {
      setLogoUploading(false)
    }
  }

  const selectPreset = async (id: string) => {
    if (!store) return
    try {
      await storesService.update(store.id, { logo: storeLogoKey(id) })
      toast.push('تم تحديث شعار المتجر', undefined, 'success')
    } catch (err: any) {
      toast.push('فشل حفظ شعار المتجر', err?.message || 'حدث خطأ غير متوقع', 'error')
    }
  }

  const removeLogo = async () => {
    if (!store) return
    try {
      await storesService.update(store.id, { logo: null })
      toast.push('تمت إزالة الشعار')
    } catch (err: any) {
      toast.push('فشل إزالة الشعار', err?.message || 'حدث خطأ غير متوقع', 'error')
    }
  }

  const pickHero = () => heroInputRef.current?.click()

  const onHeroChosen = async (e: Event) => {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file || !store) return
    const err = validateImageFile(file)
    if (err) {
      toast.push(err.message, undefined, 'error')
      return
    }
    setHeroUploading(true)
    try {
      const url = await uploadStoreHero(file, store.id)
      if (!isPersistableImageUrl(url)) {
        throw new Error('رابط الصورة المرفوعة غير صالح للحفظ')
      }
      await storesService.update(store.id, { heroImage: url })
      toast.push('تم تحديث صورة الغلاف', `تم الحفظ في تخزين Firebase`, 'success')
    } catch (e: any) {
      console.error('hero upload failed', e)
      toast.push('فشل رفع الصورة', `${uploadErrorMessage(e)}${e?.code ? ` — ${e.code}` : ''}`, 'error')
    } finally {
      setHeroUploading(false)
    }
  }

  const removeHero = async () => {
    if (!store) return
    try {
      await storesService.update(store.id, { heroImage: null })
      toast.push('تمت إزالة الصورة')
    } catch (err: any) {
      toast.push('فشل إزالة الصورة', err?.message || 'حدث خطأ غير متوقع', 'error')
    }
  }

  if (!store) return <Loading message="جارٍ تحميل استوديو التصميم..." />

  const logoKind = storeLogoKind(store.logo)
  const logoPreset = logoKind === 'preset' ? presetFromLogo(store.logo) : null

  return (
    <div data-tour="themes-workspace" className="merchant-operations merchant-themes-page">
      <PageHeader
        breadcrumb="استوديو المتجر"
        title="استوديو التصميم"
        subtitle="عدّل مظهر متجرك وشاهد المعاينة فوراً"
        actions={
          <div className="theme-header-meta">
            <span className={`theme-save-state${savingTheme ? ' is-saving' : ''}`}>
              <Icon name="check_circle" ariaHidden />
              {savingTheme ? 'جارٍ الحفظ...' : 'تم حفظ التغييرات'}
            </span>
            <div className="theme-history">
              <button type="button" className="theme-history-btn" onClick={undoTheme} disabled={!undoStack.current.length} title="تراجع" aria-label="تراجع"><Icon name="undo" ariaHidden /></button>
              <button type="button" className="theme-history-btn" onClick={redoTheme} disabled={!redoStack.current.length} title="إعادة" aria-label="إعادة"><Icon name="redo" ariaHidden /></button>
              <button type="button" className="theme-history-btn lg:hidden" onClick={() => setDevice(device === 'desktop' ? 'mobile' : 'desktop')} title="الأجهزة" aria-label="الأجهزة"><Icon name="devices" ariaHidden /></button>
            </div>
            <a href={`/store/${store.slug}`} target="_blank" rel="noreferrer" className="theme-header-preview">
              <Button variant="outline" icon="visibility" size="sm">معاينة</Button>
            </a>
            <Button size="sm" icon="save" onClick={saveNow} loading={savingTheme}>حفظ التغييرات</Button>
          </div>
        }
      />

      <div className="theme-studio">
        <section className="theme-studio-controls">
          <div className="theme-section">
            <div className="theme-section-head">
              <h3>قوالب التصميم</h3>
              <span className="theme-section-sub">اختر الهيكل العام لمتجرك</span>
            </div>
            <div className="theme-tpl-grid theme-gallery">
              {CANONICAL_TEMPLATES.map((tpl) => {
                const active = themeForm.template === tpl.id
                const preview = { primary: tpl.defaultPrimary, secondary: tpl.defaultSecondary }
                return (
                  <div
                    key={tpl.id}
                    className={`theme-tpl-card theme-card${active ? ' theme-card--active is-active' : ''}`}
                    onClick={() => applyTemplate(tpl.id)}
                    title={tpl.description}
                  >
                    {active && <span className="theme-tpl-badge">القالب الحالي</span>}
                    <ThemePreview tpl={tpl} colors={preview} />
                    <div className="theme-tpl-foot">
                      <span className="theme-tpl-name">{tpl.name}</span>
                      {active ? (
                        <Button variant="soft" size="sm" icon="check" disabled>القالب الحالي</Button>
                      ) : (
                        <Button size="sm" icon="check" loading={applying === tpl.id} onClick={(e) => { e.stopPropagation(); applyTemplate(tpl.id) }}>تطبيق</Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            {LEGACY_TEMPLATES.length > 0 && <details className="theme-legacy-group">
              <summary>قوالب قديمة (للمتاجر الحالية)</summary>
              <div className="theme-tpl-grid theme-gallery">
                {LEGACY_TEMPLATES.map((tpl) => {
                  const active = themeForm.template === tpl.id
                  const preview = { primary: tpl.defaultPrimary, secondary: tpl.defaultSecondary }
                  return (
                    <div key={tpl.id} className={`theme-tpl-card theme-card${active ? ' theme-card--active is-active' : ''}`} onClick={() => applyTemplate(tpl.id)} title={tpl.description}>
                      {active && <span className="theme-tpl-badge">القالب الحالي</span>}
                      <ThemePreview tpl={tpl} colors={preview} />
                      <div className="theme-tpl-foot"><span className="theme-tpl-name">{tpl.name}</span><Button size="sm" icon="check" loading={applying === tpl.id} onClick={(e) => { e.stopPropagation(); applyTemplate(tpl.id) }}>تطبيق</Button></div>
                    </div>
                  )
                })}
              </div>
            </details>}
          </div>

          <div className="theme-section">
            <div className="theme-section-head">
              <h3>الألوان</h3>
              <span className="theme-section-sub">تخصيص هوية الألوان لمتجرك</span>
            </div>
            <span className="theme-color-label">الألوان الأساسية</span>
            <div className="swatch-row">
              {PRIMARY_SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`swatch theme-swatch${themeForm.primary === c ? ' is-active' : ''}`}
                  style={{ background: c }}
                  onClick={() => updateTheme({ primary: c })}
                  title={c}
                />
              ))}
              <label className="swatch swatch--custom theme-swatch-custom" title="لون مخصص">
                <input type="color" value={themeForm.primary} onChange={(e: any) => updateTheme({ primary: e.currentTarget.value })} />
                <Icon name="palette" />
              </label>
            </div>
            <span className="theme-color-label">الألوان الثانوية (الخلفيات)</span>
            <div className="swatch-row">
              {SECONDARY_SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`swatch theme-swatch${themeForm.secondary === c ? ' is-active' : ''}`}
                  style={{ background: c }}
                  onClick={() => updateTheme({ secondary: c })}
                  title={c}
                />
              ))}
              <label className="swatch swatch--custom theme-swatch-custom" title="لون مخصص">
                <input type="color" value={themeForm.secondary} onChange={(e: any) => updateTheme({ secondary: e.currentTarget.value })} />
                <Icon name="palette" />
              </label>
            </div>
          </div>

          <div className="theme-section">
            <div className="theme-section-head">
              <h3>الهوية والصور</h3>
              <span className="theme-section-sub">الشعار وصورة العرض الرئيسية</span>
            </div>

            <span className="theme-color-label">شعار المتجر</span>
            <div className="logo-field">
            <div className="theme-upload-box">
              <div className="theme-upload-preview logo-preview">
                {logoKind === 'preset' && logoPreset ? (
                  <span className="theme-upload-icon"><Icon name={logoPreset.icon} ariaHidden /></span>
                ) : store.logo ? (
                  <SmartImage src={store.logo} alt={store.name} className="theme-upload-img" placeholderClassName="theme-upload-icon" />
                ) : (
                  <span className="theme-upload-icon"><Icon name="storefront" ariaHidden /></span>
                )}
              </div>
              <div className="theme-upload-body">
                <div className="theme-upload-actions">
                  <Button variant="outline" size="sm" icon="add_photo_alternate" onClick={pickLogo} loading={logoUploading}>رفع شعار</Button>
                  {store.logo && <Button variant="ghost" size="sm" icon="delete" onClick={removeLogo}>إزالة</Button>}
                </div>
                <span className="theme-upload-hint">JPG، PNG أو WebP حتى 5 ميجابايت</span>
              </div>
            </div>
            <input ref={logoInputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={onLogoChosen} />
            <div className="theme-presets">
              <span className="theme-color-label">شعارات جاهزة</span>
              <div className="preset-logo-grid">
                {STORE_LOGO_PRESETS.map((p) => {
                  const active = logoKind === 'preset' && logoPreset?.id === p.id
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className={`preset-logo-item${active ? ' preset-logo-item--active' : ''}`}
                      title={p.name}
                      onClick={() => selectPreset(p.id)}
                    >
                      <span className="preset-logo-icon"><Icon name={p.icon} /></span>
                      <span className="preset-logo-name">{p.name}</span>
                    </button>
                  )
                })}
              </div>
            </div>
            </div>

            <span className="theme-color-label">صورة الغلاف (Hero)</span>
            <div className="theme-upload-box">
              <div className="theme-upload-preview is-wide">
                {store.heroImage ? (
                  <SmartImage src={store.heroImage} alt={store.name} className="theme-upload-img" placeholderClassName="theme-upload-icon" />
                ) : (
                  <span className="theme-upload-icon"><Icon name="image" ariaHidden /><small>لا توجد صورة — سيُستخدم تدرّج اللون الافتراضي</small></span>
                )}
              </div>
              <div className="theme-upload-body">
                <div className="theme-upload-actions">
                  <Button variant="outline" size="sm" icon="add_photo_alternate" onClick={pickHero} loading={heroUploading}>رفع صورة الغلاف</Button>
                  {store.heroImage && <Button variant="ghost" size="sm" icon="delete" onClick={removeHero}>إزالة</Button>}
                </div>
                <span className="theme-upload-hint">JPG، PNG أو WebP — حتى 5 ميجابايت، أبعاد واسعة (مثل 1200×400)</span>
              </div>
            </div>
            <input ref={heroInputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={onHeroChosen} />
          </div>

          <div className="theme-section">
            <div className="theme-section-head">
              <h3>إعدادات إضافية</h3>
            </div>
            <div className="theme-setting-row">
              <div>
                <span className="theme-setting-title">الوضع الداكن</span>
                <span className="theme-setting-sub">تفعيل الثيم الداكن للمتجر</span>
              </div>
              <Toggle checked={themeForm.darkMode} onChange={(v) => updateTheme({ darkMode: v })} />
            </div>
            <span className="theme-color-label">طريقة عرض صور المنتجات</span>
            <div className="theme-segmented">
              <button type="button" className={`theme-segmented-btn${themeForm.imageFit !== 'cover' ? ' is-active' : ''}`} onClick={() => updateTheme({ imageFit: 'contain' })}>كما هي (بدون قص)</button>
              <button type="button" className={`theme-segmented-btn${themeForm.imageFit === 'cover' ? ' is-active' : ''}`} onClick={() => updateTheme({ imageFit: 'cover' })}>قص لملء الإطار</button>
            </div>
            <span className="theme-upload-hint">تؤثر على الصورة الرئيسية في صفحة المنتج — "كما هي" تعرض الصورة كاملة دون قص</span>
          </div>
        </section>

        <aside className="theme-studio-preview">
          <div className="theme-preview-toolbar">
            <span className="theme-preview-label">المعاينة المباشرة</span>
            <div className="theme-device-toggle">
              <button type="button" className={`theme-device-btn${device === 'desktop' ? ' is-active' : ''}`} onClick={() => setDevice('desktop')} title="حاسوب"><Icon name="web" ariaHidden /></button>
              <button type="button" className={`theme-device-btn${device === 'mobile' ? ' is-active' : ''}`} onClick={() => setDevice('mobile')} title="جوال"><Icon name="smartphone" ariaHidden /></button>
            </div>
          </div>
          <div className="theme-preview-stage"><ThemePreviewStorefront template={themeForm.template || 'modern'} primary={themeForm.primary} secondary={themeForm.secondary || themeForm.primary} storeName={store.name} description={store.description} mobile={device === 'mobile'} /></div>
          <a href={`/store/${store.slug}`} target="_blank" rel="noreferrer" className="btn btn-primary btn-lg theme-preview-link">
            <Icon name="open_in_new" />
            فتح المعاينة الحية
          </a>
        </aside>
      </div>
    </div>
  )
}

function ThemePreview({ tpl, colors }: { tpl: any; colors: { primary: string; secondary: string } }) {
  return <ThemePreviewStorefront template={tpl} primary={colors.primary} secondary={colors.secondary} storeName={tpl.name} mini />
}

export default MerchantThemes
