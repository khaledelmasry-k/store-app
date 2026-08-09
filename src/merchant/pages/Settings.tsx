import { FunctionalComponent } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { Link } from 'wouter'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { Button } from '../../shared/components/ui/Button'
import { Input } from '../../shared/components/ui/Input'
import { Select } from '../../shared/components/ui/Select'
import { Toggle } from '../../shared/components/ui/Toggle'
import { Badge } from '../../shared/components/ui/Badge'
import { useStore } from '../../shared/hooks/useStore'
import { useToast } from '../../shared/hooks/useToast'
import { storesService } from '../../shared/services/stores'
import { storePublicUrl, normalizeSlug, ensureUniqueSlug } from '../../shared/utils/store-url'
import { slugify } from '../../shared/utils/format'
import type { Store } from '../../shared/types'

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
      toast.push('تم حفظ الإعدادات', `رابط متجرك: /store/${slug}`, 'success')
    } catch (err: any) {
      toast.push('فشل حفظ الإعدادات', err?.message || 'حدث خطأ غير متوقع', 'error')
    } finally {
      setSaving(false)
    }
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
      await storesService.update(store.id, { published: v })
      toast.push(v ? 'تم نشر متجرك' : 'تم إخفاء متجرك', undefined, 'success')
    } catch (err: any) {
      toast.push('تعذر تحديث حالة النشر', err?.message || 'حدث خطأ غير متوقع', 'error')
    }
  }

  const publicUrl = store ? storePublicUrl(store) : null
  const status = store?.published ? 'published' : 'draft'

  return (
    <div>
      <PageHeader title="إعدادات المتجر" subtitle="البيانات العامة والرابط والنشر" />

      <Card title="معلومات المتجر" className="mb-2">
        <div className="grid grid-2">
          <Input label="اسم المتجر" value={form.name ?? store?.name ?? ''} onChange={(v) => setForm({ ...form, name: v })} />
          <Input label="رقم الهاتف" value={form.phone ?? store?.phone ?? ''} onChange={(v) => setForm({ ...form, phone: v })} />
          <Input label="العنوان" value={form.address ?? store?.address ?? ''} onChange={(v) => setForm({ ...form, address: v })} />
          <Select label="العملة" value={form.currency ?? store?.currency ?? 'EGP'} onChange={(v) => setForm({ ...form, currency: v })} options={['EGP', 'USD', 'SAR', 'AED'].map((c) => ({ value: c, label: c }))} />
        </div>
        <Input label="الوصف" value={form.description ?? store?.description ?? ''} onChange={(v) => setForm({ ...form, description: v })} />
        <div className="field mt-1">
          <Toggle checked={form.active ?? store?.active ?? true} onChange={(v) => setForm({ ...form, active: v })} label="المتجر مفتوح للعملاء" />
        </div>
        <div className="flex flex-end mt-2">
          <Button icon="save" onClick={save} loading={saving}>حفظ</Button>
        </div>
      </Card>

      <Card title="رابط المتجر والنشر" className="mb-2">
        <div className="list-row">
          <div>
            <span className="font-semibold">حالة المتجر</span>
            <div className="mt-1">
              {status === 'published' ? (
                <Badge tone="green">🟢 منشور — متاح للشراء</Badge>
              ) : (
                <Badge tone="amber">🟡 مسودة — غير متاح للشراء</Badge>
              )}
            </div>
          </div>
          <Toggle checked={!!store?.published} onChange={togglePublish} label="منشور" />
        </div>

        <div className="grid grid-2 mt-2">
          <div dir="ltr" style={{ textAlign: 'right' }}>
            <Input
              label="رابط المتجر (Slug)"
              value={slugField}
              onChange={(v) => setSlugField(v)}
              hint="أحرف إنجليزية وأرقام وشرطات فقط — لا مسافات. مثال: mk-fashion"
            />
          </div>
          <div className="field">
            <span className="field-label">توليد من الاسم</span>
            <div className="flex" style={{ gap: 8 }}>
              <Button variant="outline" size="sm" icon="sync" onClick={() => setSlugField(normalizeSlug((form.name ?? store?.name ?? '')))}>توليد الرابط</Button>
              <Button variant="soft" size="sm" icon="save" onClick={save} loading={saving}>حفظ الرابط</Button>
            </div>
          </div>
        </div>

        <div className="list-row mt-2">
          <div>
            <span className="font-semibold">رابط المتجر العام</span>
            <div className="muted small" dir="ltr">{publicUrl || 'لم يتم إنشاء رابط المتجر بعد'}</div>
          </div>
          <div className="flex flex-gap-sm flex-wrap">
            <Button
              variant="outline"
              size="sm"
              icon="link"
              onClick={copyLink}
              disabled={!publicUrl}
              title={!publicUrl ? 'رابط المتجر غير متاح بعد' : undefined}
            >
              {publicUrl ? 'نسخ' : 'غير متاح'}
            </Button>
            {store && publicUrl && (
              <a href={`/store/${store.slug}`} target="_blank" rel="noreferrer">
                <Button variant="ghost" size="sm" icon="store">فتح المتجر</Button>
              </a>
            )}
            {store && !store.published && (
              <span className="muted small" style={{ alignSelf: 'center' }}>المتجر غير منشور — الرابط يُفتح كمعاينة لصاحب المتجر فقط</span>
            )}
          </div>
        </div>

        <div className="grid grid-2 mt-2">
          <Input label="عنوان SEO" value={form.seoTitle ?? store?.seoTitle ?? ''} onChange={(v) => setForm({ ...form, seoTitle: v })} hint="يُستخدم كعنوان صفحة المتجر في المتصفحات ومحركات البحث" />
          <Input label="وصف SEO" value={form.seoDescription ?? store?.seoDescription ?? ''} onChange={(v) => setForm({ ...form, seoDescription: v })} hint="وصف قصير يظهر في نتائج البحث" />
        </div>
        <div className="flex flex-end mt-2">
          <Button icon="save" onClick={save} loading={saving}>حفظ</Button>
        </div>
      </Card>

      <Card title="المظهر والقالب">
        <div className="flex-between">
          <div>
            <span className="font-semibold">الألوان، القالب والشعار</span>
            <div className="muted small">اختر قالباً لمتجرك وعدّل الألوان وأضف شعارك من صفحة المظهر</div>
          </div>
          <Link href="/dashboard/themes">
            <Button variant="soft" icon="palette">تخصيص المظهر</Button>
          </Link>
        </div>
      </Card>
    </div>
  )
}
export default MerchantSettings