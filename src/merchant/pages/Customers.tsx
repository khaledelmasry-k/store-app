import { FunctionalComponent } from 'preact'
import { useEffect, useMemo, useState } from 'preact/hooks'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Badge } from '../../shared/components/ui/Badge'
import { Button } from '../../shared/components/ui/Button'
import { Modal } from '../../shared/components/ui/Modal'
import { Input } from '../../shared/components/ui/Input'
import { Textarea } from '../../shared/components/ui/Textarea'
import { Select } from '../../shared/components/ui/Select'
import { EmptyState } from '../../shared/components/ui/EmptyState'
import { useStore } from '../../shared/hooks/useStore'
import { useCollection } from '../../shared/hooks/useCollection'
import { useToast } from '../../shared/hooks/useToast'
import { customersService } from '../../shared/services/customers'
import { getCustomer360Callable, upsertFollowUpCallable, updateCustomerCrmCallable, addCustomerNoteCallable } from '../../shared/services/crm'
import { formatCurrency, timeAgo, formatDate } from '../../shared/utils/format'
import { GOVER_EG as GOVERNORATES } from '../../shared/utils/constants'
import { normalizeSegment, segmentLabel } from '../../shared/utils/segments'
import { STATUS_LABELS, STATUS_COLORS } from '../../shared/utils/constants'
import { CRM_STAGE_OPTIONS, normalizeCrmStage, crmStageLabel, CRM_STAGE_TONES, sanitizeTags } from '../../shared/utils/crm'
import { normalizePhoneEG, formatPhoneDisplay } from '../../shared/utils/phone'
import type { Customer, Order, CustomerTimelineEvent, CustomerFollowUp } from '../../shared/types'
import { Icon } from '../../shared/components/ui/Icon'
import { CrmTimeline } from '../components/CrmTimeline'
import { CrmFollowUps } from '../components/CrmFollowUps'
import { CrmMetricsGrid } from '../components/CrmMetricsGrid'
import './Customers.css'

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0] || '')
    .join('')
    .toUpperCase()

const stageBadge = (stageOrSeg: string | undefined | null) => {
  const s = normalizeCrmStage(stageOrSeg) || normalizeSegment(stageOrSeg || '') as any
  if (!s) return null
  const label = crmStageLabel(s) || segmentLabel(s as any) || s
  const tone = (CRM_STAGE_TONES as any)[s] || (s === 'vip' ? 'amber' : s === 'new' ? 'blue' : 'slate')
  return <Badge tone={tone}>{label}</Badge>
}

export const MerchantCustomers: FunctionalComponent = () => {
  const { store } = useStore()
  const storeId = store?.id || ''
  const customersRes = useCollection<Customer>('customers', { storeId, orderBy: { field: 'createdAt' } })
  const customers = customersRes.data
  const ordersRes = useCollection<Order>('orders', { storeId, orderBy: { field: 'createdAt' } })
  const toast = useToast()

  const [query, setQuery] = useState('')
  const [stage, setStage] = useState('')
  const [governorate, setGovernorate] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [selected, setSelected] = useState<Customer | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState<Partial<Customer> & { tagsInput?: string } >({})
  const [saving, setSaving] = useState(false)
  const [detailTab, setDetailTab] = useState<'overview' | 'orders' | 'timeline' | 'followups'>('overview')
  const [timeline, setTimeline] = useState<CustomerTimelineEvent[]>([])
  const [followUps, setFollowUps] = useState<CustomerFollowUp[]>([])
  const [metrics, setMetrics] = useState<any>(null)
  const [orders360, setOrders360] = useState<Order[]>([])
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [noteDraft, setNoteDraft] = useState('')
  const [tagsDraft, setTagsDraft] = useState('')

  const allTags = useMemo(() => {
    const set = new Set<string>()
    for (const c of customers) for (const t of c.tags || []) set.add(String(t))
    return [...set].sort()
  }, [customers])

  const filtered = customers.filter(
    (c) =>
      ((c.name || '').toLowerCase().includes(query.toLowerCase()) || (c.phone || '').includes(query) || (c.email || '').toLowerCase().includes(query.toLowerCase()) || (c.tags || []).join(' ').toLowerCase().includes(query.toLowerCase())) &&
      (!stage || (normalizeCrmStage((c as any).stage) || normalizeSegment(c.segment || '') || '') === stage) &&
      (!governorate || c.governorate === governorate) &&
      (!tagFilter || (c.tags || []).includes(tagFilter)),
  )

  const customerOrders = (c: Customer) =>
    ordersRes.data
      .filter(
        (o) => (o.customerDocId && o.customerDocId === c.id) || (o.phone && c.phone && (normalizePhoneEG(o.phone) === normalizePhoneEG(c.phone) || o.phone === c.phone)),
      )
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))

  const detail = selected || (filtered.length > 0 && !selected ? filtered[0] : null)
  const detailOrders = useMemo(() => detail ? (orders360.length ? orders360 : customerOrders(detail)) : [], [detail, orders360, ordersRes.data])

  // Fetch 360 when detail changes
  useEffect(() => {
    if (!detail || !storeId) {
      setTimeline([])
      setFollowUps([])
      setMetrics(null)
      setOrders360([])
      return
    }
    let cancelled = false
    setTimelineLoading(true)
    getCustomer360Callable({ storeId, customerId: detail.id })
      .then((res: any) => {
        if (cancelled) return
        const data = res?.data as any
        setTimeline(data?.timeline || [])
        setFollowUps(data?.followUps || [])
        setMetrics(data?.metrics || null)
        setOrders360((data?.orders || []) as Order[])
      })
      .catch(() => {
        // fallback to local calc
        if (cancelled) return
        const localOrders = customerOrders(detail)
        const totalRevenue = localOrders.filter((o) => o.status === 'DELIVERED').reduce((s, o) => s + (o.totalPrice || 0), 0)
        const delivered = localOrders.filter((o) => o.status === 'DELIVERED').length
        setMetrics({
          totalOrders: localOrders.length,
          deliveredOrders: delivered,
          cancelledOrders: localOrders.filter((o) => o.status === 'CANCELLED').length,
          returnedOrders: localOrders.filter((o) => o.status === 'RETURNED').length,
          totalRevenue,
          avgOrderValue: delivered ? totalRevenue / delivered : 0,
          daysSinceLastOrder: detail.lastOrderAt ? Math.floor((Date.now() - detail.lastOrderAt.seconds * 1000) / 86400000) : null,
          returnRate: localOrders.length ? localOrders.filter((o) => o.status === 'RETURNED').length / localOrders.length : 0,
          cancellationRate: localOrders.length ? localOrders.filter((o) => o.status === 'CANCELLED').length / localOrders.length : 0,
        })
      })
      .finally(() => { if (!cancelled) setTimelineLoading(false) })
    // init tags draft
    setTagsDraft((detail.tags || []).join(', '))
    setDetailTab('overview')
    setNoteDraft('')
    return () => { cancelled = true }
  }, [detail?.id, storeId])

  const exportCsv = () => {
    const rows = [
      ['الاسم', 'الهاتف', 'الهاتف المهيأ', 'البريد', 'المحافظة', 'المدينة', 'المرحلة', 'الوسوم', 'الطلبات', 'إجمالي الإنفاق', 'آخر طلب', 'مصدر'],
      ...filtered.map((c) => {
        const st = normalizeCrmStage((c as any).stage) || normalizeSegment(c.segment || '') || ''
        return [
          c.name, c.phone, (c as any).phoneNormalized || normalizePhoneEG(c.phone), c.email || '', c.governorate || '', c.city || '',
          st ? crmStageLabel(st) : '', (c.tags || []).join(' | '), String(c.totalOrders), String(c.totalSpent),
          c.lastOrderAt ? new Date((c.lastOrderAt as any).seconds * 1000).toISOString().slice(0, 10) : '',
          (c as any).attributionSource || (c as any).lastSalesLinkCode || '',
        ]
      }),
    ]
    const csv = '\uFEFF' + rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `customers-crm-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
    toast.push(`تم تصدير ${filtered.length} عميل`)
  }

  const openEdit = (c: Customer) => {
    setForm({ ...c, tagsInput: (c.tags || []).join(', ') })
    setEditOpen(true)
  }

  const saveEdit = async () => {
    if (!selected || saving || !storeId) return
    setSaving(true)
    try {
      const tags = form.tagsInput != null ? sanitizeTags(String(form.tagsInput).split(',').map((s) => s.trim())) : sanitizeTags(selected.tags)
      const patch: Record<string, unknown> = {}
      if (form.stage !== undefined) patch.stage = form.stage || null
      else if (form.segment !== undefined) patch.stage = form.segment || null
      if (form.tagsInput !== undefined) patch.tags = tags
      if (form.note !== undefined) patch.note = form.note || null
      if (form.email !== undefined) patch.email = form.email || ''
      if (form.name !== undefined) patch.name = form.name
      if (form.phone !== undefined) patch.phone = form.phone
      if (form.governorate !== undefined) patch.governorate = form.governorate || ''
      if (form.city !== undefined) patch.city = form.city || ''
      if (form.address !== undefined) patch.address = form.address || ''
      // Use CRM callable for stage/tags/note, fallback to direct if needed
      if (patch.stage != null || patch.tags != null || patch.note != null) {
        await updateCustomerCrmCallable({ storeId, customerId: selected.id, patch })
      } else {
        await customersService.update(selected.id, patch)
      }
      // handle remaining fields that are not part of CRM patch via direct
      const directPatch: Record<string, unknown> = {}
      if (form.name !== undefined && patch.name == null) directPatch.name = form.name
      if (form.phone !== undefined && patch.phone == null) directPatch.phone = form.phone
      if (Object.keys(directPatch).length) await customersService.update(selected.id, directPatch)
      toast.push('تم تحديث بيانات العميل')
      setEditOpen(false)
    } catch (err: any) {
      toast.push('تعذر تحديث العميل', err?.message || 'حدث خطأ غير متوقع', 'error')
    }
    setSaving(false)
  }

  const addManual = async () => {
    if (!form.name || !form.phone) {
      toast.push('أدخل اسم ورقم هاتف', undefined, 'error')
      return
    }
    const norm = normalizePhoneEG(form.phone)
    if (!norm) { toast.push('رقم الهاتف غير صالح', undefined, 'error'); return }
    try {
      const tags = form.tagsInput ? sanitizeTags(String(form.tagsInput).split(',').map((s) => s.trim())) : []
      await customersService.create(storeId, {
        name: form.name,
        phone: form.phone,
        phoneNormalized: norm,
        email: form.email || '',
        governorate: form.governorate || '',
        city: form.city || '',
        address: form.address || '',
        segment: (form as any).stage || form.segment || null,
        stage: (form as any).stage || null,
        tags,
        note: form.note || null,
        totalOrders: 0,
        totalSpent: 0,
      } as any)
      toast.push('تم إضافة العميل')
      setForm({})
      setAddOpen(false)
    } catch (err: any) {
      toast.push('تعذر إضافة العميل', err?.message || 'حدث خطأ غير متوقع', 'error')
    }
  }

  const handleAddNote = async () => {
    if (!detail || !storeId || !noteDraft.trim()) return
    try {
      await addCustomerNoteCallable({ storeId, customerId: detail.id, body: noteDraft.trim() })
      toast.push('تمت إضافة الملاحظة')
      setNoteDraft('')
      const res: any = await getCustomer360Callable({ storeId, customerId: detail.id })
      setTimeline(res?.data?.timeline || [])
    } catch (err: any) {
      toast.push('تعذر إضافة الملاحظة', err?.message, 'error')
    }
  }

  const handleCreateFollowUp = async (data: { dueAt: string; notes: string }) => {
    if (!detail || !storeId) return
    await upsertFollowUpCallable({ storeId, customerId: detail.id, dueAt: data.dueAt, notes: data.notes })
    toast.push('تم إنشاء المتابعة')
    const res: any = await getCustomer360Callable({ storeId, customerId: detail.id })
    setFollowUps(res?.data?.followUps || [])
    setTimeline(res?.data?.timeline || [])
  }

  const handleUpdateFollowUp = async (id: string, status: string, result?: string) => {
    if (!detail || !storeId) return
    // need dueAt: fetch existing
    const existing = followUps.find((f) => f.id === id)
    if (!existing) return
    const dueAt = existing.dueAt ? new Date(existing.dueAt.seconds * 1000).toISOString() : new Date().toISOString()
    await upsertFollowUpCallable({ storeId, customerId: detail.id, followUpId: id, dueAt, status, notes: existing.notes || '', result })
    toast.push(status === 'done' ? 'تم إتمام المتابعة' : 'تم تحديث المتابعة')
    const res: any = await getCustomer360Callable({ storeId, customerId: detail.id })
    setFollowUps(res?.data?.followUps || [])
    setTimeline(res?.data?.timeline || [])
  }

  const handleStageChange = async (newStage: string) => {
    if (!detail || !storeId) return
    try {
      await updateCustomerCrmCallable({ storeId, customerId: detail.id, patch: { stage: newStage || null } })
      toast.push(`تم تغيير المرحلة إلى ${crmStageLabel(newStage) || '—'}`)
      const res: any = await getCustomer360Callable({ storeId, customerId: detail.id })
      setTimeline(res?.data?.timeline || [])
    } catch (err: any) {
      toast.push('تعذر تغيير المرحلة', err?.message, 'error')
    }
  }

  const handleTagsSave = async () => {
    if (!detail || !storeId) return
    const tags = sanitizeTags(tagsDraft.split(',').map((s) => s.trim()))
    try {
      await updateCustomerCrmCallable({ storeId, customerId: detail.id, patch: { tags } })
      toast.push('تم تحديث الوسوم')
      const res: any = await getCustomer360Callable({ storeId, customerId: detail.id })
      setTimeline(res?.data?.timeline || [])
    } catch (err: any) {
      toast.push('تعذر تحديث الوسوم', err?.message, 'error')
    }
  }

  return (
    <div className="merchant-operations merchant-customers-page">
      <PageHeader
        breadcrumb="CRM / العملاء"
        title="العملاء — CRM"
        subtitle={`${customers.length} عميل — ${filtered.length} بعد الفلترة — سجل 360 ومتابعات وتايملاين`}
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="ghost" icon="analytics" onClick={() => (window.location.href = '/dashboard/crm')}>لوحة CRM</Button>
            <Button icon="person_add" onClick={() => { setForm({}); setAddOpen(true) }}>إضافة عميل</Button>
          </div>
        }
      />

      <div className="customers-toolbar">
        <div className="customers-search">
          <Icon name="search" ariaHidden />
          <input type="text" placeholder="ابحث بالاسم أو الهاتف أو البريد أو الوسم..." value={query} onInput={(e) => setQuery((e.target as HTMLInputElement).value)} aria-label="بحث في العملاء" />
        </div>
        <span className="customers-divider" />
        <select value={governorate} onChange={(e) => setGovernorate((e.target as HTMLSelectElement).value)} aria-label="المحافظة">
          <option value="">كل المحافظات</option>
          {GOVERNORATES.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <select value={stage} onChange={(e) => setStage((e.target as HTMLSelectElement).value)} aria-label="المرحلة">
          <option value="">كل المراحل</option>
          {CRM_STAGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={tagFilter} onChange={(e) => setTagFilter((e.target as HTMLSelectElement).value)} aria-label="الوسم">
          <option value="">كل الوسوم</option>
          {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <button type="button" className="customers-export" onClick={exportCsv}><Icon name="download" ariaHidden /> تصدير CRM</button>
      </div>

      {allTags.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {allTags.slice(0, 12).map((t) => (
            <button
              key={t}
              onClick={() => setTagFilter(tagFilter === t ? '' : t)}
              style={{
                padding: '4px 10px',
                borderRadius: 9999,
                border: '1px solid var(--outline-variant)',
                background: tagFilter === t ? 'var(--primary-container)' : 'var(--surface)',
                color: tagFilter === t ? 'var(--on-primary-container)' : 'var(--text-on-surface-variant)',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              #{t}
            </button>
          ))}
        </div>
      )}

      <div className="customers-layout">
        <div className="customers-table-col">
          {customersRes.loading ? (
            <div className="loading-screen"><span className="spinner spinner-lg" /></div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon="groups"
              title="لا يوجد عملاء"
              description={query || governorate || stage || tagFilter ? 'لا توجد نتائج تطابق البحث والفلترة.' : 'العملاء الذين يطلبون من متجرك سيظهرون هنا.'}
              action={!query && !governorate && !stage && !tagFilter && <Button icon="person_add" onClick={() => { setForm({}); setAddOpen(true) }}>إضافة أول عميل</Button>}
            />
          ) : (
            <div className="customers-table">
              <table>
                <thead>
                  <tr>
                    <th>العميل</th>
                    <th>الهاتف</th>
                    <th>المحافظة</th>
                    <th>المرحلة</th>
                    <th>الوسوم</th>
                    <th>الطلبات</th>
                    <th>الإنفاق</th>
                    <th>آخر طلب</th>
                    <th className="actions-col"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => {
                    const st = normalizeCrmStage((c as any).stage) || normalizeSegment(c.segment || '') || ''
                    const isVip = st === 'vip'
                    const lastOrder = customerOrders(c)[0]
                    const pending = (c as any).pendingFollowUpsCount || 0
                    return (
                      <tr key={c.id} className={selected?.id === c.id ? 'is-selected' : ''} onClick={() => setSelected(c)}>
                        <td>
                          <span className="cust-cell">
                            <span className={`cust-avatar ${st === 'vip' ? 'tone-vip' : st === 'repeat' ? 'tone-regular' : ''}`}>{initials(c.name)}</span>
                            <span>
                              <span className={`cust-name${isVip ? ' is-vip' : ''}`}>{c.name}</span>
                              {c.email && <span className="cust-email">{c.email}</span>}
                            </span>
                            {pending > 0 && <span style={{ marginInlineStart: 6, background: 'var(--error)', color: 'white', borderRadius: 9999, padding: '2px 6px', fontSize: 10 }}>{pending}</span>}
                          </span>
                        </td>
                        <td><span className="cust-phone" title={(c as any).phoneNormalized || ''}>{formatPhoneDisplay(c.phone)}</span></td>
                        <td>
                          <div>{c.governorate || '—'}</div>
                          {c.city && <div className="cust-city">{c.city}</div>}
                        </td>
                        <td>{stageBadge((c as any).stage || c.segment) || <span className="muted">—</span>}</td>
                        <td>
                          {(c.tags || []).length ? (
                            <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              {(c.tags || []).slice(0, 2).map((t) => <span key={t} style={{ fontSize: 10, background: 'var(--surface-variant)', padding: '2px 6px', borderRadius: 9999 }}>{t}</span>)}
                              {(c.tags || []).length > 2 && <span style={{ fontSize: 10, color: 'var(--text-on-surface-variant)' }}>+{c.tags!.length - 2}</span>}
                            </span>
                          ) : <span className="muted">—</span>}
                        </td>
                        <td><span className="cust-nums">{c.totalOrders}</span></td>
                        <td><span className="cust-nums cust-spent">{formatCurrency(c.totalSpent)}</span></td>
                        <td>
                          <div className="cust-nums">{lastOrder?.orderNumber || '—'}</div>
                          <div className="cust-city">{timeAgo(c.lastOrderAt)}</div>
                        </td>
                        <td className="actions-col">
                          <button className="cust-more" onClick={(e) => { e.stopPropagation(); setSelected(c); openEdit(c) }} title="تعديل"><Icon name="edit" /></button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {detail && (
          <aside className="customers-aside">
            <div className="customers-aside-head">
              <span className="cust-avatar-lg">{initials(detail.name)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{detail.name}</h2>
                <p><Icon name="call" ariaHidden /> <span className="cust-nums">{formatPhoneDisplay(detail.phone)}</span></p>
                <p style={{ marginTop: 4 }}>{stageBadge((detail as any).stage || detail.segment)}</p>
              </div>
              <button type="button" className="customers-aside-close" onClick={() => setSelected(null)} title="إغلاق"><Icon name="close" ariaHidden /></button>
            </div>

            <div style={{ display: 'flex', gap: 4, padding: '8px 12px', borderBottom: '1px solid var(--outline-variant)', background: 'var(--surface-container-lowest)' }}>
              {(['overview', 'orders', 'timeline', 'followups'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setDetailTab(tab)}
                  style={{
                    flex: 1,
                    padding: '6px 8px',
                    borderRadius: 8,
                    border: 'none',
                    background: detailTab === tab ? 'var(--primary)' : 'transparent',
                    color: detailTab === tab ? 'white' : 'var(--text-on-surface-variant)',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  {tab === 'overview' ? 'نظرة' : tab === 'orders' ? `الطلبات (${detailOrders.length})` : tab === 'timeline' ? `السجل (${timeline.length})` : `متابعات (${followUps.length})`}
                </button>
              ))}
            </div>

            <div className="customers-aside-body">
              {detailTab === 'overview' && (
                <>
                  <CrmMetricsGrid metrics={metrics} loading={timelineLoading && !metrics} />

                  <div className="customers-aside-details">
                    <h3>تفاصيل العميل</h3>
                    {detail.email && (
                      <div className="cust-detail-row">
                        <Icon name="mail" ariaHidden />
                        <div><span>البريد الإلكتروني</span><strong>{detail.email}</strong></div>
                      </div>
                    )}
                    <div className="cust-detail-row">
                      <Icon name="location_on" ariaHidden />
                      <div>
                        <span>العنوان</span>
                        <strong>{[detail.governorate, detail.city].filter(Boolean).join('، ') || '—'}</strong>
                        {detail.address && <em>{detail.address}</em>}
                      </div>
                    </div>
                    <div className="cust-detail-row">
                      <Icon name="workspace_premium" ariaHidden />
                      <div style={{ flex: 1 }}>
                        <span>المرحلة</span>
                        <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center' }}>
                          <select value={normalizeCrmStage((detail as any).stage) || ''} onChange={(e) => handleStageChange((e.target as HTMLSelectElement).value)} style={{ flex: 1, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--outline-variant)', background: 'var(--surface-container)' }}>
                            <option value="">بدون مرحلة</option>
                            {CRM_STAGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                    <div className="cust-detail-row">
                      <Icon name="sell" ariaHidden />
                      <div style={{ flex: 1 }}>
                        <span>الوسوم</span>
                        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                          <input value={tagsDraft} onInput={(e) => setTagsDraft((e.target as HTMLInputElement).value)} placeholder="وسوم مفصولة بفاصلة" style={{ flex: 1, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--outline-variant)', background: 'var(--surface-container)', fontSize: 12 }} />
                          <Button size="sm" onClick={handleTagsSave}>حفظ</Button>
                        </div>
                        {(detail.tags || []).length > 0 && (
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
                            {(detail.tags || []).map((t) => <span key={t} style={{ fontSize: 11, background: 'var(--tertiary-container)', color: 'var(--on-tertiary-container)', padding: '3px 8px', borderRadius: 9999 }}>#{t}</span>)}
                          </div>
                        )}
                      </div>
                    </div>
                    {(detail as any).phoneNormalized && (
                      <div className="cust-detail-row">
                        <Icon name="smartphone" ariaHidden />
                        <div><span>الهاتف المهيأ</span><strong style={{ direction: 'ltr' }}>{(detail as any).phoneNormalized}</strong></div>
                      </div>
                    )}
                    {detail.note && (
                      <div className="cust-detail-row">
                        <Icon name="note" ariaHidden />
                        <div><span>ملاحظة عامة</span><em className="cust-note">{detail.note}</em></div>
                      </div>
                    )}
                    {(detail as any).attributionSource && (
                      <div className="cust-detail-row">
                        <Icon name="campaign" ariaHidden />
                        <div><span>المصدر</span><strong>{(detail as any).attributionSource} — {(detail as any).lastSalesLinkCode || (detail as any).lastUtmSource || ''}</strong></div>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 12, borderTop: '1px solid var(--outline-variant)' }}>
                    <h3 style={{ margin: 0, fontSize: 13 }}>إضافة ملاحظة</h3>
                    <Textarea value={noteDraft} onChange={setNoteDraft} rows={2} placeholder="اكتب ملاحظة للفريق..." />
                    <Button size="sm" icon="note" disabled={!noteDraft.trim()} onClick={handleAddNote}>حفظ ملاحظة</Button>
                  </div>

                  <button type="button" className="customers-edit-btn" onClick={() => openEdit(detail)}><Icon name="edit" ariaHidden /> تعديل شامل</button>
                </>
              )}

              {detailTab === 'orders' && (
                <div className="customers-aside-orders">
                  <div className="customers-aside-orders-head">
                    <h3>سجل الطلبات — {detailOrders.length}</h3>
                    {detailOrders.length > 5 && <a href={`/dashboard/orders?q=${encodeURIComponent(detail.phone)}`}>عرض الكل</a>}
                  </div>
                  {detailOrders.length === 0 ? (
                    <p className="muted small">لم يضع هذا العميل أي طلبات بعد.</p>
                  ) : (
                    detailOrders.slice(0, 10).map((o) => {
                      const displayStatus = String(o.shipmentStatus || '').toUpperCase() === 'FAILED' ? 'FAILED' : o.status
                      const status = displayStatus === 'FAILED' ? 'تعذر التسليم' : (STATUS_LABELS[o.status as keyof typeof STATUS_LABELS] || o.status)
                      const isDelivered = displayStatus === 'DELIVERED'
                      const tone = displayStatus === 'FAILED' ? 'red' : (STATUS_COLORS[o.status as keyof typeof STATUS_COLORS] || 'slate')
                      return (
                        <a key={o.id} className="cust-order-row" href={`/dashboard/orders/${o.id}`}>
                          <span className="cust-order-icon"><Icon name={isDelivered ? 'check_circle' : 'local_shipping'} ariaHidden /></span>
                          <span className="cust-order-main">
                            <strong className="cust-nums">{o.orderNumber}</strong>
                            <span>{formatDate(o.createdAt)} — {(o.items || []).length} منتج</span>
                          </span>
                          <span className="cust-order-total">
                            <strong className="cust-nums">{formatCurrency(o.totalPrice)}</strong>
                            <Badge tone={tone}>{status}</Badge>
                          </span>
                        </a>
                      )
                    })
                  )}
                </div>
              )}

              {detailTab === 'timeline' && <CrmTimeline events={timeline} loading={timelineLoading} />}

              {detailTab === 'followups' && <CrmFollowUps followUps={followUps} loading={timelineLoading} onCreate={handleCreateFollowUp} onUpdateStatus={handleUpdateFollowUp} />}
            </div>
          </aside>
        )}
      </div>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="تعديل بيانات العميل — CRM" footer={<><Button variant="ghost" onClick={() => setEditOpen(false)}>إلغاء</Button><Button icon="save" loading={saving} onClick={saveEdit}>حفظ التغييرات</Button></>}>
        <Input label="الاسم" value={form.name ?? ''} onChange={(v) => setForm({ ...form, name: v })} />
        <Input label="الهاتف" value={form.phone ?? ''} onChange={(v) => setForm({ ...form, phone: v })} />
        <Input label="البريد" type="email" value={form.email ?? ''} onChange={(v) => setForm({ ...form, email: v })} />
        <Select label="المرحلة (CRM)" value={form.stage ?? (form as any).stage ?? (selected as any)?.stage ?? ''} onChange={(v) => setForm({ ...form, stage: v } as any)} placeholder="بدون مرحلة" options={CRM_STAGE_OPTIONS} />
        <Input label="الوسوم (مفصولة بفاصلة)" value={(form as any).tagsInput ?? ''} onChange={(v) => setForm({ ...form, tagsInput: v } as any)} placeholder="vip, متكرر, القاهرة" />
        <Select label="المحافظة" value={form.governorate ?? ''} onChange={(v) => setForm({ ...form, governorate: v })} placeholder="بدون" options={GOVERNORATES.map((g) => ({ value: g, label: g }))} />
        <Input label="المدينة" value={form.city ?? ''} onChange={(v) => setForm({ ...form, city: v })} />
        <Textarea label="العنوان" value={form.address ?? ''} onChange={(v) => setForm({ ...form, address: v })} rows={2} />
        <Textarea label="ملاحظة" value={form.note ?? ''} onChange={(v) => setForm({ ...form, note: v })} rows={3} />
      </Modal>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="إضافة عميل — CRM" footer={
        <>
          <Button variant="ghost" onClick={() => setAddOpen(false)}>إلغاء</Button>
          <Button onClick={addManual}>إضافة</Button>
        </>
      }>
        <Input label="الاسم" value={form.name || ''} onChange={(v) => setForm({ ...form, name: v })} required />
        <Input label="الهاتف" value={form.phone || ''} onChange={(v) => setForm({ ...form, phone: v })} required placeholder="01xxxxxxxxx" />
        <Input label="البريد" type="email" value={form.email || ''} onChange={(v) => setForm({ ...form, email: v })} />
        <Select label="المرحلة" value={(form as any).stage || ''} onChange={(v) => setForm({ ...form, stage: v } as any)} placeholder="بدون مرحلة" options={CRM_STAGE_OPTIONS} />
        <Input label="الوسوم (مفصولة بفاصلة)" value={(form as any).tagsInput || ''} onChange={(v) => setForm({ ...form, tagsInput: v } as any)} placeholder="vip, متكرر" />
        <Select label="المحافظة" value={form.governorate || ''} onChange={(v) => setForm({ ...form, governorate: v })} placeholder="اختر المحافظة" options={GOVERNORATES.map((g) => ({ value: g, label: g }))} />
        <Input label="المدينة" value={form.city || ''} onChange={(v) => setForm({ ...form, city: v })} />
        <Textarea label="العنوان" value={form.address || ''} onChange={(v) => setForm({ ...form, address: v })} rows={2} />
        <Textarea label="ملاحظة" value={form.note || ''} onChange={(v) => setForm({ ...form, note: v })} rows={2} />
      </Modal>
    </div>
  )
}
export default MerchantCustomers
