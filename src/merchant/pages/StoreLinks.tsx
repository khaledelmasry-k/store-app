import { FunctionalComponent, Fragment } from 'preact'
import { useState } from 'preact/hooks'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { Table } from '../../shared/components/ui/Table'
import { Badge } from '../../shared/components/ui/Badge'
import { Button } from '../../shared/components/ui/Button'
import { Modal } from '../../shared/components/ui/Modal'
import { Input } from '../../shared/components/ui/Input'
import { useStore } from '../../shared/hooks/useStore'
import { useCollection } from '../../shared/hooks/useCollection'
import { useToast } from '../../shared/hooks/useToast'
import { storeLinksService } from '../../shared/services/system'
import { generateToken } from '../../shared/utils/validators'
import { formatCurrency, formatDate } from '../../shared/utils/format'
import type { StoreLink } from '../../shared/types'

export const MerchantStoreLinks: FunctionalComponent = () => {
  const { store } = useStore()
  const storeId = store?.id || ''
  const linksRes = useCollection<StoreLink>('storeLinks', { storeId });
  const links = linksRes.data
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')

  const submit = async () => {
    if (!title) return
    await storeLinksService.create(storeId, {
      code: generateToken(8),
      title,
      active: true,
      visits: 0,
      ordersCount: 0,
      totalRevenue: 0,
      createdBy: '',
    })
    toast.push('تم إنشاء الرابط')
    setOpen(false)
    setTitle('')
  }

  const copy = (code: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/store/${store?.slug}?ref=${code}`)
    toast.push('تم نسخ الرابط')
  }

  return (
    <div>
      <PageHeader title="روابط المتجر" subtitle={`${links.length} رابط تسويقي`} actions={<Button icon="add" onClick={() => setOpen(true)}>رابط جديد</Button>} />
      <Card>
        <Table
          columns={[
            { key: 'title', header: 'الاسم' },
            { key: 'code', header: 'الكود', render: (l: StoreLink) => <span className="monospace">{l.code}</span> },
            { key: 'visits', header: 'الزيارات', render: (l: StoreLink) => <Badge>{l.visits || 0}</Badge> },
            { key: 'orders', header: 'الطلبات', render: (l: StoreLink) => <Badge tone="indigo">{l.ordersCount || 0}</Badge> },
            { key: 'revenue', header: 'الإيرادات', render: (l: StoreLink) => <span className="stat-value" style={{ fontSize: '0.9rem' }}>{formatCurrency(l.totalRevenue || 0)}</span> },
            { key: 'active', header: 'الحالة', render: (l: StoreLink) => <Badge tone={l.active ? 'green' : 'slate'}>{l.active ? 'نشط' : 'موقوف'}</Badge> },
            { key: 'createdAt', header: 'التاريخ', render: (l: StoreLink) => <span className="muted">{formatDate(l.createdAt)}</span> },
            { key: 'actions', header: '', render: (l: StoreLink) => <Button variant="ghost" size="sm" icon="link" onClick={() => copy(l.code)}>نسخ</Button> },
          ]}
          rows={links}
        />
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="رابط تسويقي جديد" footer={<Fragment><Button variant="ghost" onClick={() => setOpen(false)}>إلغاء</Button><Button onClick={submit}>إنشاء</Button></Fragment>}>
        <Input label="اسم الرابط" value={title} onChange={setTitle} placeholder="حملة رمضان" required />
      </Modal>
    </div>
  )
}
export default MerchantStoreLinks
