import { FunctionalComponent } from 'preact'
import { useState } from 'preact/hooks'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { StatsCard } from '../../shared/components/ui/StatsCard'
import { Table } from '../../shared/components/ui/Table'
import { Badge } from '../../shared/components/ui/Badge'
import { Button } from '../../shared/components/ui/Button'
import { Modal } from '../../shared/components/ui/Modal'
import { Input } from '../../shared/components/ui/Input'
import { Toggle } from '../../shared/components/ui/Toggle'
import { ConfirmDialog } from '../../shared/components/ui/ConfirmDialog'
import { Loading } from '../../shared/components/ui/Loading'
import { useStore } from '../../shared/hooks/useStore'
import { useCollection } from '../../shared/hooks/useCollection'
import { useToast } from '../../shared/hooks/useToast'
import { storeLinksService } from '../../shared/services/system'
import { createSalesLinkCallable } from '../../shared/services/auth'
import { formatCurrency } from '../../shared/utils/format'
import { storeBaseUrl } from '../../shared/utils/store-url'
import type { StoreLink, StoreLinkDestinationType } from '../../shared/types'
import { Icon } from '../../shared/components/ui/Icon'

const DESTINATION_LABELS: Record<StoreLinkDestinationType, string> = {
  home: 'الرئيسية',
  catalog: 'كل المنتجات',
  product: 'منتج محدد',
  landing: 'صفحة هبوط',
  custom: 'مسار مخصص',
}

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
  const linksRes = useCollection<StoreLink>('storeLinks', { storeId })
  const links = linksRes.data.filter((l) => !l.archived)
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<StoreLink | null>(null)
  const [form, setForm] = useState<Draft>({
    name: '', code: '', sellerName: '', destinationType: 'home', destinationId: '', source: '', campaign: '', content: '', active: true, archived: false,
  })

  const publicUrl = (code: string) => `${storeBaseUrl()}/s/${code}`

  const submit = async () => {
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
    try {
      if (form.id) {
        await storeLinksService.update(form.id, data)
        toast.push('تم تحديث الرابط')
      } else {
        await createSalesLinkCallable({ storeId, data })
        toast.push('تم إنشاء رابط البيع')
      }
      setOpen(false)
      setForm({ name: '', code: '', sellerName: '', destinationType: 'home', destinationId: '', source: '', campaign: '', content: '', active: true, archived: false })
    } catch (err: any) {
      toast.push('فشل حفظ الرابط', err?.message || 'حدث خطأ غير متوقع', 'error')
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

  if (linksRes.loading) return <Loading />

  const totalClicks = links.reduce((s, l) => s + (l.visits || 0), 0)
  const totalOrders = links.reduce((s, l) => s + (l.ordersCount || 0), 0)
  const totalRevenue = links.reduce((s, l) => s + (l.totalRevenue || 0), 0)

  return (
    <div>
      <PageHeader title="روابط البيع" subtitle={`${links.length} رابط`} actions={<Button icon="add" onClick={() => setOpen(true)}>رابط جديد</Button>} />

      <div className="stats-grid">
        <StatsCard title="إجمالي الروابط" value={links.length} icon="link" tone="primary" />
        <StatsCard title="إجمالي النقرات" value={totalClicks} icon="visibility" tone="blue" />
        <StatsCard title="طلبات مكتملة" value={totalOrders} icon="shopping_cart" tone="green" />
        <StatsCard title="إيرادات مسلّمة" value={formatCurrency(totalRevenue)} icon="payments" tone="indigo" />
      </div>

      <Card>
        <Table cardMode
          columns={[
            { key: 'name', header: 'الاسم' },
            { key: 'code', header: 'الرابط', render: (l: StoreLink) => <button className="link-chip" onClick={() => copyLink(l.code)} title="نسخ الرابط"><span className="monospace small">{l.code}</span> <Icon name="content_copy" /></button> },
            { key: 'destinationType', header: 'الوجهة', render: (l: StoreLink) => DESTINATION_LABELS[l.destinationType] || l.destinationType },
            { key: 'visits', header: 'النقرات', render: (l: StoreLink) => <Badge tone="blue">{l.visits || 0}</Badge> },
            { key: 'ordersCount', header: 'طلبات مسلّمة', render: (l: StoreLink) => <Badge tone="green">{l.ordersCount || 0}</Badge> },
            { key: 'totalRevenue', header: 'الإيرادات', render: (l: StoreLink) => formatCurrency(l.totalRevenue || 0) },
            { key: 'active', header: 'الحالة', render: (l: StoreLink) => <Badge tone={l.active ? 'green' : 'slate'}>{l.active ? 'نشط' : 'موقوف'}</Badge> },
            { key: 'actions', header: '', render: (l: StoreLink) => (
              <div className="flex gap-1">
                <button className="icon-btn" onClick={() => { setForm({ id: l.id, name: l.name, code: l.code, sellerName: l.sellerName || '', destinationType: l.destinationType, destinationId: l.destinationId || '', source: l.source || '', campaign: l.campaign || '', content: l.content || '', active: l.active ?? true, archived: false }); setOpen(true) }} title="تعديل"><Icon name="edit" /></button>
                <button className="icon-btn" onClick={() => archive(l)} title="أرشفة"><Icon name="archive" /></button>
                <button className="icon-btn icon-btn-danger" onClick={() => setDeleteTarget(l)}><Icon name="delete" /></button>
              </div>
            ) },
          ]}
          rows={links}
        />
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title={form.id ? 'تعديل رابط بيع' : 'رابط بيع جديد'}>
        <Input label="اسم الرابط" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required placeholder="مثال: رابط بائع أكتوبر" />
        <div className="grid grid-2">
          <Input label="كود التتبع" value={form.code} onChange={(v) => setForm({ ...form, code: v })} placeholder={randomCode()} hint="فارغ = يُنشأ تلقائياً" />
          <Input label="اسم البائع (اختياري)" value={form.sellerName} onChange={(v) => setForm({ ...form, sellerName: v })} />
        </div>
        <div className="field">
          <span className="field-label">الوجهة</span>
          <select className="input" value={form.destinationType} onChange={(e) => setForm({ ...form, destinationType: (e.target as HTMLSelectElement).value as StoreLinkDestinationType })}>
            {(Object.keys(DESTINATION_LABELS) as StoreLinkDestinationType[]).map((k) => <option key={k} value={k}>{DESTINATION_LABELS[k]}</option>)}
          </select>
        </div>
        {form.destinationType === 'product' && (
          <Input label="معرف المنتج" value={form.destinationId} onChange={(v) => setForm({ ...form, destinationId: v })} placeholder="ألصق معرف المنتج من صفحة المنتج" />
        )}
        {form.destinationType === 'landing' && (
          <Input label="رابط صفحة الهبوط (slug)" value={form.destinationId} onChange={(v) => setForm({ ...form, destinationId: v })} placeholder="landing-slug" />
        )}
        {form.destinationType === 'custom' && (
          <Input label="المسار المخصص" value={form.destinationId} onChange={(v) => setForm({ ...form, destinationId: v })} placeholder="/catalog أو /product/abc" />
        )}
        <div className="grid grid-3">
          <Input label="المصدر" value={form.source} onChange={(v) => setForm({ ...form, source: v })} placeholder="facebook" />
          <Input label="الحملة" value={form.campaign} onChange={(v) => setForm({ ...form, campaign: v })} placeholder="رمضان" />
          <Input label="المحتوى" value={form.content} onChange={(v) => setForm({ ...form, content: v })} placeholder="ad-1" />
        </div>
        <div className="field">
          <Toggle checked={form.active} onChange={(v) => setForm({ ...form, active: v })} label="نشط" />
        </div>
        <div className="flex flex-end">
          <Button variant="ghost" onClick={() => setOpen(false)}>إلغاء</Button>
          <Button onClick={submit}>حفظ</Button>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onCancel={() => setDeleteTarget(null)} onConfirm={async () => { if (deleteTarget) { await storeLinksService.remove(deleteTarget.id); toast.push('تم حذف الرابط'); setDeleteTarget(null) } }} title="حذف رابط البيع" description={`سيتم حذف "${deleteTarget?.name}"`} confirmLabel="حذف" />
    </div>
  )
}
export default MerchantStoreLinks
