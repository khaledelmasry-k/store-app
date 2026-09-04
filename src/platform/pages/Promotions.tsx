import { FunctionalComponent } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { Button } from '../../shared/components/ui/Button'
import { Input } from '../../shared/components/ui/Input'
import { Textarea } from '../../shared/components/ui/Textarea'
import { useToast } from '../../shared/hooks/useToast'
import { createPlatformPromotionCallable, listPlatformPromotionsCallable, setPlatformPromotionStatusCallable } from '../../shared/services/auth'
import type { PlatformPromotion } from '../../shared/types'
import './PlatformCorePages.css'

export const PlatformPromotions: FunctionalComponent = () => {
  const [items, setItems] = useState<PlatformPromotion[]>([])
  const [form, setForm] = useState({ title: '', message: '', type: 'announcement', audienceType: 'all_merchants', startsAt: '', endsAt: '', planId: '', promotionalPrice: '', placement: 'dashboard_banner' })
  const toast = useToast()
  const load = async () => { try { const r: any = await listPlatformPromotionsCallable(); setItems(r.data?.promotions || []) } catch { toast.push('تعذر تحميل العروض', undefined, 'error') } }
  useEffect(() => { load() }, [])
  const create = async () => {
    if (!form.title.trim()) return toast.push('أدخل عنوان العرض', undefined, 'error')
    try {
      await createPlatformPromotionCallable({ ...form, promotionalPrice: form.promotionalPrice ? Number(form.promotionalPrice) : null, startsAt: form.startsAt || undefined, endsAt: form.endsAt || undefined, placement: [form.placement, ...(form.placement === 'dashboard_banner' ? ['notification'] : [])], ctaLabel: form.type === 'plan_offer' ? 'استفد من العرض' : '' })
      setForm({ title: '', message: '', type: 'announcement', audienceType: 'all_merchants', startsAt: '', endsAt: '', planId: '', promotionalPrice: '', placement: 'dashboard_banner' }); await load(); toast.push('تم إنشاء العرض')
    } catch (e: any) { toast.push(e?.message || 'تعذر إنشاء العرض', undefined, 'error') }
  }
  return <div className="page-content"><PageHeader title="العروض والإعلانات" subtitle="إدارة الإعلانات والعروض الموجهة للتجار" />
    <Card title="إنشاء إعلان أو عرض" subtitle="اختر مكان الظهور ليعرف التاجر أين سيجد الرسالة."><div className="form-grid promotions-form-grid"><Input label="العنوان" value={form.title} onChange={(v) => setForm({ ...form, title: v })} /><label className="field-label">النوع<select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: (e.currentTarget as HTMLSelectElement).value })}><option value="announcement">إعلان</option><option value="plan_offer">عرض باقة</option><option value="feature_announcement">ميزة جديدة</option><option value="general_offer">عرض عام</option></select></label><label className="field-label">الجمهور<select className="input" value={form.audienceType} onChange={(e) => setForm({ ...form, audienceType: (e.currentTarget as HTMLSelectElement).value })}><option value="all_merchants">كل التجار</option><option value="selected_plans">باقات محددة</option><option value="selected_merchants">تجار محددون</option></select></label><label className="field-label">مكان الظهور<select className="input" value={form.placement} onChange={(e) => setForm({ ...form, placement: (e.currentTarget as HTMLSelectElement).value })}><option value="dashboard_banner">لوحة التاجر</option><option value="subscription">صفحة الاشتراك</option><option value="pricing">صفحة الأسعار</option><option value="notification">الإشعارات</option></select></label><Input label="الخطة (لعروض الخطط)" value={form.planId} onChange={(v) => setForm({ ...form, planId: v })} /><Input label="السعر الترويجي" type="number" min="0" value={form.promotionalPrice} onChange={(v) => setForm({ ...form, promotionalPrice: v })} /><Input label="يبدأ" type="datetime-local" value={form.startsAt} onChange={(v) => setForm({ ...form, startsAt: v })} /><Input label="ينتهي" type="datetime-local" value={form.endsAt} onChange={(v) => setForm({ ...form, endsAt: v })} /></div><Textarea label="الوصف" value={form.message} onChange={(v) => setForm({ ...form, message: v })} /><div className="promotion-admin-preview"><span>معاينة مكان الظهور</span><strong>{form.title || 'عنوان العرض'}</strong><p>{form.message || 'ستظهر رسالتك هنا للتاجر.'}</p>{form.promotionalPrice && <b>{form.promotionalPrice} ج.م</b>}</div><Button onClick={create}>إنشاء عرض</Button></Card>
    <div className="stack">{items.map((p: any) => <Card key={p.id}><div className="row-between"><div><strong>{p.title}</strong><div className="muted">{p.message}</div><small>{({ draft: 'مسودة', scheduled: 'مجدول', active: 'نشط', expired: 'منتهي', cancelled: 'متوقف' } as any)[p.effectiveStatus || p.status] || p.effectiveStatus || p.status} · {p.audienceType}{p.promotionalPrice != null ? ` · ${p.promotionalPrice} ج.م` : ''}</small></div><div className="row-actions"><Button size="sm" variant="secondary" onClick={async () => { await setPlatformPromotionStatusCallable({ promotionId: p.id, status: p.status === 'active' ? 'draft' : 'active' }); load() }}>{p.status === 'active' ? 'إيقاف العرض' : 'تفعيل العرض'}</Button></div></div></Card>)}</div>
  </div>
}
export default PlatformPromotions
