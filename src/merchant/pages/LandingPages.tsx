import { FunctionalComponent } from 'preact'
import { useState } from 'preact/hooks'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { StatsCard } from '../../shared/components/ui/StatsCard'
import { Table } from '../../shared/components/ui/Table'
import { Badge } from '../../shared/components/ui/Badge'
import { Button } from '../../shared/components/ui/Button'
import { Drawer } from '../../shared/components/ui/Drawer'
import { Input } from '../../shared/components/ui/Input'
import { Textarea } from '../../shared/components/ui/Textarea'
import { Toggle } from '../../shared/components/ui/Toggle'
import { Select } from '../../shared/components/ui/Select'
import { ConfirmDialog } from '../../shared/components/ui/ConfirmDialog'
import { Loading } from '../../shared/components/ui/Loading'
import { useStore } from '../../shared/hooks/useStore'
import { useCollection } from '../../shared/hooks/useCollection'
import { useToast } from '../../shared/hooks/useToast'
import { landingPagesService, landingSlugTaken, uniqueLandingSlug } from '../../shared/services/system'
import { createLandingPageCallable } from '../../shared/services/auth'
import { slugify, formatCurrency } from '../../shared/utils/format'
import { storeBaseUrl } from '../../shared/utils/store-url'
import { STORE_TEMPLATES } from '../../shared/utils/themes'
import { LandingImageUploader } from '../components/LandingImageUploader'
import type { LandingPage, LandingPageStatus, LandingSection, LandingSectionItem, Product } from '../../shared/types'
import { Icon } from '../../shared/components/ui/Icon'

const SECTION_TYPES: { value: LandingSection['type']; label: string }[] = [
  { value: 'features', label: 'المميزات' },
  { value: 'steps', label: 'الخطوات' },
  { value: 'testimonials', label: 'آراء العملاء' },
  { value: 'faq', label: 'أسئلة شائعة' },
  { value: 'cta', label: 'دعوة للشراء' },
]

type SectionDraft = {
  id: string
  type: LandingSection['type']
  title: string
  body: string
  image: string
  items: { title: string; body: string }[]
}

type Draft = {
  id?: string
  title: string
  slug: string
  template: string
  status: LandingPageStatus
  active: boolean
  productId: string
  heroImage: string
  heroTitle: string
  heroSubtitle: string
  ctaText: string
  seoTitle: string
  seoDescription: string
  sections: SectionDraft[]
}

let sectionSeq = 0
const newSection = (type: LandingSection['type'] = 'features'): SectionDraft => ({
  id: `sec-${++sectionSeq}`,
  type,
  title: '',
  body: '',
  image: '',
  items: [],
})

const emptyDraft = (): Draft => ({
  title: '',
  slug: '',
  template: 'modern',
  status: 'draft',
  active: true,
  productId: '',
  heroImage: '',
  heroTitle: '',
  heroSubtitle: '',
  ctaText: 'اطلب الآن',
  seoTitle: '',
  seoDescription: '',
  sections: [newSection('features')],
})

function draftFromPage(p: LandingPage): Draft {
  return {
    id: p.id,
    title: p.title || '',
    slug: p.slug || '',
    template: p.template || 'modern',
    status: p.status || 'draft',
    active: p.active ?? true,
    productId: p.productId || '',
    heroImage: p.hero?.image || '',
    heroTitle: p.hero?.title || p.title || '',
    heroSubtitle: p.hero?.subtitle || '',
    ctaText: p.hero?.ctaText || 'اطلب الآن',
    seoTitle: p.seo?.title || '',
    seoDescription: p.seo?.description || '',
    sections: (Array.isArray(p.sections) ? p.sections : []).map((s) => ({
      id: `sec-${++sectionSeq}`,
      type: s.type || 'features',
      title: s.title || '',
      body: s.body || '',
      image: s.image || '',
      items: (s.items || []).map((it) => ({ title: it.title || '', body: it.body || '' })),
    })),
  }
}

export const MerchantLandingPages: FunctionalComponent = () => {
  const { store } = useStore()
  const storeId = store?.id || ''
  const pagesRes = useCollection<LandingPage>('landingPages', { storeId })
  const productsRes = useCollection<Product>('products', { storeId })
  const pages = pagesRes.data || []
  const products = productsRes.data || []
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<LandingPage | null>(null)
  const [form, setForm] = useState<Draft>(emptyDraft())

  if (pagesRes.loading || productsRes.loading) return <Loading />

  const publicUrl = (slug: string) => `${storeBaseUrl()}/landing/${slug}`

  const openEditor = (p?: LandingPage) => {
    setForm(p ? draftFromPage(p) : emptyDraft())
    setOpen(true)
  }

  const submit = async () => {
    if (!form.title.trim()) {
      toast.push('أدخل عنوان الصفحة', undefined, 'error')
      return
    }
    const slug = (form.slug.trim() || slugify(form.title) || 'page').toLowerCase()
    const slugTaken = await landingSlugTaken(slug, form.id)
    if (slugTaken) {
      toast.push('رابط الصفحة مستخدم مسبقاً', 'اختر رابطاً آخر أو اتركه فارغاً ليُنشأ تلقائياً', 'error')
      return
    }
    const payload: Omit<LandingPage, 'id' | 'storeId'> = {
      slug,
      title: form.title.trim(),
      template: form.template,
      status: form.status,
      active: form.active ?? true,
      productId: form.productId || undefined,
      hero: {
        title: form.heroTitle.trim() || form.title.trim(),
        subtitle: form.heroSubtitle.trim() || undefined,
        image: form.heroImage.trim() || undefined,
        ctaText: form.ctaText.trim() || 'اطلب الآن',
      },
      seo:
        form.seoTitle.trim() || form.seoDescription.trim()
          ? { title: form.seoTitle.trim() || undefined, description: form.seoDescription.trim() || undefined }
          : undefined,
      sections: form.sections
        .filter((s) => s.title.trim() || s.body.trim() || s.image.trim() || s.items.some((it) => it.title.trim() || it.body.trim()))
        .map(
          (s): LandingSection => ({
            type: s.type,
            title: s.title.trim() || undefined,
            body: s.body.trim() || undefined,
            image: s.image.trim() || undefined,
            items: s.items
              .filter((it) => it.title.trim() || it.body.trim())
              .map(
                (it): LandingSectionItem => ({
                  title: it.title.trim() || undefined,
                  body: it.body.trim() || undefined,
                }),
              ),
          }),
        ),
      views: form.id ? undefined : 0,
      ordersCount: form.id ? undefined : 0,
      totalRevenue: form.id ? undefined : 0,
    }
    try {
      if (form.id) {
        await landingPagesService.update(form.id, payload)
        toast.push('تم تحديث الصفحة')
      } else {
        await createLandingPageCallable({ storeId, data: payload })
        toast.push('تم إنشاء صفحة الهبوط')
      }
      setOpen(false)
      setForm(emptyDraft())
    } catch (err: any) {
      toast.push('فشل حفظ الصفحة', err?.message || 'حدث خطأ غير متوقع', 'error')
    }
  }

  const duplicate = async (p: LandingPage) => {
    const payload = draftFromPage(p)
    payload.slug = await uniqueLandingSlug(`${p.slug || slugify(p.title) || 'page'}-copy`, p.id)
    payload.title = `${p.title} (نسخة)`
    payload.status = 'draft'
    try {
      await createLandingPageCallable({
        storeId,
        data: {
          slug: payload.slug,
          title: payload.title,
          template: payload.template,
          status: 'draft',
          active: true,
          productId: payload.productId || undefined,
          hero: {
            title: payload.heroTitle || payload.title,
            subtitle: payload.heroSubtitle || undefined,
            image: payload.heroImage || undefined,
            ctaText: payload.ctaText || 'اطلب الآن',
          },
          seo: payload.seoTitle || payload.seoDescription
            ? { title: payload.seoTitle || undefined, description: payload.seoDescription || undefined }
            : undefined,
          sections: (p.sections || []).map((s) => ({
            type: s.type || 'features',
            title: s.title || undefined,
            body: s.body || undefined,
            image: s.image || undefined,
            items: (s.items || []).map((it) => ({ title: it.title || undefined, body: it.body || undefined })),
          })),
        },
      })
      toast.push('تم إنشاء نسخة من الصفحة')
    } catch (err: any) {
      toast.push('فشل نسخ الصفحة', err?.message || 'حدث خطأ غير متوقع', 'error')
    }
  }

  const setStatus = async (p: LandingPage, status: LandingPageStatus) => {
    try {
      await landingPagesService.update(p.id, { status })
      toast.push(status === 'published' ? 'تم نشر الصفحة' : 'تم تحويل الصفحة إلى مسودة')
    } catch (err: any) {
      toast.push('فشل تحديث الحالة', err?.message || 'حدث خطأ غير متوقع', 'error')
    }
  }

  const copyLink = async (p: LandingPage) => {
    const url = publicUrl(p.slug)
    try {
      await navigator.clipboard.writeText(url)
      toast.push('تم نسخ الرابط', url, 'success')
    } catch {
      toast.push('تعذر نسخ الرابط', undefined, 'error')
    }
  }

  const remove = async () => {
    if (!deleteTarget) return
    try {
      await landingPagesService.remove(deleteTarget.id)
      toast.push('تم حذف الصفحة')
    } catch (err: any) {
      toast.push('تعذر حذف الصفحة', err?.message || 'حدث خطأ غير متوقع', 'error')
    }
    setDeleteTarget(null)
  }

  const totalPublished = pages.filter((p) => p.status === 'published' && p.active).length
  const totalViews = pages.reduce((s, p) => s + (p.views || 0), 0)
  const totalRevenue = pages.reduce((s, p) => s + (p.totalRevenue || 0), 0)

  const productName = (id?: string | null) => products.find((p) => p.id === id)?.name || 'بدون منتج'
  const templateName = (id?: string) => STORE_TEMPLATES.find((t) => t.id === id)?.name || 'مودرن'

  return (
    <div className="merchant-operations merchant-landing-pages-page">
      <PageHeader title="صفحات الهبوط" subtitle={`${pages.length} صفحة`} actions={<Button icon="add" onClick={() => openEditor()}>صفحة جديدة</Button>} />

      <div className="stats-grid">
        <StatsCard title="إجمالي الصفحات" value={pages.length} icon="web" tone="primary" />
        <StatsCard title="منشورة" value={totalPublished} icon="rocket_launch" tone="green" />
        <StatsCard title="إجمالي الزيارات" value={totalViews} icon="visibility" tone="blue" />
        <StatsCard title="إيرادات مسلّمة" value={formatCurrency(totalRevenue)} currency icon="payments" tone="indigo" />
      </div>

      <Card>
        <Table cardMode
          columns={[
            { key: 'title', header: 'العنوان' },
            { key: 'slug', header: 'الرابط', render: (p: LandingPage) => <button className="link-chip" onClick={() => copyLink(p)} title="نسخ الرابط"><span className="monospace small">{p.slug}</span> <Icon name="content_copy" /></button> },
            { key: 'template', header: 'القالب', render: (p: LandingPage) => templateName(p.template) },
            { key: 'productId', header: 'المنتج', render: (p: LandingPage) => productName(p.productId) },
            { key: 'status', header: 'الحالة', render: (p: LandingPage) => <Badge tone={p.status === 'published' && p.active ? 'green' : 'slate'}>{p.status === 'published' && p.active ? 'منشورة' : 'مسودة'}</Badge> },
            { key: 'views', header: 'الزيارات', render: (p: LandingPage) => <Badge tone="blue">{p.views || 0}</Badge> },
            { key: 'ordersCount', header: 'طلبات مسلّمة', render: (p: LandingPage) => <Badge tone="green">{p.ordersCount || 0}</Badge> },
            { key: 'totalRevenue', header: 'الإيرادات', render: (p: LandingPage) => formatCurrency(p.totalRevenue || 0) },
            { key: 'actions', header: '', render: (p: LandingPage) => (
              <div className="flex gap-1">
                <button className="icon-btn" onClick={() => window.open(publicUrl(p.slug), '_blank')} title="معاينة"><Icon name="open_in_new" /></button>
                <button className="icon-btn" onClick={() => openEditor(p)} title="تعديل"><Icon name="edit" /></button>
                <button className="icon-btn" onClick={() => setStatus(p, p.status === 'published' ? 'draft' : 'published')} title={p.status === 'published' ? 'إلغاء النشر' : 'نشر'}><Icon name={p.status === 'published' ? 'block' : 'rocket_launch'} /></button>
                <button className="icon-btn" onClick={() => duplicate(p)} title="نسخ"><Icon name="content_copy" /></button>
                <button className="icon-btn icon-btn-danger" onClick={() => setDeleteTarget(p)}><Icon name="delete" /></button>
              </div>
            ) },
          ]}
          rows={pages}
        />
      </Card>

      <Drawer open={open} onClose={() => setOpen(false)} title={form.id ? 'تعديل صفحة هبوط' : 'صفحة هبوط جديدة'} size="lg">
        <div className="grid grid-2">
          <Input label="عنوان الصفحة" value={form.title} onChange={(v) => setForm({ ...form, title: v })} required placeholder="مثال: عرض خاص على الشاي" />
          <Input label="الرابط (slug)" value={form.slug} onChange={(v) => setForm({ ...form, slug: v })} hint="فارغ = يُنشأ تلقائياً من العنوان" />
        </div>
        <div className="grid grid-2">
          <Select label="القالب" value={form.template} onChange={(v) => setForm({ ...form, template: v })} options={STORE_TEMPLATES.map((t) => ({ value: t.id, label: t.name }))} />
          <Select
            label="منتج الشراء السريع"
            value={form.productId}
            onChange={(v) => setForm({ ...form, productId: v })}
            options={products.map((p) => ({ value: p.id, label: p.name }))}
            placeholder="اختر منتجاً لشريحة الشراء"
          />
        </div>

        <div className="section-heading mt-2 mb-1">القسم الرئيسي (Hero)</div>
        <Input label="العنوان الرئيسي" value={form.heroTitle} onChange={(v) => setForm({ ...form, heroTitle: v })} />
        <Textarea label="الوصف المختصر" value={form.heroSubtitle} onChange={(v) => setForm({ ...form, heroSubtitle: v })} rows={2} />
        <div className="grid grid-2">
          <div className="field">
            <span className="field-label">صورة القسم الرئيسي</span>
            <LandingImageUploader storeId={storeId} value={form.heroImage} onChange={(v) => setForm({ ...form, heroImage: v })} label="إضافة صورة رئيسية" />
            <Input label="أو ألصق رابط صورة مباشر" value={form.heroImage} onChange={(v) => setForm({ ...form, heroImage: v })} />
          </div>
          <Input label="نص الزر" value={form.ctaText} onChange={(v) => setForm({ ...form, ctaText: v })} />
        </div>

        <div className="section-heading mt-2 mb-1">تحسين محركات البحث (SEO)</div>
        <div className="grid grid-2">
          <Input label="عنوان SEO" value={form.seoTitle} onChange={(v) => setForm({ ...form, seoTitle: v })} />
          <Input label="وصف SEO" value={form.seoDescription} onChange={(v) => setForm({ ...form, seoDescription: v })} />
        </div>

        <div className="section-heading mt-2 mb-1">الأقسام</div>
        {form.sections.map((s, si) => (
          <div key={s.id} className="lp-editor-section">
            <div className="flex mb-1">
              <Select
                label="النوع"
                value={s.type}
                onChange={(v) => setForm({ ...form, sections: form.sections.map((x, xi) => (xi === si ? { ...x, type: v as LandingSection['type'] } : x)) })}
                options={SECTION_TYPES}
              />
              <button className="icon-btn icon-btn-danger" onClick={() => setForm({ ...form, sections: form.sections.filter((_, xi) => xi !== si) })} title="حذف القسم"><Icon name="delete" /></button>
            </div>
            <Input label="العنوان" value={s.title} onChange={(v) => setForm({ ...form, sections: form.sections.map((x, xi) => (xi === si ? { ...x, title: v } : x)) })} />
            <Textarea label="الوصف" value={s.body} onChange={(v) => setForm({ ...form, sections: form.sections.map((x, xi) => (xi === si ? { ...x, body: v } : x)) })} rows={2} />
            <div className="field">
              <span className="field-label">صورة مرفقة (اختياري)</span>
              <LandingImageUploader storeId={storeId} value={s.image} onChange={(v) => setForm({ ...form, sections: form.sections.map((x, xi) => (xi === si ? { ...x, image: v } : x)) })} label="إضافة صورة" />
            </div>
            <div className="lp-editor-items">
              <span className="field-label">العناصر (اختياري)</span>
              {s.items.map((it, ii) => (
                <div className="grid grid-2 lp-editor-item" key={ii}>
                  <Input label="العنوان" value={it.title} onChange={(v) => setForm({ ...form, sections: form.sections.map((x, xi) => (xi === si ? { ...x, items: x.items.map((y, yi) => (yi === ii ? { ...y, title: v } : y)) } : x)) })} />
                  <Input label="النص" value={it.body} onChange={(v) => setForm({ ...form, sections: form.sections.map((x, xi) => (xi === si ? { ...x, items: x.items.map((y, yi) => (yi === ii ? { ...y, body: v } : y)) } : x)) })} />
                </div>
              ))}
              <Button variant="outline" size="sm" icon="add" onClick={() => setForm({ ...form, sections: form.sections.map((x, xi) => (xi === si ? { ...x, items: [...x.items, { title: '', body: '' }] } : x)) })}>إضافة عنصر</Button>
            </div>
          </div>
        ))}
        <Button variant="outline" icon="add" onClick={() => setForm({ ...form, sections: [...form.sections, newSection()] })}>إضافة قسم</Button>

        <div className="flex mt-2 mb-1">
          <Toggle checked={form.status === 'published'} onChange={(v) => setForm({ ...form, status: v ? 'published' : 'draft' })} label="منشورة" />
          <Toggle checked={form.active ?? true} onChange={(v) => setForm({ ...form, active: v })} label="نشطة" />
        </div>

        <div className="flex flex-end mt-1">
          <Button variant="ghost" onClick={() => setOpen(false)}>إلغاء</Button>
          <Button onClick={submit}>حفظ</Button>
        </div>
      </Drawer>

      <ConfirmDialog open={!!deleteTarget} onCancel={() => setDeleteTarget(null)} onConfirm={remove} title="حذف الصفحة" description={`سيتم حذف "${deleteTarget?.title}"`} confirmLabel="حذف" />
    </div>
  )
}
export default MerchantLandingPages
