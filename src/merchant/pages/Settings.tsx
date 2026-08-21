import { FunctionalComponent } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Button } from '../../shared/components/ui/Button'
import { Toggle } from '../../shared/components/ui/Toggle'
import { useStore } from '../../shared/hooks/useStore'
import { useToast } from '../../shared/hooks/useToast'
import { storesService } from '../../shared/services/stores'
import { setStorePublishedCallable } from '../../shared/services/auth'
import { storePublicUrl, normalizeSlug, ensureUniqueSlug, storeBaseUrl } from '../../shared/utils/store-url'
import { slugify } from '../../shared/utils/format'
import type { Store } from '../../shared/types'
import { Icon } from '../../shared/components/ui/Icon'
import './Settings.css'

const CURRENCIES = [
  { value: 'SAR', label: 'ريال سعودي (SAR)' },
  { value: 'AED', label: 'درهم إماراتي (AED)' },
  { value: 'EGP', label: 'جنيه مصري (EGP)' },
  { value: 'USD', label: 'دولار أمريكي (USD)' },
]

export const MerchantSettings: FunctionalComponent = () => {
  const { store } = useStore()
  const toast = useToast()
  const [form, setForm] = useState<Partial<Store>>({})
  const [slugField, setSlugField] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!store) return
    setSlugField(store.slug || '')
  }, [store?.id, store?.slug])

  const save = async () => {
    if (!store) return
    setSaving(true)
    try {
      const name = (form.name ?? store.name ?? '').trim()
      const candidate = slugField.trim() || slugify(name) || store.slug || 'store'
      const slug = await ensureUniqueSlug(candidate, store.id)
      await storesService.update(store.id, {
        ...form,
        name,
        slug,
        ref: slug,
      })
      setSlugField(slug)
      toast.push('تم حفظ التغييرات بنجاح', `رابط متجرك: /store/${slug}`, 'success')
    } catch (err: any) {
      toast.push('فشل حفظ الإعدادات', err?.message || 'حدث خطأ غير متوقع', 'error')
    } finally {
      setSaving(false)
    }
  }

  const resetForm = () => {
    if (!store) return
    setForm({})
    setSlugField(store.slug || '')
  }

  const copyLink = async () => {
    if (!store) return
    const url = storePublicUrl(store)
    if (!url) {
      toast.push('رابط المتجر غير متاح بعد', 'حدد رابطاً صالحاً للمتجر أولاً', 'error')
      return
    }
    try {
      await navigator.clipboard.writeText(url)
      toast.push('تم نسخ الرابط', url, 'success')
    } catch {
      toast.push('تعذر نسخ الرابط', undefined, 'error')
    }
  }

  const togglePublish = async (v: boolean) => {
    if (!store) return
    try {
      await setStorePublishedCallable({ storeId: store.id, published: v })
      toast.push(v ? 'تم نشر متجرك' : 'تم إيقاف نشر المتجر', undefined, 'success')
    } catch (err: any) {
      toast.push('تعذر تحديث حالة النشر', err?.message || 'حدث خطأ غير متوقع', 'error')
    }
  }

  const publicUrl = store ? storePublicUrl(store) : null
  const published = !!store?.published
  const domain = storeBaseUrl().replace(/^https?:\/\//, '')

  return (
    <div className="merchant-operations merchant-settings-page">
      <PageHeader
        title="الإعدادات العامة والنشر"
        subtitle="إدارة معلومات المتجر الأساسية، الروابط، وحالة النشر"
        actions={
          <div className="settings-header-actions">
            <Button variant="outline" onClick={resetForm}>إلغاء</Button>
            <Button icon="save" onClick={save} loading={saving}>حفظ</Button>
          </div>
        }
      />

      <div className="settings-grid">
        <div className="settings-main">
          <section className="settings-card">
            <div className="settings-card-head">
              <h3><Icon name="storefront" ariaHidden /> معلومات المتجر</h3>
            </div>
            <div className="settings-card-body">
              <div className="settings-status-row">
                <div>
                  <h4>حالة المتجر</h4>
                  <p>تفعيل أو إيقاف المتجر مؤقتاً للزوار.</p>
                </div>
                <Toggle checked={form.active ?? store?.active ?? true} onChange={(v) => setForm({ ...form, active: v })} />
              </div>
              <div className="field">
                <label className="field-label">اسم المتجر</label>
                <input className="input" value={form.name ?? store?.name ?? ''} onChange={(e) => setForm({ ...form, name: (e.target as HTMLInputElement).value })} />
              </div>
              <div className="grid grid-2">
                <div className="field">
                  <label className="field-label">رقم الهاتف</label>
                  <input className="input" value={form.phone ?? store?.phone ?? ''} onChange={(e) => setForm({ ...form, phone: (e.target as HTMLInputElement).value })} />
                </div>
                <div className="field">
                  <label className="field-label">العملة الافتراضية</label>
                  <select className="input" value={form.currency ?? store?.currency ?? 'EGP'} onChange={(e) => setForm({ ...form, currency: (e.target as HTMLSelectElement).value })}>
                    {CURRENCIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="field">
                <label className="field-label">العنوان</label>
                <input className="input" value={form.address ?? store?.address ?? ''} onChange={(e) => setForm({ ...form, address: (e.target as HTMLInputElement).value })} />
              </div>
              <div className="field">
                <label className="field-label">وصف المتجر</label>
                <textarea className="input settings-textarea" rows={3} value={form.description ?? store?.description ?? ''} onChange={(e) => setForm({ ...form, description: (e.target as HTMLTextAreaElement).value })} />
              </div>
              <div className="settings-seo-box">
                <h4><Icon name="search" ariaHidden /> تحسين محركات البحث (SEO)</h4>
                <div className="field">
                  <label className="field-label small">عنوان الصفحة (Meta Title)</label>
                  <input className="input" value={form.seoTitle ?? store?.seoTitle ?? ''} onChange={(e) => setForm({ ...form, seoTitle: (e.target as HTMLInputElement).value })} />
                  <p className="settings-field-hint">يفضل ألا يتجاوز 60 حرفاً.</p>
                </div>
                <div className="field">
                  <label className="field-label small">وصف الصفحة (Meta Description)</label>
                  <textarea className="input settings-textarea" rows={2} value={form.seoDescription ?? store?.seoDescription ?? ''} onChange={(e) => setForm({ ...form, seoDescription: (e.target as HTMLTextAreaElement).value })} />
                  <p className="settings-field-hint">يفضل ألا يتجاوز 160 حرفاً للحصول على أفضل ظهور في نتائج البحث.</p>
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="settings-side">
          <section className="settings-card">
            <div className="settings-card-head settings-card-head--between">
              <h3><Icon name="link" ariaHidden /> الرابط والنشر</h3>
              <span className="settings-chip"><Icon name="edit_document" ariaHidden /> slug</span>
            </div>
            <div className="settings-card-body">
              <div className="settings-domain-row">
                <Icon name="verified" ariaHidden />
                <span>نطاق مخصص</span>
                <span className="settings-plan-badge">ميزة الخطة المتقدمة</span>
              </div>
              <div className="field">
                <label className="field-label">رابط المتجر الحالي (Slug)</label>
                <div className="settings-slug-input" dir="ltr">
                  <span className="settings-slug-prefix">{domain}/</span>
                  <input className="settings-slug-field" value={slugField} onChange={(e) => setSlugField((e.target as HTMLInputElement).value)} />
                </div>
                <p className="settings-field-hint">يتم توليد الرابط تلقائياً بناءً على اسم المتجر — أحرف إنجليزية وأرقام وشرطات فقط</p>
              </div>
              <div className="settings-slug-actions">
                <Button variant="outline" icon="content_copy" onClick={copyLink} disabled={!publicUrl}>نسخ الرابط</Button>
                <Button icon="save_as" onClick={() => setSlugField(normalizeSlug((form.name ?? store?.name ?? '')))}>توليد من الاسم</Button>
              </div>
              {store && (
                <a href={`/store/${store.slug}`} target="_blank" rel="noreferrer" className="settings-open-store">
                  <Icon name="open_in_new" ariaHidden />
                  فتح المتجر
                </a>
              )}
            </div>
          </section>

          <section className="settings-card settings-publish-card">
            {published ? (
              <div className="settings-publish-inner">
                <h3 className="settings-publish-title">حالة المتجر</h3>
                <button type="button" className="settings-unpublish-btn" onClick={() => togglePublish(false)}>
                  <Icon name="close" ariaHidden />
                  إيقاف نشر المتجر
                </button>
                <label className="field-label">رابط متجرك العام</label>
                <div className="settings-public-url" dir="ltr">
                  <span className="settings-public-url-text">{publicUrl || '—'}</span>
                  <button type="button" className="settings-icon-btn" onClick={copyLink} title="نسخ الرابط" aria-label="نسخ الرابط"><Icon name="content_copy" ariaHidden /></button>
                </div>
                <div className="settings-slug-actions">
                  <a href={`/store/${store.slug}`} target="_blank" rel="noreferrer" className="settings-outline-link">
                    <Button variant="outline" icon="open_in_new">فتح المتجر</Button>
                  </a>
                  <Button variant="outline" icon="share" onClick={copyLink}>مشاركة</Button>
                </div>
              </div>
            ) : (
              <div className="settings-draft-preview">
                <div className="settings-draft-icon"><Icon name="visibility" ariaHidden /></div>
                <h4>معاينة المسودة</h4>
                <p>يمكنك معاينة التغييرات التي قمت بها قبل نشر المتجر للعملاء.</p>
                {store && (
                  <a href={`/store/${store.slug}`} target="_blank" rel="noreferrer" className="settings-draft-btn">
                    عرض المعاينة
                  </a>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
export default MerchantSettings