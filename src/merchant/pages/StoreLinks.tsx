import { FunctionalComponent } from "preact"
import { useState } from 'preact/hooks'
import { Link } from 'wouter'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { StatsCard } from '../../shared/components/ui/StatsCard'
import { Card } from '../../shared/components/ui/Card'
import { EmptyState } from '../../shared/components/ui/EmptyState'
import { Select } from '../../shared/components/ui/Select'
import { Loading } from '../../shared/components/ui/Loading'
import { SectionHeader } from '../../shared/components/ui/SectionHeader'
import { Button } from '../../shared/components/ui/Button'
import { Drawer } from '../../shared/components/ui/Drawer'
import { Input } from '../../shared/components/ui/Input'
import { Toggle } from '../../shared/components/ui/Toggle'
import { ConfirmDialog } from '../../shared/components/ui/ConfirmDialog'
import { Icon } from '../../shared/components/ui/Icon'
import { useStore } from '../../shared/hooks/useStore'
import { useCollection } from '../../shared/hooks/useCollection'
import { useSubscription } from '../../shared/hooks/useSubscription'
import { useToast } from '../../shared/hooks/useToast'
import { storeLinksService } from '../../shared/services/system'
import { createSalesLinkCallable } from '../../shared/services/auth'
import { getPlanLimit, isPlanLimitUnlimited } from '../../shared/services/subscription'
import { formatCurrency, formatDate, timeAgo } from '../../shared/utils/format'
import { storeBaseUrl } from '../../shared/utils/store-url'
import type { LandingPage, Product, StoreLink, StoreLinkDestinationType } from '../../shared/types'
import './StoreLinks.css'

const DESTINATION_LABELS: Record<StoreLinkDestinationType, string> = {
  home: 'الرئيسية',
  catalog: 'المتجر',
  product: 'منتج محدد',
  landing: 'صفحة هبوط',
  custom: 'رابط مخصص',
}

const SOURCE_PRESETS = ['Facebook', 'Instagram', 'TikTok', 'WhatsApp']

type Draft = {
  id?: string
  name: string
  code: string
  sellerName: string
  destinationType: StoreLinkDestinationType
  destinationId: string
  source: string
  campaign: string
  content: string
  active: boolean
  archived: boolean
}

function randomCode(): string {
  return 'lk' + Math.random().toString(36).slice(2, 8)
}

export const MerchantStoreLinks: FunctionalComponent = () => {
  const { store } = useStore()
  const storeId = store?.id || ''
  const linksRes = useCollection<StoreLink>('storeLinks', { storeId, orderBy: { field: 'createdAt' } })
  const allLinks = linksRes.data
  const productsRes = useCollection<Product>('products', { storeId })
  const landingsRes = useCollection<LandingPage>('landingPages', { storeId })
  const products = productsRes.data || []
  const landings = landingsRes.data || []
  const { plan, resourceUsage } = useSubscription(storeId)
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<StoreLink | null>(null)
  const [performanceTarget, setPerformanceTarget] = useState<StoreLink | null>(null)
  const [form, setForm] = useState<Draft>({
    name: '', code: '', sellerName: '', destinationType: 'home', destinationId: '', source: '', campaign: '', content: '', active: true, archived: false,
  })

  const links = allLinks.filter((l) => !l.archived)

  const publicUrl = (code: string) => `${storeBaseUrl()}/s/${code}`

  const filtered = links.filter((l) =>
    ((l.name || '').includes(query) || (l.code || '').includes(query)) &&
    (!status || (status === 'active' ? l.active : !l.active)),
  )

  const linksLimit = resourceUsage?.salesLinks.limit ?? getPlanLimit('salesLinks', plan)
  const linksUnlimited = resourceUsage ? resourceUsage.salesLinks.limit <= 0 : isPlanLimitUnlimited('salesLinks', plan)
  const atLimit = !linksUnlimited && linksLimit > 0 && links.length >= linksLimit

  const openForm = (l?: StoreLink) => {
    if (!l && atLimit) {
      toast.push('وصلت إلى حد روابط البيع', 'رقِّ باقتك لإنشاء رابط جديد.', 'warning')
      return
    }
    if (l) {
      setForm({ id: l.id, name: l.name, code: l.code, sellerName: l.sellerName || '', destinationType: l.destinationType, destinationId: l.destinationId || '', source: l.source || '', campaign: l.campaign || '', content: l.content || '', active: l.active ?? true, archived: false })
    } else {
      setForm({ name: '', code: '', sellerName: '', destinationType: 'home', destinationId: '', source: '', campaign: '', content: '', active: true, archived: false })
    }
    setOpen(true)
  }

  const submit = async () => {
    if (saving) return
    if (!form.name) {
      toast.push('أدخل اسم الرابط', undefined, 'error')
      return
    }
    const code = (form.code || randomCode()).trim()
    if (!/^[a-z0-9-_]+$/i.test(code)) {
      toast.push('كود الرابط يجب أن يحتوي أحرفاً وأرقاماً فقط', undefined, 'error')
      return
    }
    const data: Omit<StoreLink, 'id' | 'storeId'> = {
      code,
      name: form.name.trim(),
      title: form.name.trim(),
      sellerName: form.sellerName.trim() || undefined,
      destinationType: form.destinationType,
      destinationId: form.destinationId || undefined,
      source: form.source.trim() || undefined,
      campaign: form.campaign.trim() || undefined,
      content: form.content.trim() || undefined,
      active: form.active ?? true,
      archived: false,
      visits: 0,
      ordersCount: 0,
      totalRevenue: 0,
      createdBy: '',
    }
    setSaving(true)
    try {
      if (form.id) {
        await storeLinksService.update(form.id, data)
        toast.push('تم تحديث الرابط')
      } else {
        const created = await createSalesLinkCallable({ storeId, data })
        const saved = created.data as { id?: string; code?: string; active?: boolean } | undefined
        if (!saved?.id || !saved?.code || typeof saved.active !== 'boolean') throw new Error('لم يؤكد الخادم حفظ رابط البيع')
        const savedCode = saved.code
        toast.push('تم إنشاء رابط البيع', `الرابط جاهز للمشاركة: ${publicUrl(savedCode)}`, 'success')
      }
      setOpen(false)
    } catch (err: any) {
      const message = String(err?.message || '')
      const errorCode = String(err?.code || '')
      const detail = errorCode.includes('resource-exhausted')
        ? 'وصلت إلى حد روابط البيع في باقتك الحالية.'
        : errorCode.includes('already-exists')
          ? 'الكود المختصر مستخدم بالفعل. أعد المحاولة ليتم إنشاء كود جديد.'
          : message || 'حدث خطأ غير متوقع'
      toast.push('تعذر حفظ رابط البيع', detail, 'error')
    } finally {
      setSaving(false)
    }
  }

  const copyLink = async (code: string) => {
    const url = publicUrl(code)
    try {
      await navigator.clipboard.writeText(url)
      toast.push('تم نسخ الرابط', url, 'success')
    } catch {
      toast.push('تعذر نسخ الرابط', undefined, 'error')
    }
  }

  const archive = async (l: StoreLink) => {
    await storeLinksService.update(l.id, { archived: true })
    toast.push('تم أرشفة الرابط')
  }

  const shareLink = async (l: StoreLink) => {
    const url = publicUrl(l.code)
    const text = l.title || l.name
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: text, text, url })
      } else {
        await copyLink(l.code)
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        toast.push('تعذر المشاركة', undefined, 'error')
      }
    }
  }

  const conversionRate = (l: StoreLink) => (l.visits && l.visits > 0 ? Math.round(((l.ordersCount || 0) / l.visits) * 1000) / 10 : 0)
  const averageOrderValue = (l: StoreLink) => (l.ordersCount || 0) > 0 ? (l.totalRevenue || 0) / (l.ordersCount || 1) : 0
  const toggleActive = async (l: StoreLink) => {
    try {
      await storeLinksService.update(l.id, { active: !l.active })
      toast.push(!l.active ? 'تم تفعيل الرابط' : 'تم إيقاف الرابط')
    } catch (err: any) {
      toast.push('تعذر تحديث الرابط', err?.message || 'حدث خطأ غير متوقع', 'error')
    }
  }

  if (!store) return <Loading variant="screen" message="جارٍ تحميل بيانات المتجر..." />
  if (linksRes.loading || productsRes.loading || landingsRes.loading) return <Loading variant="screen" message="جاري تحميل روابط البيع..." />
  if (linksRes.error) return <EmptyState icon="error" title="تعذر تحميل روابط البيع" description={linksRes.error.message} action={<Button variant="outline" icon="refresh" onClick={() => window.location.reload()}>إعادة المحاولة</Button>} />

  const totalClicks = links.reduce((s, l) => s + (l.visits || 0), 0)
  const totalOrders = links.reduce((s, l) => s + (l.ordersCount || 0), 0)
  const totalRevenue = links.reduce((s, l) => s + (l.totalRevenue || 0), 0)

  return (
    <div className="merchant-operations merchant-sales-links-page">
      <PageHeader
        breadcrumb="التسويق والإسناد"
        title="روابط البيع"
        subtitle="إدارة وتتبع الروابط المخصصة للحملات والمسوقين."
        actions={<Button icon="add" disabled={atLimit} title={atLimit ? 'وصلت إلى حد روابط البيع في باقتك الحالية' : undefined} onClick={() => openForm()}>إنشاء رابط جديد</Button>}
      />

      {atLimit && (
        <Card className="mb-2">
          <div className="flex-between">
            <div className="flex" style={{ gap: 10 }}>
              <Icon name="info" className="text-amber" />
              <div>
                <p className="font-semibold">{plan?.name || 'الخطة الحالية'} — وصلت للحد الأقصى للروابط النشطة ({links.length}/{linksLimit})</p>
                <p className="muted small">قم بترقية باقتك لإنشاء عدد غير محدود من روابط البيع.</p>
              </div>
            </div>
            <Link to="/dashboard/subscription"><Button variant="outline" size="sm">ترقية الخطة</Button></Link>
          </div>
        </Card>
      )}

      <div className="stat-grid">
        <StatsCard title="إجمالي الروابط" value={links.length} icon="link" tone="primary" />
        <StatsCard title="إجمالي النقرات" value={totalClicks} icon="ads_click" tone="indigo" />
        <StatsCard title="طلبات مسلّمة" value={totalOrders} icon="local_shipping" tone="green" />
        <StatsCard title="إيرادات مسلّمة" value={totalRevenue} currency icon="payments" tone="amber" />
      </div>

      <div className="storelinks-toolbar">
        <div className="storelinks-toolbar-group">
          <select value={status} onChange={(e) => setStatus((e.target as HTMLSelectElement).value)} aria-label="الحالة">
            <option value="">جميع الحالات</option>
            <option value="active">نشط</option>
            <option value="inactive">متوقف</option>
          </select>
        </div>
        <div className="storelinks-search">
          <Icon name="search" ariaHidden />
          <input type="text" placeholder="بحث في الروابط..." value={query} onInput={(e) => setQuery((e.target as HTMLInputElement).value)} aria-label="بحث في الروابط" />
        </div>
      </div>

      {filtered.length === 0 && links.length === 0 ? (
        <EmptyState
          icon="link"
          title="لا توجد روابط بيع"
          description="أنشئ روابط تتبع لتسويق منتجاتك وقياس أداء الحملات."
          action={<Button icon="add" disabled={atLimit} title={atLimit ? 'وصلت إلى حد روابط البيع في باقتك الحالية' : undefined} onClick={() => openForm()}>إنشاء رابط بيع</Button>}
        />
      ) : filtered.length === 0 ? (
        <EmptyState icon="search_off" title="لا توجد نتائج" description="لا توجد روابط تطابق البحث والفلترة الحالية." />
      ) : (
        <div className="storelinks-table">
          <div className="storelinks-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>اسم الرابط</th>
                  <th>الكود المختصر</th>
                  <th>الوجهة</th>
                  <th>تاريخ الإنشاء</th>
                  <th>آخر نشاط</th>
                  <th className="center">الزيارات</th>
                  <th className="center">الطلبات</th>
                  <th className="center">التحويل</th>
                  <th>الإيرادات</th>
                  <th className="center">الحالة</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <div className="storelinks-name">{l.name}</div>
                      {l.sellerName && <div className="storelinks-seller">{l.sellerName}</div>}
                    </td>
                    <td><span className="storelinks-code" dir="ltr">/s/{l.code}</span></td>
                    <td><span className="storelinks-dest">{DESTINATION_LABELS[l.destinationType] || l.destinationType}</span></td>
                    <td>{formatDate(l.createdAt)}</td>
                    <td>{l.lastVisitAt ? timeAgo(l.lastVisitAt) : 'لا يوجد'}</td>
                    <td className="center">{l.visits || 0}</td>
                    <td className="center">{l.ordersCount || 0}</td>
                    <td className="center">{conversionRate(l)}%</td>
                    <td><span className="storelinks-revenue">{formatCurrency(l.totalRevenue || 0)}</span></td>
                    <td className="center">
                      <span className={`storelinks-status${l.active ? ' is-active' : ''}`}>{l.active ? 'نشط' : 'متوقف'}</span>
                    </td>
                    <td>
                      <span className="storelinks-actions">
                        <Button variant="ghost" size="sm" icon="open_in_new" iconOnly onClick={() => window.open(publicUrl(l.code), '_blank', 'noopener,noreferrer')} title="فتح" />
                        <Button variant="ghost" size="sm" icon="content_copy" iconOnly onClick={() => copyLink(l.code)} title="نسخ" />
                        <Button variant="ghost" size="sm" icon="share" iconOnly onClick={() => shareLink(l)} title="مشاركة" />
                        <Button variant="ghost" size="sm" icon="monitoring" iconOnly onClick={() => setPerformanceTarget(l)} title="مشاهدة الأداء" />
                        <Button variant="ghost" size="sm" icon="edit" iconOnly onClick={() => openForm(l)} title="تعديل" />
                        <Button variant="ghost" size="sm" icon={l.active ? 'pause_circle' : 'play_circle'} iconOnly onClick={() => toggleActive(l)} title={l.active ? 'إيقاف' : 'تفعيل'} />
                        <Button variant="danger" size="sm" icon="archive" iconOnly onClick={() => archive(l)} title="أرشفة" />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Drawer open={open} onClose={() => setOpen(false)} title={form.id ? 'تعديل رابط البيع' : 'إنشاء رابط مبيعات جديد'} size="lg">
        <div className="drawer-body-stack">
          {atLimit && (
            <Card>
              <div className="flex" style={{ gap: 10 }}>
                <Icon name="info" className="text-amber" />
                <div>
                  <p className="font-semibold">حد الروابط ({plan?.name || 'الباقة الأساسية'})</p>
                  <p className="muted small">لقد استهلكت {links.length}/{linksLimit} من الروابط المتاحة في باقتك الحالية.</p>
                </div>
              </div>
            </Card>
          )}

          <SectionHeader title="المعلومات الأساسية" />
          <Card>
            <Input label="اسم الرابط (مرجع داخلي)" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required placeholder="مثال: رابط بائع أكتوبر" />
            <Input label="اسم البائع / المسوق" value={form.sellerName} onChange={(v) => setForm({ ...form, sellerName: v })} />
          </Card>

          <SectionHeader title="المصدر والتتبع (UTM)" />
          <Card>
            <span className="field-label">المصدر (Source)</span>
            <div className="storelinks-source-chips">
              {SOURCE_PRESETS.map((s) => (
                <button key={s} type="button" className={`storelinks-source-chip${form.source === s ? ' is-active' : ''}`} onClick={() => setForm({ ...form, source: s })}>{s}</button>
              ))}
              <button type="button" className={`storelinks-source-chip${form.source && !SOURCE_PRESETS.includes(form.source) ? ' is-active' : ''}`} onClick={() => setForm({ ...form, source: 'مخصص' })}>
                <Icon name="add" className="storelinks-source-add" ariaHidden /> مخصص
              </button>
            </div>
            {form.source === 'مخصص' && (
              <Input label="مصدر مخصص" value={form.source === 'مخصص' ? '' : form.source} onChange={(v) => setForm({ ...form, source: v })} placeholder="google" />
            )}
            <div className="grid grid-2">
              <Input label="اسم الحملة (Campaign)" value={form.campaign} onChange={(v) => setForm({ ...form, campaign: v })} placeholder="رمضان" />
              <Input label="المحتوى (Content)" value={form.content} onChange={(v) => setForm({ ...form, content: v })} placeholder="ad-1" />
            </div>
          </Card>

          <SectionHeader title="الوجهة" />
          <Card>
            <Select
              label="نوع الوجهة"
              value={form.destinationType}
              onChange={(v) => setForm({ ...form, destinationType: v as StoreLinkDestinationType })}
              options={(Object.keys(DESTINATION_LABELS) as StoreLinkDestinationType[]).map((k) => ({ value: k, label: DESTINATION_LABELS[k] }))}
            />
            {form.destinationType === 'product' && (
              <Select
                label="المنتج المختار"
                value={form.destinationId}
                onChange={(v) => setForm({ ...form, destinationId: v })}
                placeholder="— اختر منتجاً —"
                options={products.map((p) => ({ value: p.id, label: p.name }))}
              />
            )}
            {form.destinationType === 'landing' && (
              <Select
                label="صفحة الهبوط"
                value={form.destinationId}
                onChange={(v) => setForm({ ...form, destinationId: v })}
                placeholder="— اختر صفحة —"
                options={landings.map((l) => ({ value: l.slug, label: `${l.title} (${l.slug})` }))}
              />
            )}
            {form.destinationType === 'custom' && (
              <Input label="المسار المخصص" value={form.destinationId} onChange={(v) => setForm({ ...form, destinationId: v })} placeholder="/catalog أو /product/abc" />
            )}
          </Card>

          <SectionHeader title="الإعدادات والمعاينة" />
          <Card>
            <div className="storelinks-toggle-row">
              <div>
                <p className="font-semibold">تفعيل الرابط</p>
                <p className="muted small">تفعيل أو تعطيل الرابط مؤقتاً</p>
              </div>
              <Toggle checked={form.active} onChange={(v) => setForm({ ...form, active: v })} />
            </div>
            <div>
              <span className="field-label">معاينة الرابط المختصر</span>
              <div className="storelinks-url-preview">
                <div className="storelinks-url-text" dir="ltr">{form.code ? `/s/${form.code}` : 'سيُنشأ الكود عند الحفظ'}</div>
                <button type="button" className="storelinks-url-copy" onClick={() => form.code && copyLink(form.code)} title="نسخ الرابط" disabled={!form.code}><Icon name="content_copy" ariaHidden /></button>
              </div>
              <p className="muted small mt-1">
                <Icon name="info" className="storelinks-attribution-icon" ariaHidden />
                يتم تتبع بيانات التوجيه (Attribution) داخلياً.
              </p>
            </div>
            {form.id && (
              <div className="storelinks-form-danger">
                <button className="storelinks-danger-btn" onClick={() => { setDeleteTarget(links.find((l) => l.id === form.id) || null); setOpen(false) }}>حذف الرابط</button>
                <button className="storelinks-archive-btn" onClick={async () => { if (form.id) { await archive(links.find((l) => l.id === form.id) as StoreLink) } setOpen(false) }}>أرشفة</button>
              </div>
            )}
          </Card>

          <div className="storelinks-form-actions">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>إلغاء</Button>
            <Button icon="save" onClick={submit} loading={saving}>{form.id ? 'حفظ التغييرات' : 'حفظ وإنشاء'}</Button>
          </div>
        </div>
      </Drawer>

      <Drawer open={!!performanceTarget} onClose={() => setPerformanceTarget(null)} title={`أداء ${performanceTarget?.name || 'رابط البيع'}`} size="md">
        {performanceTarget && <div className="storelinks-performance-grid">
          <StatsCard title="الزيارات" value={performanceTarget.visits || 0} icon="visibility" tone="blue" />
          <StatsCard title="الطلبات" value={performanceTarget.ordersCount || 0} icon="shopping_bag" tone="green" />
          <StatsCard title="معدل التحويل" value={`${conversionRate(performanceTarget)}%`} icon="monitoring" tone="indigo" />
          <StatsCard title="الإيرادات" value={performanceTarget.totalRevenue || 0} currency icon="payments" tone="amber" />
          <StatsCard title="متوسط الطلب" value={averageOrderValue(performanceTarget)} currency icon="receipt_long" tone="primary" />
        </div>}
      </Drawer>

      <ConfirmDialog open={!!deleteTarget} onCancel={() => setDeleteTarget(null)} onConfirm={async () => { if (deleteTarget) { await storeLinksService.remove(deleteTarget.id); toast.push('تم حذف الرابط'); setDeleteTarget(null) } }} title="حذف رابط البيع" description={`سيتم حذف "${deleteTarget?.name}"`} confirmLabel="حذف" />
    </div>
  )
}

export default MerchantStoreLinks
