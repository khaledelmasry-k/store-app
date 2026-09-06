import { FunctionalComponent } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { Link } from 'wouter'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { StatsCard } from '../../shared/components/ui/StatsCard'
import { Loading } from '../../shared/components/ui/Loading'
import { EmptyState } from '../../shared/components/ui/EmptyState'
import { ErrorState } from '../../shared/components/ui/ErrorState'
import { Input } from '../../shared/components/ui/Input'
import { Button } from '../../shared/components/ui/Button'
import { Select } from '../../shared/components/ui/Select'
import { useToast } from '../../shared/hooks/useToast'
import { getPlatformCrmDashboardCallable, listPlatformCrmMerchantsCallable, getPlatformMerchant360Callable, updatePlatformMerchantCrmCallable, addPlatformMerchantNoteCallable, upsertPlatformMerchantFollowUpCallable } from '../../shared/services/auth'

const STAGES = ['lead', 'contacted', 'trial', 'onboarding', 'active', 'at_risk', 'renewal_due', 'churned', 'lost']

export const PlatformCrm: FunctionalComponent = () => {
  const [dashboard, setDashboard] = useState<any>(null)
  const [merchants, setMerchants] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [query, setQuery] = useState('')
  const [stage, setStage] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const toast = useToast()
  const load = async () => {
    setLoading(true); setError('')
    try {
      const [metrics, rows] = await Promise.all([getPlatformCrmDashboardCallable(), listPlatformCrmMerchantsCallable({ limit: 50 })])
      setDashboard((metrics as any).data); setMerchants((rows as any).data?.merchants || [])
    } catch { setError('تعذر تحميل CRM المنصة') } finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])
  if (loading) return <Loading message="جارٍ تحميل CRM المنصة…" />
  if (error) return <ErrorState title="تعذر تحميل CRM المنصة" description={error} onRetry={() => void load()} />
  const filtered = merchants.filter((m) => (!query || `${m.storeName} ${m.ownerName} ${m.email}`.toLowerCase().includes(query.toLowerCase())) && (!stage || m.stage === stage))
  const openMerchant = async (merchant: any) => { try { const result = await getPlatformMerchant360Callable({ merchantId: merchant.id }); setSelected((result as any).data) } catch { toast.push('تعذر تحميل ملف التاجر', undefined, 'error') } }
  const saveStage = async (value: string) => { if (!selected?.merchantId) return; await updatePlatformMerchantCrmCallable({ merchantId: selected.merchantId, stage: value }); setSelected({ ...selected, profile: { ...(selected.profile || {}), stage: value } }); toast.push('تم تحديث مرحلة التاجر') }
  const addNote = async () => { const body = window.prompt('نص الملاحظة'); if (body && selected?.merchantId) { await addPlatformMerchantNoteCallable({ merchantId: selected.merchantId, body }); toast.push('تمت إضافة الملاحظة') } }
  const addFollowUp = async () => { const title = window.prompt('عنوان المتابعة'); if (title && selected?.merchantId) { await upsertPlatformMerchantFollowUpCallable({ merchantId: selected.merchantId, title, status: 'open' }); toast.push('تم إنشاء المتابعة') } }
  return <div className="platform-operations">
    <PageHeader title="CRM التجار" subtitle="متابعة تجار Matjari ومرحلة علاقتهم بالمنصة" actions={<Link href="/platform/merchants" className="btn btn-ghost">قائمة التجار</Link>} />
    <div className="stats-grid">{[['إجمالي التجار', dashboard?.totalMerchants, 'storefront'], ['التجارب', dashboard?.trials, 'hourglass_top'], ['مدفوع نشط', dashboard?.activePaid, 'check_circle'], ['منتهٍ', dashboard?.expired, 'schedule'], ['تذاكر مفتوحة', dashboard?.openTickets, 'support_agent']].map(([label, value, icon]) => <StatsCard key={String(label)} title={String(label)} icon={String(icon)} value={String(value ?? 0)} />)}</div>
    <Card title="التجار"><div className="filter-bar"><Input label="بحث" value={query} onChange={setQuery} placeholder="اسم المتجر أو البريد" /><Select label="المرحلة" value={stage} onChange={setStage} options={[{ value: '', label: 'كل المراحل' }, ...STAGES.map((s) => ({ value: s, label: s }))]} /></div>{filtered.length === 0 ? <EmptyState title="لا يوجد تجار" description="غيّر الفلاتر أو أضف تاجرًا جديدًا." /> : <div className="table-wrap"><table><thead><tr><th>المتجر</th><th>المالك</th><th>الخطة</th><th>الحالة</th><th>المرحلة</th><th /></tr></thead><tbody>{filtered.map((m) => <tr key={m.id}><td>{m.storeName}</td><td>{m.ownerName || m.email}</td><td>{m.plan || '—'}</td><td>{m.subscriptionStatus || '—'}</td><td>{m.stage || '—'}</td><td><Button size="sm" variant="ghost" onClick={() => void openMerchant(m)}>360</Button></td></tr>)}</tbody></table></div>}</Card>
    {selected && <Card title={`Merchant 360 — ${selected.store?.name || selected.user?.email || ''}`}><div className="crm-detail-grid"><p>البريد: {selected.user?.email || '—'}</p><p>التحقق: {selected.user?.emailVerified ? 'تم' : 'غير مؤكد'}</p><p>المنتجات: {selected.productsCount}</p><p>الطلبات: {selected.totalOrders}</p><p>GMV: {selected.gmv}</p><p>التذاكر المفتوحة: {selected.openTickets}</p></div><Select label="مرحلة CRM" value={selected.profile?.stage || ''} onChange={(v) => void saveStage(v)} options={STAGES.map((s) => ({ value: s, label: s }))} /><div className="button-row"><Button onClick={() => void addNote()}>إضافة ملاحظة</Button><Button variant="outline" onClick={() => void addFollowUp()}>إضافة متابعة</Button><Button variant="ghost" onClick={() => setSelected(null)}>إغلاق</Button></div></Card>}
  </div>
}
export default PlatformCrm
