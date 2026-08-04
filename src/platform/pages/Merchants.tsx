import { FunctionalComponent, Fragment } from 'preact'
import { useState } from 'preact/hooks'
import { Link } from 'wouter'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { Table } from '../../shared/components/ui/Table'
import { Badge } from '../../shared/components/ui/Badge'
import { Button } from '../../shared/components/ui/Button'
import { Modal } from '../../shared/components/ui/Modal'
import { Input } from '../../shared/components/ui/Input'
import { Search } from '../../shared/components/ui/Search'
import { useCollection } from '../../shared/hooks/useCollection'
import { useToast } from '../../shared/hooks/useToast'
import { registerMerchant } from '../../shared/services/auth'
import { slugify, formatDate } from '../../shared/utils/format'
import type { Store, Subscription, SubscriptionPlan } from '../../shared/types'

export const PlatformMerchants: FunctionalComponent = () => {
  const storesRes = useCollection<Store>('stores', { orderBy: { field: 'createdAt' } });
  const stores = storesRes.data
  const subsRes = useCollection<Subscription>('subscriptions', { orderBy: { field: 'createdAt' } });
  const subs = subsRes.data
  const plansRes = useCollection<SubscriptionPlan>('plans', { orderBy: { field: 'priceMonthly' } });
  const plans = plansRes.data
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', ref: '', email: '', ownerName: '', password: '' })

  const filtered = stores.filter(
    (s) =>
      s.name.includes(query) ||
      (s.ref || '').includes(query) ||
      (s.ownerId || '').includes(query),
  )

  const subFor = (storeId: string) => subs.find((s) => s.storeId === storeId)

  const submit = async () => {
    if (!form.name || !form.email || !form.ownerName || !form.password) {
      toast.push('أكمل البيانات المطلوبة', undefined, 'error')
      return
    }
    if (form.password.length < 6) {
      toast.push('كلمة المرور 6 أحرف على الأقل', undefined, 'error')
      return
    }
    try {
      // Creates a real owner account + store + pending subscription so the
      // store can be impersonated and approved like any self-registered one.
      await registerMerchant({
        email: form.email,
        password: form.password,
        name: form.ownerName,
        storeName: form.name,
        storeRef: form.ref || slugify(form.name),
      })
      toast.push('تم إضافة المتجر', 'الحساب بانتظار موافقة الاشتراك', 'success')
      setOpen(false)
      setForm({ name: '', ref: '', email: '', ownerName: '', password: '' })
    } catch (err: any) {
      toast.push('فشل إضافة المتجر', err?.message || 'حدث خطأ غير متوقع', 'error')
    }
  }

  return (
    <div>
      <PageHeader
        title="التجار والمتاجر"
        subtitle={`${stores.length} متجر مسجل`}
        actions={<Button icon="add" onClick={() => setOpen(true)}>إضافة متجر</Button>}
      />
      <div className="toolbar">
        <Search value={query} onChange={setQuery} placeholder="بحث باسم المتجر أو الرابط..." />
      </div>
      <Card>
        <Table
          columns={[
            { key: 'name', header: 'المتجر', render: (s: Store) => <Link href={`/platform/stores/${s.id}`}>{s.name}</Link> },
            { key: 'ref', header: 'الرابط', render: (s: Store) => <span className="monospace">{s.ref}</span> },
            { key: 'active', header: 'الحالة', render: (s: Store) => <Badge tone={s.active ? 'green' : 'slate'}>{s.active ? 'نشط' : 'موقوف'}</Badge> },
            {
              key: 'subscription',
              header: 'الاشتراك',
              render: (s: Store) => {
                const sub = subFor(s.id)
                const plan = plans.find((p: any) => p.id === sub?.planId)
                return sub ? <span>{plan?.name || '—'}</span> : <span className="muted">بدون</span>
              },
            },
            { key: 'createdAt', header: 'تاريخ الإنشاء', render: (s: Store) => <span className="muted">{formatDate(s.createdAt)}</span> },
          ]}
          rows={filtered}
        />
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="إضافة متجر جديد" footer={<Fragment><Button variant="ghost" onClick={() => setOpen(false)}>إلغاء</Button><Button onClick={submit}>حفظ</Button></Fragment>}>
        <Input label="اسم المتجر" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
        <Input label="الرابط (ref)" value={form.ref} onChange={(v) => setForm({ ...form, ref: v })} hint="اتركه فارغاً لتوليده تلقائياً" />
        <Input label="اسم المالك" value={form.ownerName} onChange={(v) => setForm({ ...form, ownerName: v })} required />
        <Input label="بريد المالك" value={form.email} onChange={(v) => setForm({ ...form, email: v })} type="email" required />
        <Input label="كلمة مرور المالك" value={form.password} onChange={(v) => setForm({ ...form, password: v })} type="password" required hint="6 أحرف على الأقل — سيكتمل التفعيل بعد الموافقة على الاشتراك" />
      </Modal>
    </div>
  )
}
export default PlatformMerchants
