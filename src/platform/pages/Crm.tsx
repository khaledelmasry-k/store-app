import { FunctionalComponent } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { Link } from 'wouter'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { StatsCard } from '../../shared/components/ui/StatsCard'
import { Table } from '../../shared/components/ui/Table'
import { FilterBar } from '../../shared/components/ui/FilterBar'
import { Select } from '../../shared/components/ui/Select'
import { Loading } from '../../shared/components/ui/Loading'
import { EmptyState } from '../../shared/components/ui/EmptyState'
import { ErrorState } from '../../shared/components/ui/ErrorState'
import { Button } from '../../shared/components/ui/Button'
import { Modal } from '../../shared/components/ui/Modal'
import { Textarea } from '../../shared/components/ui/Textarea'
import { Input } from '../../shared/components/ui/Input'
import { useToast } from '../../shared/hooks/useToast'
import { getPlatformCrmDashboardCallable, listPlatformCrmMerchantsCallable, getPlatformMerchant360Callable, updatePlatformMerchantCrmCallable, addPlatformMerchantNoteCallable, upsertPlatformMerchantFollowUpCallable } from '../../shared/services/auth'

const STAGES = ['lead', 'contacted', 'trial', 'onboarding', 'active', 'at_risk', 'renewal_due', 'churned', 'lost']

export const PlatformCrm: FunctionalComponent = () => {
  const [dashboard, setDashboard] = useState<any>(null)
  const [merchants, setMerchants] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [query, setQuery] = useState('')
  const [stage, setStage] = useState('')
  const [plan, setPlan] = useState('')
  const [subscriptionStatus, setSubscriptionStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [noteOpen, setNoteOpen] = useState(false)
  const [noteBody, setNoteBody] = useState('')
  const [followOpen, setFollowOpen] = useState(false)
  const [followTitle, setFollowTitle] = useState('')
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
  const filtered = merchants.filter((m) => (!query || `${m.storeName} ${m.ownerName} ${m.email}`.toLowerCase().includes(query.toLowerCase())) && (!stage || m.stage === stage) && (!plan || m.plan === plan) && (!subscriptionStatus || m.subscriptionStatus === subscriptionStatus))
  const openMerchant = async (merchant: any) => { try { const result = await getPlatformMerchant360Callable({ merchantId: merchant.id }); setSelected((result as any).data) } catch { toast.push('تعذر تحميل ملف التاجر', undefined, 'error') } }
  const saveStage = async (value: string) => { if (!selected?.merchantId) return; await updatePlatformMerchantCrmCallable({ merchantId: selected.merchantId, stage: value }); setSelected({ ...selected, profile: { ...(selected.profile || {}), stage: value } }); toast.push('تم تحديث مرحلة التاجر') }
  const handleAddNote = async () => {
    if (!noteBody.trim() || !selected?.merchantId) return
    await addPlatformMerchantNoteCallable({ merchantId: selected.merchantId, body: noteBody.trim() })
    setNoteBody(''); setNoteOpen(false); toast.push('تمت إضافة الملاحظة')
  }
  const handleAddFollowUp = async () => {
    if (!followTitle.trim() || !selected?.merchantId) return
    await upsertPlatformMerchantFollowUpCallable({ merchantId: selected.merchantId, title: followTitle.trim(), status: 'open' })
    setFollowTitle(''); setFollowOpen(false); toast.push('تم إنشاء المتابعة')
  }
  const planOptions = Array.from(new Set(merchants.map((m) => m.plan).filter(Boolean))) as string[]
  const statusOptions = Array.from(new Set(merchants.map((m) => m.subscriptionStatus).filter(Boolean))) as string[]
  return <div className="platform-operations">
    <PageHeader title="CRM التجار" subtitle="متابعة تجار Matjari ومرحلة علاقتهم بالمنصة" actions={<Link href="/platform/merchants" className="btn btn-ghost">قائمة التجار</Link>} />
    <div className="stats-grid">{[['إجمالي التجار', dashboard?.totalMerchants, 'storefront'], ['التجارب', dashboard?.trials, 'hourglass_top'], ['مدفوع نشط', dashboard?.activePaid, 'check_circle'], ['منتهٍ', dashboard?.expired, 'schedule'], ['تذاكر مفتوحة', dashboard?.openTickets, 'support_agent']].map(([label, value, icon]) => <StatsCard key={String(label)} title={String(label)} icon={String(icon)} value={String(value ?? 0)} />)}</div>
    <Card title="التجار">
      <FilterBar
        search={query}
        onSearch={setQuery}
        searchPlaceholder="اسم المتجر أو البريد..."
        actions={
          <div className="flex" style={{ gap: 8, flexWrap: 'wrap' }}>
            <select aria-label="المرحلة" className="input" style={{ minWidth: 140 }} value={stage} onChange={(e: any) => setStage((e.target as HTMLSelectElement).value)}>
              <option value="">كل المراحل</option>
              {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select aria-label="الخطة" className="input" style={{ minWidth: 140 }} value={plan} onChange={(e: any) => setPlan((e.target as HTMLSelectElement).value)}>
              <option value="">كل الخطط</option>
              {planOptions.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <select aria-label="حالة الاشتراك" className="input" style={{ minWidth: 140 }} value={subscriptionStatus} onChange={(e: any) => setSubscriptionStatus((e.target as HTMLSelectElement).value)}>
              <option value="">كل الحالات</option>
              {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        }
      />
      {filtered.length === 0 ? <EmptyState title="لا يوجد تجار" description="غيّر الفلاتر أو أضف تاجرًا جديدًا." /> : (
        <Table
          cardMode
          rows={filtered.map((m) => ({ ...m, id: m.id }))}
          columns={[
            { key: 'store', header: 'المتجر', render: (m: any) => <span className="font-semibold">{m.storeName}</span> },
            { key: 'owner', header: 'المالك', render: (m: any) => <span>{m.ownerName || m.email || '—'}</span> },
            { key: 'plan', header: 'الخطة', render: (m: any) => <span className="muted small">{m.plan || '—'}</span> },
            { key: 'status', header: 'الحالة', render: (m: any) => <span className="muted small">{m.subscriptionStatus || '—'}</span> },
            { key: 'stage', header: 'المرحلة', render: (m: any) => <span className="muted small">{m.stage || '—'}</span> },
            { key: 'action', header: '', render: (m: any) => <Button size="sm" variant="ghost" onClick={() => void openMerchant(m)}>360</Button> },
          ]}
        />
      )}
    </Card>
    {selected && <Card title={`Merchant 360 — ${selected.store?.name || selected.user?.email || ''}`}><div className="crm-detail-grid"><p>البريد: {selected.user?.email || '—'}</p><p>التحقق: {selected.user?.emailVerified ? 'تم' : 'غير مؤكد'}</p><p>المنتجات: {selected.productsCount}</p><p>الطلبات: {selected.totalOrders}</p><p>GMV: {selected.gmv}</p><p>التذاكر المفتوحة: {selected.openTickets}</p></div><Select label="مرحلة CRM" value={selected.profile?.stage || ''} onChange={(v) => void saveStage(v)} options={STAGES.map((s) => ({ value: s, label: s }))} /><div className="button-row" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}><Button onClick={() => setNoteOpen(true)}>إضافة ملاحظة</Button><Button variant="outline" onClick={() => setFollowOpen(true)}>إضافة متابعة</Button><Button variant="ghost" onClick={() => setSelected(null)}>إغلاق</Button></div></Card>}

    <Modal open={noteOpen} onClose={() => setNoteOpen(false)} title="ملاحظة جديدة" footer={<><Button variant="ghost" onClick={() => setNoteOpen(false)}>إلغاء</Button><Button onClick={handleAddNote} disabled={!noteBody.trim()}>حفظ</Button></>}>
      <Textarea label="نص الملاحظة" value={noteBody} onChange={setNoteBody} rows={3} placeholder="اكتب ملاحظة المتابعة..." />
    </Modal>
    <Modal open={followOpen} onClose={() => setFollowOpen(false)} title="متابعة جديدة" footer={<><Button variant="ghost" onClick={() => setFollowOpen(false)}>إلغاء</Button><Button onClick={handleAddFollowUp} disabled={!followTitle.trim()}>إنشاء</Button></>}>
      <Input label="عنوان المتابعة" value={followTitle} onChange={setFollowTitle} placeholder="مثال: متابعة التجديد" />
    </Modal>
  </div>
}
export default PlatformCrm
