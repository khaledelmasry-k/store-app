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
import { formatCurrency } from '../../shared/utils/format'
import type { StoreLink } from '../../shared/types'

export const MerchantStoreLinks: FunctionalComponent = () => {
  const { store } = useStore()
  const storeId = store?.id || ''
  const linksRes = useCollection<StoreLink>('storeLinks', { storeId })
  const links = linksRes.data
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<StoreLink | null>(null)
  const [form, setForm] = useState<Partial<StoreLink>>({ active: true })

  const submit = async () => {
    if (!form.code || !form.sellerName) {
      toast.push('أدخل الكود واسم البائع', undefined, 'error')
      return
    }
    await storeLinksService.create(storeId, {
      code: form.code,
      sellerName: form.sellerName,
      title: form.title || '',
      active: form.active ?? true,
      visits: 0,
      ordersCount: 0,
      totalRevenue: 0,
      createdBy: '',
    })
    toast.push('تم إنشاء رابط البيع')
    setOpen(false)
    setForm({ active: true })
  }

  const remove = async () => {
    if (!deleteTarget) return
    await storeLinksService.remove(deleteTarget.id)
    toast.push('تم حذف رابط البيع')
    setDeleteTarget(null)
  }

  if (linksRes.loading) return <Loading />

  const totalClicks = links.reduce((s, l) => s + (l.visits || 0), 0)
  const totalOrders = links.reduce((s, l) => s + (l.ordersCount || 0), 0)

  return (
    <div>
      <PageHeader title="روابط البيع" subtitle={`${links.length} رابط`} actions={<Button icon="add" onClick={() => setOpen(true)}>رابط جديد</Button>} />

      <div className="stats-grid">
        <StatsCard title="إجمالي الروابط" value={links.length} icon="link" tone="primary" />
        <StatsCard title="إجمالي النقرات" value={totalClicks} icon="visibility" tone="blue" />
        <StatsCard title="إجمالي الطلبات" value={totalOrders} icon="shopping_cart" tone="green" />
      </div>

      <Card>
        <Table cardMode
          columns={[
            { key: 'sellerName', header: 'البائع' },
            { key: 'code', header: 'الكود', render: (l: StoreLink) => <span className="monospace small">{l.code}</span> },
            { key: 'title', header: 'العنوان' },
            { key: 'visits', header: 'النقرات', render: (l: StoreLink) => <Badge tone="blue">{l.visits || 0}</Badge> },
            { key: 'ordersCount', header: 'الطلبات', render: (l: StoreLink) => <Badge tone="green">{l.ordersCount || 0}</Badge> },
            { key: 'totalRevenue', header: 'الإيرادات', render: (l: StoreLink) => formatCurrency(l.totalRevenue || 0) },
            { key: 'active', header: 'الحالة', render: (l: StoreLink) => <Badge tone={l.active ? 'green' : 'slate'}>{l.active ? 'نشط' : 'موقوف'}</Badge> },
            { key: 'actions', header: '', render: (l: StoreLink) => <button className="icon-btn" onClick={() => setDeleteTarget(l)}><span className="material-symbols-outlined">delete</span></button> },
          ]}
          rows={links}
        />
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="رابط بيع جديد">
        <Input label="اسم البائع" value={form.sellerName || ''} onChange={(v) => setForm({ ...form, sellerName: v })} required />
        <Input label="كود التتبع" value={form.code || ''} onChange={(v) => setForm({ ...form, code: v })} required placeholder="SELLER-001" />
        <Input label="العنوان" value={form.title || ''} onChange={(v) => setForm({ ...form, title: v })} />
        <div className="field">
          <Toggle checked={form.active ?? true} onChange={(v) => setForm({ ...form, active: v })} label="نشط" />
        </div>
        <div className="flex flex-end">
          <Button variant="ghost" onClick={() => setOpen(false)}>إلغاء</Button>
          <Button onClick={submit}>حفظ</Button>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onCancel={() => setDeleteTarget(null)} onConfirm={remove} title="حذف رابط البيع" description={`سيتم حذف رابط "${deleteTarget?.sellerName}"`} confirmLabel="حذف" />
    </div>
  )
}
export default MerchantStoreLinks