import { FunctionalComponent, Fragment } from 'preact'
import { useState } from 'preact/hooks'
import { Link } from 'wouter'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { StatsCard } from '../../shared/components/ui/StatsCard'
import { Table } from '../../shared/components/ui/Table'
import { Badge } from '../../shared/components/ui/Badge'
import { Button } from '../../shared/components/ui/Button'
import { FilterBar } from '../../shared/components/ui/FilterBar'
import { Pagination } from '../../shared/components/ui/Pagination'
import { EmptyState } from '../../shared/components/ui/EmptyState'
import { Loading } from '../../shared/components/ui/Loading'
import { Modal } from '../../shared/components/ui/Modal'
import { Input } from '../../shared/components/ui/Input'
import { Progress } from '../../shared/components/ui/Progress'
import { useToast } from '../../shared/hooks/useToast'
import { usePlatformOverview } from '../../shared/hooks/usePlatformOverview'
import { registerMerchant, approveSubscriptionCallable, deleteSelectedTestMerchantsCallable, deleteTestMerchantCallable } from '../../shared/services/auth'
import { slugify, formatDate, formatNumber } from '../../shared/utils/format'
import { storePublicUrl } from '../../shared/utils/store-url'
import {
  SUBSCRIPTION_STATUS_LABELS,
  SUBSCRIPTION_STATUS_TONES,
  ORDER_USAGE_LABELS,
  ORDER_USAGE_TONES,
} from '../../shared/utils/constants'
import type { PlatformMerchantRow } from '../../shared/types'

const SEGMENTS = [
  { label: 'الكل', value: 'all' },
  { label: 'نشط', value: 'active' },
  { label: 'موقوف', value: 'suspended' },
  { label: 'تجربة', value: 'trial' },
  { label: 'منتهي', value: 'expired' },
  { label: 'مجاني', value: 'free' },
  { label: 'مدفوع', value: 'paid' },
  { label: 'قريب من الحد', value: 'near' },
  { label: 'استنفد الحد', value: 'reached' },
]

const SORTS = [
  { value: 'usage', label: 'الأعلى استهلاكاً' },
  { value: 'remaining', label: 'الأقل متبقياً' },
  { value: 'recent', label: 'الأحدث' },
  { value: 'name', label: 'الاسم (أ-ي)' },
]

const SINGLE_DELETE_CONFIRMATION = 'Delete merchant and all associated test data?'
const BULK_DELETE_CONFIRMATION = 'DELETE SELECTED TEST MERCHANTS'

function usageProgressTone(level: PlatformMerchantRow['usageLevel']): 'primary' | 'green' | 'amber' | 'red' {
  if (level === 'reached') return 'red'
  if (level === 'near') return 'amber'
  if (level === 'approaching') return 'amber'
  if (level === 'moderate') return 'primary'
  return 'green'
}

export const PlatformMerchants: FunctionalComponent = () => {
  const { rows, loading, error, refresh } = usePlatformOverview()
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [planFilter, setPlanFilter] = useState('all')
  const [sort, setSort] = useState('usage')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 10
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', ref: '', email: '', ownerName: '', phone: '', password: '' })
  const [busyId, setBusyId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PlatformMerchantRow | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [selectedTestIds, setSelectedTestIds] = useState<string[]>([])
  const [deleteText, setDeleteText] = useState('')
  const [deleting, setDeleting] = useState(false)

  const hasLimit = (r: PlatformMerchantRow) => r.orderLimit > 0

  const inSegment = (r: PlatformMerchantRow): boolean => {
    if (statusFilter === 'all') return true
    if (statusFilter === 'active') return r.active
    if (statusFilter === 'suspended') return !r.active
    if (statusFilter === 'trial') return r.subStatus === 'trialing'
    if (statusFilter === 'expired') return r.subStatus === 'expired'
    if (statusFilter === 'free') return Number(r.planPriceMonthly || 0) === 0
    if (statusFilter === 'paid') return Number(r.planPriceMonthly || 0) > 0
    if (statusFilter === 'reached') return r.usageLevel === 'reached'
    if (statusFilter === 'near') return r.usageLevel === 'near' || r.usageLevel === 'approaching'
    return true
  }

  const filtered = rows.filter((r) => {
    const hay = `${r.storeName} ${r.ref} ${r.ownerName || ''} ${r.ownerEmail || ''}`.toLowerCase()
    const matchesQuery = !query || hay.includes(query.toLowerCase())
    const matchesPlan = planFilter === 'all' || r.planName === planFilter
    return matchesQuery && matchesPlan && inSegment(r)
  })

  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'usage') return b.usagePercent - a.usagePercent
    if (sort === 'remaining') return (a.remaining ?? Infinity) - (b.remaining ?? Infinity)
    if (sort === 'name') return a.storeName.localeCompare(b.storeName, 'ar')
    return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
  })

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const rowsPage = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((r) => ({ ...r, id: r.storeId }))

  const planNames = Array.from(new Set(rows.map((r) => r.planName).filter(Boolean))) as string[]

  const approve = async (row: PlatformMerchantRow) => {
    if (!row.subId || busyId) return
    setBusyId(row.storeId)
    try {
      await approveSubscriptionCallable({ subscriptionId: row.subId })
      toast.push('تمت الموافقة على الاشتراك', `تم تفعيل حساب ${row.storeName}`, 'success')
      await refresh()
    } catch (err: any) {
      toast.push('فشل الموافقة', err?.message || 'حدث خطأ غير متوقع', 'error')
    } finally {
      setBusyId(null)
    }
  }

  const submit = async () => {
    if (!form.name || !form.email || !form.ownerName || !form.phone || !form.password) {
      toast.push('أكمل البيانات المطلوبة', undefined, 'error')
      return
    }
    if (form.password.length < 6) {
      toast.push('كلمة المرور 6 أحرف على الأقل', undefined, 'error')
      return
    }
    try {
      await registerMerchant({
        email: form.email,
        password: form.password,
        name: form.ownerName,
        phone: form.phone,
        storeName: form.name,
        storeRef: form.ref || slugify(form.name),
      })
      toast.push('تم إضافة المتجر', 'تم إنشاء الحساب مع تفعيل التجربة المجانية', 'success')
      setOpen(false)
      setForm({ name: '', ref: '', email: '', ownerName: '', phone: '', password: '' })
      await refresh()
    } catch (err: any) {
      toast.push('فشل إضافة المتجر', err?.message || 'حدث خطأ غير متوقع', 'error')
    }
  }

  const deleteOneTestMerchant = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteTestMerchantCallable({ storeId: deleteTarget.storeId, confirmation: SINGLE_DELETE_CONFIRMATION })
      toast.push('تم حذف المتجر الاختباري', deleteTarget.storeName, 'success')
      setDeleteTarget(null)
      setDeleteText('')
      await refresh()
    } catch (err: any) {
      toast.push('فشل حذف المتجر', err?.message || 'حدث خطأ غير متوقع', 'error')
    } finally {
      setDeleting(false)
    }
  }

  const deleteSelectedTestMerchants = async () => {
    const storeIds = selectedTestIds.filter((id) => rows.some((r) => r.storeId === id && r.isTestMerchant))
    if (storeIds.length === 0) {
      toast.push('اختر متاجر اختبارية أولاً', undefined, 'error')
      return
    }
    setDeleting(true)
    try {
      const res = await deleteSelectedTestMerchantsCallable({ storeIds, confirmation: BULK_DELETE_CONFIRMATION })
      const count = (res.data as { count?: number })?.count || 0
      toast.push('تم حذف المتاجر الاختبارية', `${count} متجر`, 'success')
      setBulkDeleteOpen(false)
      setDeleteText('')
      setSelectedTestIds([])
      await refresh()
    } catch (err: any) {
      toast.push('فشل حذف المتاجر الاختبارية', err?.message || 'حدث خطأ غير متوقع', 'error')
    } finally {
      setDeleting(false)
    }
  }

  if (loading && rows.length === 0) return <Loading />

  const reached = rows.filter((r) => r.usageLevel === 'reached').length
  const near = rows.filter((r) => r.usageLevel === 'near' || r.usageLevel === 'approaching').length
  const pendingCount = rows.filter((r) => r.subStatus === 'pending').length
  const activeCount = rows.filter((r) => r.active).length
  const selectedTestCount = selectedTestIds.filter((id) => rows.some((r) => r.storeId === id && r.isTestMerchant)).length
  const visibleTestIds = rowsPage.filter((r) => r.isTestMerchant).map((r) => r.storeId)
  const allVisibleTestSelected = visibleTestIds.length > 0 && visibleTestIds.every((id) => selectedTestIds.includes(id))
  const selectedTestRows = rows.filter((r) => selectedTestIds.includes(r.storeId) && r.isTestMerchant)
  const mb = (bytes?: number) => Math.round(Number(bytes || 0) / 1024 / 1024)

  return (
    <div className="platform-operations platform-merchants-page">
      <div className="platform-page-intro">
        <PageHeader
          title="التجار والمتاجر"
          subtitle={`${rows.length} متجر مسجل`}
          actions={
            <div className="flex">
            <Button
              variant="soft"
              icon={allVisibleTestSelected ? 'done_all' : 'fact_check'}
              disabled={visibleTestIds.length === 0}
              onClick={() => {
                setSelectedTestIds((prev) => allVisibleTestSelected
                  ? prev.filter((id) => !visibleTestIds.includes(id))
                  : Array.from(new Set([...prev, ...visibleTestIds])))
              }}
            >
              {allVisibleTestSelected ? 'إلغاء تحديد الاختباري الظاهر' : 'تحديد الاختباري الظاهر'}
            </Button>
            <Button
              variant="outline"
              icon="delete"
              disabled={selectedTestCount === 0}
              onClick={() => { setBulkDeleteOpen(true); setDeleteText('') }}
            >
              حذف المحدد ({selectedTestCount})
            </Button>
            <Button icon="add" onClick={() => setOpen(true)}>إضافة متجر</Button>
            </div>
          }
        />
        <div className="platform-intro-meta">إدارة الحسابات والاشتراكات والحدود من مساحة واحدة</div>
      </div>

      {error && (
        <Card className="mb-2">
          <p className="muted" style={{ color: 'var(--danger)' }}>تعذر تحميل بيانات المنصة: {error}</p>
        </Card>
      )}

      <div className="stats-grid">
        <StatsCard title="إجمالي التجار" value={rows.length} icon="storefront" tone="primary" />
        <StatsCard title="نشط" value={activeCount} icon="check_circle" tone="green" />
        <StatsCard title="بانتظار الاشتراك" value={pendingCount} icon="hourglass" tone="amber" />
        <StatsCard title="قريب من الحد" value={near} icon="signal_cellular_alt_1_bar" tone="amber" changeLabel={`${reached} مستنفد الحد`} />
      </div>

      <Card>
        <FilterBar
          search={query}
          onSearch={(q) => { setQuery(q); setPage(1) }}
          searchPlaceholder="بحث بالاسم، الرابط، المالك..."
          segments={SEGMENTS}
          activeSegment={statusFilter}
          onSegmentChange={(s) => { setStatusFilter(s); setPage(1) }}
          actions={
            <Fragment>
              <select className="input" style={{ width: 150 }} value={planFilter} onChange={(e: any) => { setPlanFilter(e.currentTarget.value); setPage(1) }}>
                <option value="all">كل الخطط</option>
                {planNames.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <select className="input" style={{ width: 150 }} value={sort} onChange={(e: any) => setSort(e.currentTarget.value)}>
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </Fragment>
          }
        />
        {sorted.length === 0 ? (
          <EmptyState icon="storefront" title="لا توجد متاجر" description={query || planFilter !== 'all' || statusFilter !== 'all' ? 'لا توجد نتائج مطابقة للفلترة' : 'لم يتم إضافة أي متاجر بعد'} />
        ) : (
          <Table
            cardMode
            columns={[
              {
                key: 'select',
                header: 'تحديد',
                render: (r: PlatformMerchantRow & { id: string }) => r.isTestMerchant ? (
                  <input
                    type="checkbox"
                    aria-label={`تحديد ${r.storeName}`}
                    checked={selectedTestIds.includes(r.storeId)}
                    onChange={(e: any) => {
                      const checked = !!e.currentTarget.checked
                      setSelectedTestIds((prev) => checked ? Array.from(new Set([...prev, r.storeId])) : prev.filter((id) => id !== r.storeId))
                    }}
                  />
                ) : <span className="muted">—</span>,
              },
              {
                key: 'store',
                header: 'المتجر',
                render: (r: PlatformMerchantRow & { id: string }) => (
                  <div>
                    <Link href={`/platform/stores/${r.storeId}`} className="font-semibold">{r.storeName}</Link>
                    <div className="muted small">{storePublicUrl(r)}</div>
                  </div>
                ),
              },
              {
                key: 'owner',
                header: 'المالك',
                render: (r) => (
                  <div>
                    <div>{r.ownerName || '—'}</div>
                    <div className="muted small">{r.ownerEmail || ''}</div>
                  </div>
                ),
              },
              {
                key: 'plan',
                header: 'الخطة',
                render: (r) => (
                  <div>
                    <div>{r.planName || '—'}</div>
                    {r.subStatus && (
                      <div className="mt-1"><Badge tone={SUBSCRIPTION_STATUS_TONES[r.subStatus] || 'slate'}>{SUBSCRIPTION_STATUS_LABELS[r.subStatus]}</Badge></div>
                    )}
                  </div>
                ),
              },
              {
                key: 'usage',
                header: 'الطلبات',
                render: (r) =>
                  hasLimit(r) ? (
                    <div style={{ minWidth: 160 }}>
                      <div className="flex-between small">
                        <span className="font-semibold">{formatNumber(r.ordersUsed)} / {formatNumber(r.orderLimit)}</span>
                        <span className="muted">{r.usagePercent}%</span>
                      </div>
                      <Progress value={r.ordersUsed} max={r.orderLimit} tone={usageProgressTone(r.usageLevel)} />
                      <div className="muted small mt-1">المتبقي: {formatNumber(r.remaining ?? 0)}</div>
                    </div>
                  ) : (
                    <span className="muted">—</span>
                  ),
              },
              {
                key: 'products',
                header: 'المنتجات',
                render: (r) => (
                  <span className="muted small">
                    {formatNumber(r.productsUsed || 0)}
                    {r.productLimit > 0 ? ` / ${formatNumber(r.productLimit)}` : ' / غير محدود'}
                  </span>
                ),
              },
              {
                key: 'storage',
                header: 'التخزين',
                render: (r) => (
                  <span className="muted small">
                    {formatNumber(mb(r.storageUsed))} / {formatNumber(mb(r.storageLimitBytes))} MB
                  </span>
                ),
              },
              {
                key: 'level',
                header: 'الحالة',
                render: (r) => <Badge tone={ORDER_USAGE_TONES[r.usageLevel]}>{ORDER_USAGE_LABELS[r.usageLevel]}</Badge>,
              },
              {
                key: 'expiry',
                header: 'انتهاء الاشتراك',
                render: (r) => <span className="muted">{formatDate(r.subExpiresAt)}</span>,
              },
              {
                key: 'published',
                header: 'النشر',
                render: (r) => {
                  if (!r.active) return <Badge tone="slate">موقوف</Badge>
                  return r.published ? <Badge tone="green">منشور</Badge> : <Badge tone="amber">مسودة</Badge>
                },
              },
              {
                key: 'actions',
                header: 'إجراءات',
                render: (r) => (
                  <div className="flex">
                    <Link href={`/platform/stores/${r.storeId}`}>
                      <Button variant="ghost" size="sm" icon="visibility">عرض</Button>
                    </Link>
                    {r.subStatus === 'pending' && r.subId && (
                      <Button size="sm" icon="check" loading={busyId === r.storeId} onClick={() => approve(r)}>موافقة</Button>
                    )}
                    {r.isTestMerchant && (
                      <Button
                        variant="danger"
                        size="sm"
                        icon="delete"
                        onClick={() => { setDeleteTarget(r); setDeleteText('') }}
                      >
                        حذف اختباري
                      </Button>
                    )}
                  </div>
                ),
              },
            ]}
            rows={rowsPage}
          />
        )}
        {sorted.length > PAGE_SIZE && (
          <Pagination
            page={page}
            totalPages={totalPages}
            pageSize={PAGE_SIZE}
            total={sorted.length}
            onPageChange={(p) => { setPage(p); window.scrollTo(0, 0) }}
          />
        )}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="إضافة متجر جديد" footer={<Fragment><Button variant="ghost" onClick={() => setOpen(false)}>إلغاء</Button><Button onClick={submit}>حفظ</Button></Fragment>}>
        <Input label="اسم المتجر" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
        <Input label="الرابط (ref)" value={form.ref} onChange={(v) => setForm({ ...form, ref: v })} hint="اتركه فارغاً لتوليده تلقائياً — سيمنع الازدواج تلقائياً" />
        <Input label="اسم المالك" value={form.ownerName} onChange={(v) => setForm({ ...form, ownerName: v })} required />
        <Input label="بريد المالك" value={form.email} onChange={(v) => setForm({ ...form, email: v })} type="email" required />
        <Input label="رقم هاتف المالك" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} type="tel" required />
        <Input label="كلمة مرور المالك" value={form.password} onChange={(v) => setForm({ ...form, password: v })} type="password" required hint="6 أحرف على الأقل — يُفعّل الاشتراك فوراً مع التجربة المجانية" />
      </Modal>

      <Modal
        open={!!deleteTarget}
        onClose={() => { setDeleteTarget(null); setDeleteText('') }}
        title="حذف متجر اختباري"
        footer={
          <Fragment>
            <Button variant="ghost" onClick={() => { setDeleteTarget(null); setDeleteText('') }}>إلغاء</Button>
            <Button
              variant="danger"
              loading={deleting}
              disabled={deleteText !== SINGLE_DELETE_CONFIRMATION}
              onClick={deleteOneTestMerchant}
            >
              حذف المتجر وبياناته
            </Button>
          </Fragment>
        }
      >
        {deleteTarget && (
          <div className="delete-identity mb-2">
            <strong>{deleteTarget.storeName}</strong>
            <span>{storePublicUrl(deleteTarget)}</span>
            <Badge tone="amber">TEST ONLY</Badge>
          </div>
        )}
        <p className="muted small mb-2">
          سيحذف هذا الإجراء المتجر الاختباري وكل بياناته المرتبطة من قاعدة البيانات والتخزين وحسابات الفريق. لا يعمل إلا مع المتاجر المحددة كاختبارية.
        </p>
        <Input
          label={`اكتب نص التأكيد: ${SINGLE_DELETE_CONFIRMATION}`}
          value={deleteText}
          onChange={setDeleteText}
        />
      </Modal>

      <Modal
        open={bulkDeleteOpen}
        onClose={() => { setBulkDeleteOpen(false); setDeleteText('') }}
        title="حذف المتاجر الاختبارية المحددة"
        footer={
          <Fragment>
            <Button variant="ghost" onClick={() => { setBulkDeleteOpen(false); setDeleteText('') }}>إلغاء</Button>
            <Button
              variant="danger"
              loading={deleting}
              disabled={deleteText !== BULK_DELETE_CONFIRMATION || selectedTestCount === 0}
              onClick={deleteSelectedTestMerchants}
            >
              حذف المحدد فقط
            </Button>
          </Fragment>
        }
      >
        {selectedTestRows.length > 0 && (
          <div className="delete-identity-list mb-2">
            {selectedTestRows.slice(0, 8).map((r) => (
              <div key={r.storeId} className="delete-identity">
                <strong>{r.storeName}</strong>
                <span>{storePublicUrl(r)}</span>
                <Badge tone="amber">TEST ONLY</Badge>
              </div>
            ))}
            {selectedTestRows.length > 8 && <p className="muted small">و {selectedTestRows.length - 8} متجر اختباري آخر.</p>}
          </div>
        )}
        <p className="muted small mb-2">
          سيحذف هذا الإجراء {selectedTestCount} متجر اختباري محدد فقط. أي متجر غير محدد كاختباري سيرفضه الخادم.
        </p>
        <Input
          label={`اكتب نص التأكيد: ${BULK_DELETE_CONFIRMATION}`}
          value={deleteText}
          onChange={setDeleteText}
        />
      </Modal>
    </div>
  )
}
export default PlatformMerchants
