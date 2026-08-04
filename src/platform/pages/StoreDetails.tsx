import { FunctionalComponent } from 'preact'
import { useState } from 'preact/hooks'
import { signInWithCustomToken } from 'firebase/auth'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { StatsCard } from '../../shared/components/ui/StatsCard'
import { Table } from '../../shared/components/ui/Table'
import { Badge } from '../../shared/components/ui/Badge'
import { Button } from '../../shared/components/ui/Button'
import { Toggle } from '../../shared/components/ui/Toggle'
import { Modal } from '../../shared/components/ui/Modal'
import { Input } from '../../shared/components/ui/Input'
import { useDocument } from '../../shared/hooks/useDocument'
import { useCollection } from '../../shared/hooks/useCollection'
import { useToast } from '../../shared/hooks/useToast'
import { storesService } from '../../shared/services/stores'
import { impersonateCallable } from '../../shared/services/auth'
import { auth } from '../../shared/firebase'
import { formatCurrency, formatDate } from '../../shared/utils/format'
import { STATUS_LABELS } from '../../shared/utils/constants'
import type { Store, Order } from '../../shared/types'

interface Props {
  id: string
}

export const StoreDetails: FunctionalComponent<Props> = ({ id }) => {
  const { data: store, loading } = useDocument<Store>('stores', id)
  const ordersRes = useCollection<Order>('orders', { storeId: id, orderBy: { field: 'createdAt' } });
  const orders = ordersRes.data
  const productsRes = useCollection('products', { storeId: id });
  const products = productsRes.data
  const toast = useToast()
  const [editOpen, setEditOpen] = useState(false)
  const [form, setForm] = useState<Partial<Store>>({})
  const [impersonating, setImpersonating] = useState(false)

  if (loading) return <div className="loading-screen"><span className="spinner spinner-lg" /></div>

  const revenue = orders.filter((o) => o.status === 'DELIVERED').reduce((s, o) => s + o.totalPrice, 0)
  const pending = orders.filter((o) => ['NEW', 'CONTACTED', 'PROCESSING', 'SHIPPED'].includes(o.status))

  const save = async () => {
    await storesService.update(id, form)
    toast.push('تم حفظ التعديلات')
    setEditOpen(false)
  }

  // Deliberate "Impersonate Merchant" action — platform admin inspects the store
  // as its owner. Auth switches to a custom token; AppShell shows the exit banner.
  const impersonate = async () => {
    setImpersonating(true)
    try {
      const res = await impersonateCallable({ storeId: id })
      const token = (res.data as any)?.customToken
      if (!token) throw new Error('no token')
      await signInWithCustomToken(auth, token)
      window.location.href = '/dashboard/'
    } catch {
      toast.push('تعذر فتح المتجر', 'تحقق من أن مالك المتجر حساب نشط', 'error')
    } finally {
      setImpersonating(false)
    }
  }

  return (
    <div>
      <PageHeader
        title={store?.name || 'المتجر'}
        subtitle={`الرابط: ${store?.ref} • ${store?.slug}`}
        breadcrumb="المتاجر"
        actions={
          <div className="flex" style={{ gap: 8 }}>
            <Button variant="outline" icon="storefront" onClick={() => window.open(`/store/${store?.slug}`, '_blank')}>عرض المتجر</Button>
            <Button variant="outline" icon="admin_panel_settings" onClick={impersonate} loading={impersonating}>فتح كتاجر</Button>
            <Button variant="outline" icon="edit" onClick={() => { setForm(store || {}); setEditOpen(true) }}>تعديل</Button>
          </div>
        }
      />
      <div className="stats-grid">
        <StatsCard title="الطلبات" value={orders.length} icon="receipt_long" tone="primary" />
        <StatsCard title="المنتجات" value={products.length} icon="inventory_2" tone="blue" />
        <StatsCard title="إيرادات مؤكدة" value={revenue} currency icon="payments" tone="green" />
        <StatsCard title="طلبات معلقة" value={pending.length} icon="pending" tone="amber" />
      </div>
      <div className="grid grid-2">
        <Card title="بيانات المتجر">
          <dl className="kv">
            <div className="kv-item"><dt>الاسم</dt><dd>{store?.name}</dd></div>
            <div className="kv-item"><dt>الحالة</dt><dd>{store?.active ? 'نشط' : 'موقوف'}</dd></div>
            <div className="kv-item"><dt>العملة</dt><dd>{store?.currency}</dd></div>
            <div className="kv-item"><dt>تاريخ الإنشاء</dt><dd>{formatDate(store?.createdAt)}</dd></div>
          </dl>
        </Card>
        <Card title="حالة الطلبات">
          <Table
            columns={[
              { key: 'status', header: 'الحالة' },
              { key: 'count', header: 'العدد' },
              { key: 'amount', header: 'القيمة' },
            ]}
            rows={Object.entries(STATUS_LABELS).map(([k, label]) => ({
              id: k,
              status: <Badge>{label}</Badge>,
              count: orders.filter((o) => o.status === k).length,
              amount: formatCurrency(orders.filter((o) => o.status === k).reduce((s, o) => s + o.totalPrice, 0)),
            }))}
          />
        </Card>
      </div>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="تعديل المتجر">
        <Input label="اسم المتجر" value={form.name || ''} onChange={(v) => setForm({ ...form, name: v })} />
        <Input label="الرابط" value={form.ref || ''} onChange={(v) => setForm({ ...form, ref: v })} />
        <div className="field">
          <span className="field-label">متجر نشط</span>
          <Toggle checked={!!form.active} onChange={(v) => setForm({ ...form, active: v })} />
        </div>
        <div className="flex" style={{ justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={() => setEditOpen(false)}>إلغاء</Button>
          <Button onClick={save}>حفظ</Button>
        </div>
      </Modal>
    </div>
  )
}
export default StoreDetails
