import { FunctionalComponent } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { InternalPageHeader } from '../components/InternalWorkspace'
import '../components/InternalWorkspace.css'
import { Card } from '../../shared/components/ui/Card'
import { Button } from '../../shared/components/ui/Button'
import { Badge } from '../../shared/components/ui/Badge'
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

const PRIMARY_SWATCHES = ['#0b766e', '#073f49', '#0f8f5f', '#075985', '#be3a34', '#102327', '#111827']
const SECONDARY_SWATCHES = ['#c78a25', '#2dd4bf', '#b87512', '#0f748c', '#64748b', '#f4bf55', '#4f6265']

export const MerchantThemes: FunctionalComponent = () => {
  const { store } = useStore()
  const toast = useToast()
  const [themeForm, setThemeForm] = useState<StoreTheme>({ primary: '#0b766e', secondary: '#c78a25', darkMode: false, template: 'modern', imageFit: 'contain' })
  const [savingTheme, setSavingTheme] = useState(false)
  const [applying, setApplying] = useState<string | null>(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const [heroUploading, setHeroUploading] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const heroInputRef = useRef<HTMLInputElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!store) return
    setThemeForm({
      primary: store.theme?.primary || '#0b766e',
      secondary: store.theme?.secondary || '#c78a25',
      darkMode: !!store.theme?.darkMode,
      template: store.theme?.template || 'modern',
      imageFit: store.theme?.imageFit || 'contain',
    })
  }, [store?.id, store?.theme?.primary, store?.theme?.secondary, store?.theme?.darkMode, store?.theme?.template, store?.theme?.imageFit])

  const persistTheme = async (next: StoreTheme) => {
    if (!store) return
    setSavingTheme(true)
    try {
      await storesService.update(store.id, { theme: next })
    } catch (err: any) {
      toast.push('فشل حفظ المظهر', err?.message || 'حدث خطأ غير متوقع', 'error')
    } finally {
      setSavingTheme(false)
    }
  }

  const updateTheme = (patch: Partial<StoreTheme>) => {
    const next = { ...themeForm, ...patch }
    setThemeForm(next)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => persistTheme(next), 600)
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
      if (saveTimer.current) clearTimeout(saveTimer.current)
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

  if (!store) return <Loading />

  return (
    <div className="merchant-operations merchant-themes-page">
      <InternalPageHeader eyebrow="استوديو المتجر" title="المظهر والقالب" subtitle="عدّل هوية متجرك وشاهد المعاينة الحية قبل فتحه للزوار" />

      <div className="theme-studio">
        <section className="theme-studio-controls">
      <Card title="اختر قالب متجرك" subtitle="تصميمات جاهزة تظهر في صفحة متجرك للزوار" className="mb-2">
        <div className="theme-gallery">
          {STORE_TEMPLATES.map((tpl) => {
            const active = themeForm.template === tpl.id
            const preview = { primary: tpl.defaultPrimary, secondary: tpl.defaultSecondary }
            return (
              <div key={tpl.id} className={`theme-card${active ? ' theme-card--active' : ''}`}>
                {active && <Badge tone="green">نشط</Badge>}
                <ThemePreview tpl={tpl} colors={preview} />
                <div className="theme-card-body">
                  <div className="theme-card-title">
                    <strong>{tpl.name}</strong>
                    <span className="muted small">{tpl.eyebrow}</span>
                  </div>
                  <p className="muted small">{tpl.description}</p>
                  <div className="theme-card-actions">
                    {active ? (
                      <Button variant="soft" size="sm" icon="check" disabled>القالب الحالي</Button>
                    ) : (
                      <Button size="sm" icon="check" loading={applying === tpl.id} onClick={() => applyTemplate(tpl.id)}>تطبيق</Button>
                    )}
                    {store && (
                      <a href={`/store/${store.slug}`} target="_blank" rel="noreferrer">
                        <Button variant="ghost" size="sm" icon="store">معاينة</Button>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      <div className="grid grid-2 mb-2">
        <Card title="ألوان المتجر" subtitle="تظهر على الأزرار والروابط والعناصر الرئيسية">
          <div>
            <span className="field-label">اللون الأساسي</span>
            <div className="swatch-row">
              {PRIMARY_SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="swatch"
                  style={{ background: c, borderColor: themeForm.primary === c ? 'var(--text)' : 'transparent' }}
                  onClick={() => updateTheme({ primary: c })}
                  title={c}
                />
              ))}
              <label className="swatch swatch--custom" title="لون مخصص">
                <input type="color" value={themeForm.primary} onChange={(e: any) => updateTheme({ primary: e.currentTarget.value })} />
                <Icon name="palette" />
              </label>
            </div>
          </div>
          <div className="mt-1">
            <span className="field-label">اللون الثانوي</span>
            <div className="swatch-row">
              {SECONDARY_SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="swatch"
                  style={{ background: c, borderColor: themeForm.secondary === c ? 'var(--text)' : 'transparent' }}
                  onClick={() => updateTheme({ secondary: c })}
                  title={c}
                />
              ))}
              <label className="swatch swatch--custom" title="لون مخصص">
                <input type="color" value={themeForm.secondary} onChange={(e: any) => updateTheme({ secondary: e.currentTarget.value })} />
                <Icon name="palette" />
              </label>
            </div>
          </div>

          <div className="flex-between mt-2">
            <div>
              <span className="font-semibold">الوضع الداكن لمتجرك</span>
              <div className="muted small">يتحكم في مظهر صفحة المتجر للزوار</div>
            </div>
            <Toggle checked={themeForm.darkMode} onChange={(v) => updateTheme({ darkMode: v })} label="داكن" />
          </div>

          <div className="field mt-2">
            <span className="field-label">عرض صور المنتجات</span>
            <div className="flex">
              <button type="button" className={`btn ${themeForm.imageFit !== 'cover' ? 'btn-primary' : 'btn-outline'}`} onClick={() => updateTheme({ imageFit: 'contain' })}>كما هي (بدون قص)</button>
              <button type="button" className={`btn ${themeForm.imageFit === 'cover' ? 'btn-primary' : 'btn-outline'}`} onClick={() => updateTheme({ imageFit: 'cover' })}>قص لملء الإطار</button>
            </div>
            <div className="muted small mt-1">تؤثر على الصورة الرئيسية في صفحة المنتج — "كما هي" تعرض الصورة كاملة دون قص</div>
          </div>

          <div className="theme-preview mt-2" style={{ background: themeForm.darkMode ? '#0f172a' : '#f8fafc' }}>
            <div className="theme-preview-brand">
              <span className="theme-preview-logo" style={{ background: themeForm.primary }} />
              <strong style={{ color: themeForm.darkMode ? '#f1f5f9' : '#0f172a' }}>معاينة المتجر</strong>
            </div>
            <div className="theme-preview-actions">
              <span className="theme-preview-btn" style={{ background: themeForm.primary }}>تسوق الآن</span>
              <span className="theme-preview-btn theme-preview-btn--soft" style={{ background: `${themeForm.primary}1f`, color: themeForm.primary }}>عرض المنتجات</span>
            </div>
            <div className="theme-preview-badges">
              <span className="theme-preview-badge" style={{ color: themeForm.primary }}>قوي — عملي</span>
            </div>
          </div>

          <div className="flex flex-end mt-2">
            <span className="muted small">{savingTheme ? 'جارٍ الحفظ...' : 'يُحفظ تلقائياً أثناء التعديل'}</span>
          </div>
        </Card>

        <div className="grid grid-2" style={{ gridTemplateColumns: '1fr 1.6fr' }}>
        <Card title="شعار المتجر" subtitle="يظهر في رأس صفحة متجرك وتذييلها">
          <div className="logo-field">
            <div className="logo-preview">
              {storeLogoKind(store.logo) === 'preset' ? (
                (() => {
                  const preset = presetFromLogo(store.logo)
                  return preset ? (
                    <span className="logo-preview-preset"><Icon name={preset.icon} /></span>
                  ) : (
                    <span className="logo-preview-placeholder"><Icon name="storefront" /></span>
                  )
                })()
              ) : store.logo ? (
                <SmartImage src={store.logo} alt={store.name} className="logo-preview-img" placeholderClassName="logo-preview-placeholder" />
              ) : (
                <span className="logo-preview-placeholder"><Icon name="storefront" /></span>
              )}
            </div>
            <p className="muted small mb-2">اختر شعاراً جاهزاً من المنصة أو ارفع شعاراً مخصصاً — JPG، PNG أو WebP حتى 5 ميجابايت</p>

            <span className="field-label">شعارات جاهزة</span>
            <div className="preset-logo-grid">
              {STORE_LOGO_PRESETS.map((p) => {
                const active = storeLogoKind(store.logo) === 'preset' && presetFromLogo(store.logo)?.id === p.id
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

            <div className="flex flex-gap-sm flex-wrap mt-2">
              <Button variant="outline" size="sm" icon="add_photo_alternate" onClick={pickLogo} loading={logoUploading}>رفع شعار</Button>
              {store.logo && (
                <Button variant="ghost" size="sm" icon="delete" onClick={removeLogo}>إزالة</Button>
              )}
            </div>
            <input ref={logoInputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={onLogoChosen} />
          </div>
        </Card>

        <Card title="صورة الغلاف (Hero)" subtitle="تظهر أعلى صفحة متجرك الرئيسية — بأبعاد مستعرضة">
          <div className="logo-field">
            <div className="hero-preview">
              {store.heroImage ? (
                <SmartImage src={store.heroImage} alt={store.name} className="hero-preview-img" placeholderClassName="hero-preview-img" />
              ) : (
                <div className="hero-preview-placeholder"><Icon name="image" /><span className="muted small">لا توجد صورة — سيُستخدم تدرّج اللون الافتراضي</span></div>
              )}
            </div>
            <p className="muted small mb-2">JPG، PNG أو WebP — حتى 5 ميجابايت، أبعاد واسعة (مثل 1200×400)</p>
            <div className="flex flex-gap-sm flex-wrap">
                  <Button variant="outline" size="sm" icon="add_photo_alternate" onClick={pickHero} loading={heroUploading}>رفع صورة الغلاف</Button>
              {store.heroImage && (
                <Button variant="ghost" size="sm" icon="delete" onClick={removeHero}>إزالة</Button>
              )}
            </div>
            <input ref={heroInputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={onHeroChosen} />
          </div>
        </Card>
      </div>
      </div>
        </section>
        <aside className="theme-studio-preview" style={{ '--theme-preview-primary': themeForm.primary, '--theme-preview-secondary': themeForm.secondary } as any}>
          <div className="theme-device">
            <div className="theme-device-top">
              <span />
              <span />
              <span />
            </div>
            <div className={`theme-device-screen${themeForm.darkMode ? ' is-dark' : ''}`}>
              <div className="theme-device-nav">
                <strong>{store.name}</strong>
                <small>متجر مباشر</small>
              </div>
              <div className="theme-device-hero">
                <span>واجهة المتجر</span>
                <h3>{store.seoTitle || store.name}</h3>
                <p>{store.description || 'منتجات مختارة، عروض واضحة، وتجربة شراء سهلة.'}</p>
                <b>تسوق الآن</b>
              </div>
              <div className="theme-device-products">
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>
          <a href={`/store/${store.slug}`} target="_blank" rel="noreferrer" className="btn btn-primary btn-lg theme-preview-link">
            <Icon name="open_in_new" />
            فتح المعاينة الحية
          </a>
        </aside>
      </div>
    </div>
  )
}

function ThemePreview({ tpl, colors }: { tpl: { name: string; cssClass: string }; colors: { primary: string; secondary: string } }) {
  return (
    <div className={`theme-preview-frame ${tpl.cssClass}`} style={{ '--tp-primary': colors.primary, '--tp-secondary': colors.secondary } as any}>
      <div className="tp-bar">
        <span className="tp-logo" />
        <span className="tp-name">{tpl.name}</span>
        <span className="tp-nav"><i /><i /><i /></span>
      </div>
      <div className="tp-hero">
        <b>تسوق أحدث المنتجات</b>
        <i>عروض مميزة وتوصيل سريع</i>
        <em>تسوق الآن</em>
      </div>
      <div className="tp-grid">
        <span className="tp-card" /><span className="tp-card" /><span className="tp-card" />
      </div>
    </div>
  )
}

export default MerchantThemes
