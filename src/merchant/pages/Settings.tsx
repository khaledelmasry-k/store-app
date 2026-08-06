import { FunctionalComponent } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { Button } from '../../shared/components/ui/Button'
import { Input } from '../../shared/components/ui/Input'
import { Select } from '../../shared/components/ui/Select'
import { Toggle } from '../../shared/components/ui/Toggle'
import { useStore } from '../../shared/hooks/useStore'
import { useToast } from '../../shared/hooks/useToast'
import { storesService } from '../../shared/services/stores'
import { storePublicUrl } from '../../shared/utils/store-url'
import type { Store } from '../../shared/types'

const PRIMARY_SWATCHES = ['#6366f1', '#16a34a', '#dc2626', '#d97706', '#0284c7', '#7c3aed', '#0f172a']
const SECONDARY_SWATCHES = ['#f59e0b', '#10b981', '#f43f5e', '#8b5cf6', '#0ea5e9', '#f97316', '#64748b']

export const MerchantSettings: FunctionalComponent = () => {
  const { store } = useStore()
  const toast = useToast()
  const [form, setForm] = useState<Partial<Store>>({})
  const [themeForm, setThemeForm] = useState({ primary: '#6366f1', secondary: '#f59e0b', darkMode: false })
  const [savingTheme, setSavingTheme] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!store) return
    setThemeForm({
      primary: store.theme?.primary || '#6366f1',
      secondary: store.theme?.secondary || '#f59e0b',
      darkMode: !!store.theme?.darkMode,
    })
  }, [store, store?.id, store?.theme?.primary, store?.theme?.secondary, store?.theme?.darkMode])

  const persistTheme = async (next: { primary: string; secondary: string; darkMode: boolean }) => {
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

  const updateTheme = (patch: Partial<typeof themeForm>) => {
    const next = { ...themeForm, ...patch }
    setThemeForm(next)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => persistTheme(next), 600)
  }

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current) }, [])

  const save = async () => {
    if (!store) return
    await storesService.update(store.id, form)
    toast.push('تم حفظ الإعدادات')
  }

  const copyLink = async () => {
    if (!store) return
    const url = storePublicUrl(store)
    try {
      await navigator.clipboard.writeText(url)
      toast.push('تم نسخ الرابط', url, 'success')
    } catch {
      toast.push('تعذر نسخ الرابط', undefined, 'error')
    }
  }

  const togglePublish = async (v: boolean) => {
    if (!store) return
    await storesService.update(store.id, { published: v })
    toast.push(v ? 'تم نشر متجرك' : 'تم إخفاء متجرك', undefined, 'success')
  }

  return (
    <div>
      <PageHeader title="إعدادات المتجر" subtitle="البيانات العامة والمظهر والنشر" />

      <Card title="المعلومات الأساسية" className="mb-2">
        <div className="grid grid-2">
          <Input label="اسم المتجر" value={form.name ?? store?.name ?? ''} onChange={(v) => setForm({ ...form, name: v })} />
          <Input label="الرابط (ref)" value={form.ref ?? store?.ref ?? ''} onChange={(v) => setForm({ ...form, ref: v })} hint="رابط المتجر العام — يُستخدم في روابط المتجر" />
          <Input label="رقم الهاتف" value={form.phone ?? store?.phone ?? ''} onChange={(v) => setForm({ ...form, phone: v })} />
          <Input label="العنوان" value={form.address ?? store?.address ?? ''} onChange={(v) => setForm({ ...form, address: v })} />
          <Input label="الوصف" value={form.description ?? store?.description ?? ''} onChange={(v) => setForm({ ...form, description: v })} />
          <Select label="العملة" value={form.currency ?? store?.currency ?? 'EGP'} onChange={(v) => setForm({ ...form, currency: v })} options={['EGP', 'USD', 'SAR', 'AED'].map((c) => ({ value: c, label: c }))} />
        </div>
        <div className="field mt-1">
          <Toggle checked={form.active ?? store?.active ?? true} onChange={(v) => setForm({ ...form, active: v })} label="المتجر مفتوح للعملاء" />
        </div>
        <div className="flex flex-end mt-2">
          <Button icon="save" onClick={save}>حفظ</Button>
        </div>
      </Card>

      <Card title="الظهور والنشر" subtitle="رابط متجرك وحالة النشر" className="mb-2">
        <div className="list-row">
          <div>
            <span className="font-semibold">رابط المتجر العام</span>
            <div className="muted small">{store ? storePublicUrl(store) : '—'}</div>
          </div>
          <div className="flex flex-gap-sm">
            <Button variant="outline" size="sm" icon="link" onClick={copyLink}>نسخ</Button>
            {store && (
              <a href={`/store/${store.slug}`} target="_blank" rel="noreferrer">
                <Button variant="ghost" size="sm" icon="store">عرض</Button>
              </a>
            )}
          </div>
        </div>
        <div className="list-row">
          <div>
            <span className="font-semibold">نشر المتجر</span>
            <div className="muted small">{store?.published ? 'متجرك ظاهر للعملاء ويمكنه استقبال الطلبات' : 'الطلبات متوقفة حتى نشر المتجر'}</div>
          </div>
          <Toggle checked={!!store?.published} onChange={togglePublish} label="منشور" />
        </div>
        <div className="grid grid-2 mt-2">
          <Input label="عنوان SEO" value={form.seoTitle ?? store?.seoTitle ?? ''} onChange={(v) => setForm({ ...form, seoTitle: v })} hint="يُستخدم كعنوان صفحة المتجر في المتصفحات ومحركات البحث" />
          <Input label="وصف SEO" value={form.seoDescription ?? store?.seoDescription ?? ''} onChange={(v) => setForm({ ...form, seoDescription: v })} hint="وصف قصير يظهر في نتائج البحث" />
        </div>
        <div className="flex flex-end mt-2">
          <Button icon="save" onClick={save}>حفظ</Button>
        </div>
      </Card>

      <Card title="هوية المتجر" subtitle="الألوان تظهر في صفحة متجرك وتُحفظ تلقائياً">
        <div className="grid grid-2">
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
                <span className="material-symbols-outlined">palette</span>
              </label>
            </div>
          </div>
          <div>
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
                <span className="material-symbols-outlined">palette</span>
              </label>
            </div>
          </div>
        </div>

        <div className="flex-between mt-2">
          <div>
            <span className="font-semibold">الوضع الداكن لمتجرك</span>
            <div className="muted small">يتحكم في مظهر صفحة المتجر للزوار</div>
          </div>
          <Toggle checked={themeForm.darkMode} onChange={(v) => updateTheme({ darkMode: v })} label="داكن" />
        </div>

        <div className="theme-preview mt-2" style={{ background: themeForm.darkMode ? '#0f172a' : '#f8fafc' }}>
          <div className="theme-preview-brand">
            <span className="theme-preview-logo" style={{ background: themeForm.primary }} />
            <strong style={{ color: themeForm.darkMode ? '#f1f5f9' : '#0f172a' }}>معاينة المتجر</strong>
          </div>
          <div className="theme-preview-actions">
            <button type="button" className="theme-preview-btn" style={{ background: themeForm.primary }}>تسوق الآن</button>
            <button type="button" className="theme-preview-btn theme-preview-btn--soft" style={{ background: `${themeForm.primary}1f`, color: themeForm.primary }}>عرض المنتجات</button>
          </div>
          <div className="theme-preview-badges">
            <span className="theme-preview-badge" style={{ color: themeForm.primary }}>قوي — عملي</span>
          </div>
        </div>

        <div className="flex flex-end mt-2">
          <span className="muted small">{savingTheme ? 'جارٍ الحفظ...' : 'يُحفظ تلقائياً أثناء التعديل'}</span>
        </div>
      </Card>
    </div>
  )
}
export default MerchantSettings
