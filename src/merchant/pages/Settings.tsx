import { FunctionalComponent } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Button } from '../../shared/components/ui/Button'
import { Toggle } from '../../shared/components/ui/Toggle'
import { useStore } from '../../shared/hooks/useStore'
import { useToast } from '../../shared/hooks/useToast'
import { storesService } from '../../shared/services/stores'
import { getStoreWhatsAppAutomationCallable, getStoreWhatsAppDeliveryLogCallable, saveStoreWhatsAppAutomationCallable, saveStoreWhatsAppMetaConnectionCallable, setStorePublishedCallable, testStoreWhatsAppMetaConnectionCallable } from '../../shared/services/auth'
import { storePublicUrl, normalizeSlug, ensureUniqueSlug, storeBaseUrl } from '../../shared/utils/store-url'
import { slugify } from '../../shared/utils/format'
import type { Store } from '../../shared/types'
import { Icon } from '../../shared/components/ui/Icon'
import { Loading } from '../../shared/components/ui/Loading'
import { useAuth } from '../../shared/hooks/useAuth'
import { usersService } from '../../shared/services/users'
import { useSubscription } from '../../shared/hooks/useSubscription'
import { canUseFeature } from '../../shared/services/subscription'
import './Settings.css'

const CURRENCIES = [
  { value: 'SAR', label: 'ريال سعودي (SAR)' },
  { value: 'AED', label: 'درهم إماراتي (AED)' },
  { value: 'EGP', label: 'جنيه مصري (EGP)' },
  { value: 'USD', label: 'دولار أمريكي (USD)' },
]

type WhatsAppEvent = 'order.created' | 'shipment.created' | 'shipment.delivered' | 'shipment.returned'
const MERCHANT_WELCOME_DISMISS_KEY = 'matjari:merchant-welcome:hidden:v3'
const DEFAULT_WHATSAPP_EVENTS: WhatsAppEvent[] = ['order.created', 'shipment.created', 'shipment.delivered', 'shipment.returned']
const WHATSAPP_EVENT_LABELS: Record<WhatsAppEvent, string> = { 'order.created': 'تأكيد الطلب', 'shipment.created': 'إرسال الشحنة والتتبع', 'shipment.delivered': 'تأكيد التسليم', 'shipment.returned': 'إشعار المرتجع' }
const DEFAULT_WHATSAPP_TEMPLATES: Record<WhatsAppEvent, string> = {
  'order.created': 'أهلاً {{customer_name}} 👋\nتم استلام طلبك رقم {{order_number}} بنجاح. هنبدأ نجهزه فوراً.',
  'shipment.created': 'طلبك رقم {{order_number}} خرج للشحن 🚚\nرقم التتبع: {{tracking_number}}\nتقدر تتابعه من: {{tracking_url}}',
  'shipment.delivered': 'طلبك رقم {{order_number}} تم تسليمه ✅\nنتمنى تجربتك تكون ممتازة يا {{customer_name}}.',
  'shipment.returned': 'تم استلام مرتجع الطلب رقم {{order_number}}. شكرًا لتعاملك معانا يا {{customer_name}}.',
}
const DEFAULT_META_WHATSAPP_TEMPLATES: Record<WhatsAppEvent, { name: string; language: string }> = {
  'order.created': { name: '', language: 'ar' },
  'shipment.created': { name: '', language: 'ar' },
  'shipment.delivered': { name: '', language: 'ar' },
  'shipment.returned': { name: '', language: 'ar' },
}
const META_TEMPLATE_VARIABLES: Record<WhatsAppEvent, string> = {
  'order.created': '{{1}} اسم العميل، {{2}} رقم الطلب',
  'shipment.created': '{{1}} رقم الطلب، {{2}} رقم التتبع، {{3}} رابط التتبع',
  'shipment.delivered': '{{1}} اسم العميل، {{2}} رقم الطلب',
  'shipment.returned': '{{1}} اسم العميل، {{2}} رقم الطلب',
}

export const MerchantSettings: FunctionalComponent = () => {
  const { store } = useStore()
  const { user } = useAuth()
  const toast = useToast()
  const [form, setForm] = useState<Partial<Store>>({})
  const [slugField, setSlugField] = useState('')
  const [saving, setSaving] = useState(false)
  const [whatsAppSaving, setWhatsAppSaving] = useState(false)
  const [metaSaving, setMetaSaving] = useState(false)
  const [whatsAppAutomation, setWhatsAppAutomation] = useState<{ senderNumber: string; events: WhatsAppEvent[]; templates: Record<WhatsAppEvent, string>; metaTemplates: Record<WhatsAppEvent, { name: string; language: string }>; status?: string; metaPhoneNumberIdMasked?: string }>({ senderNumber: '', events: DEFAULT_WHATSAPP_EVENTS, templates: DEFAULT_WHATSAPP_TEMPLATES, metaTemplates: DEFAULT_META_WHATSAPP_TEMPLATES })
  const [metaConnectionDraft, setMetaConnectionDraft] = useState({ phoneNumberId: '', accessToken: '' })
  const [whatsAppDeliveries, setWhatsAppDeliveries] = useState<Array<{ id: string; eventType: string; orderNumber: string; recipientPhoneMasked: string; deliveryStatus: string; reason?: string | null }>>([])
  const [selectedWhatsAppEvent, setSelectedWhatsAppEvent] = useState<WhatsAppEvent>('order.created')
  const subscription = useSubscription(store?.id || '')
  const whatsAppAutomationAllowed = canUseFeature('whatsappAutomation', subscription.plan)
  // Merchant automation stays intentionally unavailable until a real provider
  // connection is delivered. Never present a saved number as a live channel.
  const merchantWhatsAppAutomationAvailable = false

  useEffect(() => {
    if (!store) return
    setSlugField(store.slug || '')
  }, [store?.id, store?.slug])

  useEffect(() => {
    if (!store?.id || !whatsAppAutomationAllowed) return
    void getStoreWhatsAppAutomationCallable({ storeId: store.id }).then((result: any) => {
      const data = result.data || {}
      const metaTemplates = Object.fromEntries(DEFAULT_WHATSAPP_EVENTS.map((event) => [event, { ...DEFAULT_META_WHATSAPP_TEMPLATES[event], ...(data.metaTemplates?.[event] || {}) }])) as Record<WhatsAppEvent, { name: string; language: string }>
      setWhatsAppAutomation({ senderNumber: String(data.senderNumber || ''), events: Array.isArray(data.events) ? data.events as WhatsAppEvent[] : DEFAULT_WHATSAPP_EVENTS, templates: { ...DEFAULT_WHATSAPP_TEMPLATES, ...(data.templates || {}) }, metaTemplates, status: String(data.status || ''), metaPhoneNumberIdMasked: String(data.metaPhoneNumberIdMasked || '') })
    }).catch(() => setWhatsAppAutomation({ senderNumber: '', events: DEFAULT_WHATSAPP_EVENTS, templates: DEFAULT_WHATSAPP_TEMPLATES, metaTemplates: DEFAULT_META_WHATSAPP_TEMPLATES }))
  }, [store?.id, whatsAppAutomationAllowed])

  useEffect(() => {
    if (!store?.id || !whatsAppAutomationAllowed) return
    void getStoreWhatsAppDeliveryLogCallable({ storeId: store.id })
      .then((result: any) => setWhatsAppDeliveries(Array.isArray(result.data?.deliveries) ? result.data.deliveries : []))
      .catch(() => setWhatsAppDeliveries([]))
  }, [store?.id, whatsAppAutomationAllowed])

  const save = async () => {
    if (!store) return
    setSaving(true)
    try {
      const name = (form.name ?? store.name ?? '').trim()
      const candidate = slugField.trim() || slugify(name) || store.slug || 'store'
      // Avoid a tenant-incompatible collection query when the slug is
      // unchanged. Saving ordinary settings (description, phone, etc.) does
      // not need to re-check uniqueness; the current slug is already owned by
      // this store and the direct store update is authorization-scoped.
      const slug = candidate === store.slug
        ? store.slug
        : await ensureUniqueSlug(candidate, store.id)
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

  const showStartGuide = () => {
    localStorage.removeItem(MERCHANT_WELCOME_DISMISS_KEY)
    window.location.reload()
  }

  const copyLink = async () => {
    if (!store) return
    const url = store.published ? storePublicUrl(store) : `${storePublicUrl(store)}?preview=1`
    if (!url) {
      toast.push('رابط المتجر غير متاح بعد', 'حدد رابطاً صالحاً للمتجر أولاً', 'error')
      return
    }
    try {
      await navigator.clipboard.writeText(url)
      toast.push(store.published ? 'تم نسخ رابط المتجر' : 'تم نسخ رابط المعاينة', url, 'success')
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

  const saveWhatsAppAutomation = async () => {
    if (!store) return
    setWhatsAppSaving(true)
    try {
      await saveStoreWhatsAppAutomationCallable({ storeId: store.id, senderNumber: whatsAppAutomation.senderNumber, events: whatsAppAutomation.events, templates: whatsAppAutomation.templates, metaTemplates: whatsAppAutomation.metaTemplates })
      toast.push('تم حفظ إعدادات وقوالب واتساب لمتجرك')
    } catch (err: any) {
      toast.push('تعذر حفظ تجهيز واتساب', err?.message || 'حاول مرة أخرى', 'error')
    } finally { setWhatsAppSaving(false) }
  }

  const saveMetaConnection = async () => {
    if (!store) return
    setMetaSaving(true)
    try {
      const result: any = await saveStoreWhatsAppMetaConnectionCallable({ storeId: store.id, phoneNumberId: metaConnectionDraft.phoneNumberId, accessToken: metaConnectionDraft.accessToken })
      setMetaConnectionDraft({ phoneNumberId: '', accessToken: '' })
      setWhatsAppAutomation({ ...whatsAppAutomation, metaPhoneNumberIdMasked: String(result.data?.phoneNumberIdMasked || ''), status: 'AWAITING_META_CONNECTION' })
      toast.push('تم حفظ بيانات Meta بشكل مشفّر', 'اضغط اختبار الاتصال للتحقق من الرقم فعليًا.', 'success')
    } catch (err: any) { toast.push('تعذر حفظ بيانات Meta', err?.message || 'تحقق من البيانات', 'error') }
    finally { setMetaSaving(false) }
  }

  const testMetaConnection = async () => {
    if (!store) return
    setMetaSaving(true)
    try {
      const result: any = await testStoreWhatsAppMetaConnectionCallable({ storeId: store.id })
      setWhatsAppAutomation({ ...whatsAppAutomation, status: 'CONNECTED' })
      toast.push('تم اتصال Meta بنجاح', result.data?.verifiedName || result.data?.displayPhoneNumber || undefined, 'success')
    } catch (err: any) { toast.push('فشل اختبار اتصال Meta', err?.message || 'تحقق من Phone Number ID والتوكن', 'error') }
    finally { setMetaSaving(false) }
  }

  const toggleWhatsAppEvent = (event: WhatsAppEvent, enabled: boolean) => {
    const events = new Set(whatsAppAutomation.events)
    if (enabled) events.add(event); else events.delete(event)
    setWhatsAppAutomation({ ...whatsAppAutomation, events: [...events] as WhatsAppEvent[] })
  }

  const updateWhatsAppTemplate = (value: string) => setWhatsAppAutomation({ ...whatsAppAutomation, templates: { ...whatsAppAutomation.templates, [selectedWhatsAppEvent]: value.slice(0, 1200) } })
  const updateMetaTemplate = (field: 'name' | 'language', value: string) => setWhatsAppAutomation({ ...whatsAppAutomation, metaTemplates: { ...whatsAppAutomation.metaTemplates, [selectedWhatsAppEvent]: { ...whatsAppAutomation.metaTemplates[selectedWhatsAppEvent], [field]: field === 'name' ? value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 512) : value.slice(0, 12) } } })
  const previewWhatsAppMessage = (whatsAppAutomation.templates[selectedWhatsAppEvent] || '').replace(/\{\{customer_name\}\}/g, 'أحمد').replace(/\{\{order_number\}\}/g, 'ORD-001024').replace(/\{\{tracking_number\}\}/g, 'TRK-1024').replace(/\{\{tracking_url\}\}/g, 'mtjari.shop/track/TRK-1024')
  const enabledEventsHaveMetaTemplates = whatsAppAutomation.events.every((event) => Boolean(whatsAppAutomation.metaTemplates[event]?.name))
  const whatsAppConnection = whatsAppAutomation.status === 'CONNECTED' && enabledEventsHaveMetaTemplates
    ? { label: 'متصل — جاهز لمحاولة الإرسال بالقوالب', detail: 'تم التحقق من Meta وتحديد قالب لكل حدث مفعل؛ يسجل النظام قبول Meta أو سبب الرفض لكل رسالة.', tone: 'is-connected' }
    : whatsAppAutomation.status === 'CONNECTED'
      ? { label: 'متصل — أضف أسماء قوالب Meta', detail: 'الاتصال صحيح، لكن لن يتم إرسال شيء قبل تحديد القالب المعتمد لكل حدث مفعل.', tone: 'is-pending' }
    : whatsAppAutomation.senderNumber
      ? { label: 'الرقم محفوظ — غير متصل بعد', detail: 'إضافة الرقم وحدها لا تربط واتساب ولا تُرسل رسائل. يلزم ربط WhatsApp Business وMeta.', tone: 'is-pending' }
      : { label: 'غير متصل', detail: 'أضف الرقم التجاري للتحضير، ثم يتم ربط WhatsApp Business وMeta قبل تشغيل الإرسال.', tone: 'is-pending' }

  const publicUrl = store ? storePublicUrl(store) : null
  const published = !!store?.published
  const storefrontPath = store ? `/store/${store.slug}${published ? '' : '?preview=1'}` : ''
  const domain = storeBaseUrl().replace(/^https?:\/\//, '')

  if (!store) return <Loading message="جارٍ تحميل إعدادات المتجر..." />

  return (
    <div className="merchant-operations merchant-settings-page">
      <PageHeader
        title="الإعدادات العامة والنشر"
        subtitle="إدارة معلومات المتجر الأساسية، الروابط، وحالة النشر"
        actions={
          <div className="settings-header-actions">
            {user?.role === 'merchant' && <Button variant="outline" icon="menu_book" onClick={showStartGuide}>إظهار دليل البداية</Button>}
            {user?.role === 'merchant' && <Button variant="outline" icon="help" onClick={async () => { await usersService.update(user.uid, { onboardingTourCompleted: false, onboardingTourSkipped: false, onboardingTourVersion: 0 }); window.location.reload() }}>إعادة الجولة التعريفية</Button>}
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

          <section className="settings-card">
            <div className="settings-card-head">
              <h3><Icon name="chat" ariaHidden /> أتمتة واتساب للمتجر</h3>
            </div>
            <div className="settings-card-body">
              {merchantWhatsAppAutomationAvailable && whatsAppAutomationAllowed ? <>
                <div className={`whatsapp-connection-state ${whatsAppConnection.tone}`}>
                  <strong>حالة اتصال واتساب: {whatsAppConnection.label}</strong>
                  <span>{whatsAppConnection.detail}</span>
                </div>
                <p className="settings-field-hint">هنا تُجهّز الرسائل والأحداث فقط. لا يتم إرسال أي رسالة للعميل قبل اكتمال الربط الفعلي مع WhatsApp Business وMeta.</p>
                <div className="field">
                  <label className="field-label">رقم واتساب التجاري للتحضير</label>
                  <input className="input" value={whatsAppAutomation.senderNumber} placeholder="2010XXXXXXXX" onChange={(e) => setWhatsAppAutomation({ ...whatsAppAutomation, senderNumber: (e.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 15) })} />
                  <p className="settings-field-hint">حفظ الرقم لا يعني اتصالًا، ولا يظهر هذا الرقم أو أي متغير للعميل.</p>
                </div>
                <div className="whatsapp-meta-connection">
                  <strong>ربط WhatsApp Business عبر Meta</strong>
                  <p>هذه بيانات الربط الفنية من لوحة Meta. تحفظ مشفّرة ولا تظهر مرة أخرى بعد الحفظ.</p>
                  <div className="settings-grid">
                    <div className="field"><label className="field-label">Phone Number ID</label><input className="input" inputMode="numeric" value={metaConnectionDraft.phoneNumberId} placeholder={whatsAppAutomation.metaPhoneNumberIdMasked || 'مثال: 123456789012345'} onChange={(e) => setMetaConnectionDraft({ ...metaConnectionDraft, phoneNumberId: (e.target as HTMLInputElement).value.replace(/\D/g, '') })} /></div>
                    <div className="field"><label className="field-label">Access Token من Meta</label><input className="input" type="password" value={metaConnectionDraft.accessToken} placeholder="الصقه هنا مرة واحدة" onChange={(e) => setMetaConnectionDraft({ ...metaConnectionDraft, accessToken: (e.target as HTMLInputElement).value })} /></div>
                  </div>
                  <div className="flex flex-wrap" style={{ gap: 8 }}><Button size="sm" variant="outline" loading={metaSaving} onClick={saveMetaConnection}>حفظ بيانات Meta بأمان</Button><Button size="sm" loading={metaSaving} disabled={!whatsAppAutomation.metaPhoneNumberIdMasked} onClick={testMetaConnection}>اختبار الاتصال الفعلي</Button></div>
                  <small>لن يتم إرسال أي رسالة تجارية قبل اعتماد قوالب واتساب من Meta؛ الاختبار هنا يتحقق من أن الرقم والتوكن صحيحان فقط.</small>
                </div>
                <div className="settings-flags">
                  <Toggle checked={whatsAppAutomation.events.includes('order.created')} onChange={(v) => toggleWhatsAppEvent('order.created', v)} label="تأكيد الطلب" />
                  <Toggle checked={whatsAppAutomation.events.includes('shipment.created')} onChange={(v) => toggleWhatsAppEvent('shipment.created', v)} label="إرسال الشحنة والتتبع" />
                  <Toggle checked={whatsAppAutomation.events.includes('shipment.delivered')} onChange={(v) => toggleWhatsAppEvent('shipment.delivered', v)} label="تأكيد التسليم" />
                  <Toggle checked={whatsAppAutomation.events.includes('shipment.returned')} onChange={(v) => toggleWhatsAppEvent('shipment.returned', v)} label="إشعار المرتجع" />
                </div>
                <div className="whatsapp-template-editor">
                  <div className="whatsapp-template-tabs" role="tablist" aria-label="رسائل واتساب">
                    {DEFAULT_WHATSAPP_EVENTS.map((event) => <button type="button" className={selectedWhatsAppEvent === event ? 'is-active' : ''} onClick={() => setSelectedWhatsAppEvent(event)}>{WHATSAPP_EVENT_LABELS[event]}</button>)}
                  </div>
                  <div className="settings-grid whatsapp-template-grid">
                    <div className="field">
                      <label className="field-label">رسالة {WHATSAPP_EVENT_LABELS[selectedWhatsAppEvent]}</label>
                      <textarea className="input settings-textarea whatsapp-template-textarea" rows={7} value={whatsAppAutomation.templates[selectedWhatsAppEvent]} onChange={(e) => updateWhatsAppTemplate((e.target as HTMLTextAreaElement).value)} />
                      <p className="settings-field-hint">هذه رموز للتاجر داخل المحرر فقط: {'{{customer_name}}'}، {'{{order_number}}'}، {'{{tracking_number}}'}، {'{{tracking_url}}'}. تُستبدل ببيانات فعلية قبل الإرسال ولا تظهر للعميل نهائيًا.</p>
                      <div className="settings-grid" style={{ marginTop: 12 }}>
                        <div className="field">
                          <label className="field-label">اسم قالب Meta المعتمد</label>
                          <input className="input" dir="ltr" value={whatsAppAutomation.metaTemplates[selectedWhatsAppEvent].name} placeholder="مثال: order_confirmation" onChange={(e) => updateMetaTemplate('name', (e.target as HTMLInputElement).value)} />
                        </div>
                        <div className="field">
                          <label className="field-label">لغة القالب في Meta</label>
                          <input className="input" dir="ltr" value={whatsAppAutomation.metaTemplates[selectedWhatsAppEvent].language} placeholder="ar أو ar_EG" onChange={(e) => updateMetaTemplate('language', (e.target as HTMLInputElement).value)} />
                        </div>
                      </div>
                      <p className="settings-field-hint">أنشئ واعتمد القالب بالاسم نفسه داخل Meta. متغيرات جسم القالب المطلوبة لهذا الحدث: {META_TEMPLATE_VARIABLES[selectedWhatsAppEvent]}.</p>
                    </div>
                    <div className="whatsapp-preview" aria-live="polite">
                      <span>معاينة التاجر (بعد استبدال الرموز)</span>
                      <div className="whatsapp-preview-bubble">{previewWhatsAppMessage}</div>
                    </div>
                  </div>
                </div>
                <Button size="sm" icon="save" loading={whatsAppSaving} onClick={saveWhatsAppAutomation}>حفظ الرسائل والإعدادات</Button>
                <div className="whatsapp-delivery-log">
                  <strong>سجل تشغيل الرسائل</strong>
                  <p>يعرض ما حدث فعلاً؛ لا يعني حفظ القالب أو الرقم أن رسالة وصلت للعميل.</p>
                  {whatsAppDeliveries.length ? <div className="whatsapp-delivery-log-list">
                    {whatsAppDeliveries.map((delivery) => <div className="whatsapp-delivery-log-row" key={delivery.id}>
                      <span>{WHATSAPP_EVENT_LABELS[delivery.eventType as WhatsAppEvent] || 'حدث واتساب'} · {delivery.orderNumber || 'طلب'}</span>
                      <b className={delivery.deliveryStatus === 'SENT' ? 'is-sent' : 'is-not-sent'}>{delivery.deliveryStatus === 'SENT' ? 'تم الإرسال' : 'لم تُرسل'}</b>
                      {delivery.reason && <small>{delivery.reason}</small>}
                    </div>)}
                  </div> : <div className="whatsapp-delivery-log-empty">لا توجد محاولات بعد. سيظهر هنا سجل الرسائل عند وقوع أحداث جديدة في الطلبات أو الشحنات.</div>}
                </div>
              </> : <div className="whatsapp-coming-soon" role="status">
                <div className="whatsapp-coming-soon-icon"><Icon name="schedule" ariaHidden /></div>
                <div>
                  <strong>أتمتة واتساب للتاجر قريبًا</strong>
                  <p>نجهّز ربطًا فعليًا وآمنًا قبل إتاحته للتجار. لن يظهر رقم أو حالة اتصال أو رسائل تلقائية قبل اكتمال الخدمة.</p>
                  <small>ستتضمن النسخة القادمة حالة الاتصال، قوالب الرسائل، وسجل الإرسال الفعلي.</small>
                </div>
              </div>}
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
                <span>رابط المتجر</span>
                <span className="settings-plan-badge">رابط عام</span>
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
                <Button variant="outline" icon="content_copy" onClick={copyLink} disabled={!store?.slug}>نسخ الرابط</Button>
                <Button icon="save_as" onClick={() => setSlugField(normalizeSlug((form.name ?? store?.name ?? '')))}>توليد من الاسم</Button>
              </div>
              {store && (
                <a href={storefrontPath} target="_blank" rel="noreferrer" className="settings-open-store">
                  <Icon name="open_in_new" ariaHidden />
                  {published ? 'فتح المتجر المنشور' : 'معاينة المتجر'}
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
                  <a href={storefrontPath} target="_blank" rel="noreferrer" className="settings-outline-link">
                    <Button variant="outline" icon="open_in_new">فتح المتجر المنشور</Button>
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
