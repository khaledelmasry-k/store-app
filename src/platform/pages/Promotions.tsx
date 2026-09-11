import { FunctionalComponent } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { Button } from '../../shared/components/ui/Button'
import { Input } from '../../shared/components/ui/Input'
import { Textarea } from '../../shared/components/ui/Textarea'
import { Select } from '../../shared/components/ui/Select'
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
  return <div className="platform-operations"><PageHeader title="العروض والإعلانات" subtitle="إدارة الإعلانات والعروض الموجهة للتجار" />
    <Card title="إنشاء إعلان أو عرض" subtitle="اختر مكان الظهور ليعرف التاجر أين سيجد الرسالة."><div className="form-grid promotions-form-grid"><Input label="العنوان" value={form.title} onChange={(v) => setForm({ ...form, title: v })} /><Select label="النوع" value={form.type} onChange={(v) => setForm({ ...form, type: v })} options={[{ value: 'announcement', label: 'إعلان' }, { value: 'plan_offer', label: 'عرض باقة' }, { value: 'feature_announcement', label: 'ميزة جديدة' }, { value: 'general_offer', label: 'عرض عام' }]} /><Select label="الجمهور" value={form.audienceType} onChange={(v) => setForm({ ...form, audienceType: v })} options={[{ value: 'all_merchants', label: 'كل التجار' }, { value: 'selected_plans', label: 'باقات محددة' }, { value: 'selected_merchants', label: 'تجار محددون' }]} /><Select label="مكان الظهور" value={form.placement} onChange={(v) => setForm({ ...form, placement: v })} options={[{ value: 'dashboard_banner', label: 'لوحة التاجر' }, { value: 'subscription', label: 'صفحة الاشتراك' }, { value: 'pricing', label: 'صفحة الأسعار' }, { value: 'notification', label: 'الإشعارات' }]} /><Input label="الخطة (لعروض الخطط)" value={form.planId} onChange={(v) => setForm({ ...form, planId: v })} /><Input label="السعر الترويجي" type="number" min="0" value={form.promotionalPrice} onChange={(v) => setForm({ ...form, promotionalPrice: v })} /><Input label="يبدأ" type="datetime-local" value={form.startsAt} onChange={(v) => setForm({ ...form, startsAt: v })} /><Input label="ينتهي" type="datetime-local" value={form.endsAt} onChange={(v) => setForm({ ...form, endsAt: v })} /></div><Textarea label="الوصف" value={form.message} onChange={(v) => setForm({ ...form, message: v })} /><div className="promotion-admin-preview"><Button onClick={create} icon="add">إنشاء العرض</Button></div></Card>
    <div className="stack">{items.map((p: any) => <Card key={p.id}><div className="row-between"><div><strong>{p.title}</strong><div className="muted">{p.message}</div><small>{({ draft: 'مسودة', scheduled: 'مجدول', active: 'نشط', expired: 'منتهي', cancelled: 'متوقف' } as any)[p.effectiveStatus || p.status] || p.effectiveStatus || p.status} · {p.audienceType}{p.promotionalPrice != null ? ` · ${p.promotionalPrice} ج.م` : ''}</small></div><div className="row-actions"><Button size="sm" variant="secondary" onClick={async () => { await setPlatformPromotionStatusCallable({ promotionId: p.id, status: p.status === 'active' ? 'draft' : 'active' }); load() }}>{p.status === 'active' ? 'إيقاف العرض' : 'تفعيل العرض'}</Button></div></div></Card>)}</div>
  </div>
}
export default PlatformPromotions
