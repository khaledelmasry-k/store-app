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
import { formatCurrency } from '../../shared/utils/format'
import type { StoreLink } from '../../shared/types'

export const MerchantStoreLinks: FunctionalComponent = () => {
  const { store } = useStore()
  const storeId = store?.id || ''
  const linksRes = useCollection<StoreLink>('storeLinks', { storeId });
  const links = linksRes.data
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [sellerName, setSellerName] = useState('')

  const submit = async () => {
    if (!title) return
    await storeLinksService.create(storeId, {
      code: generateToken(8),
      title,
      active: true,
      visits: 0,
      ordersCount: 0,
      totalRevenue: 0,
      sellerName: sellerName.trim() || null,
      staffId: '',
      createdBy: '',
    })
    toast.push('تم إنشاء الرابط')
    setOpen(false)
    setTitle('')
    setSellerName('')
  }

  const copy = (code: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/store/${store?.slug}?ref=${code}`)
    toast.push('تم نسخ الرابط')
  }

  const linkUrl = (code: string) => `${window.location.origin}/store/${store?.slug}?ref=${code}`

  return (
    <div>
      <PageHeader title="روابط البيع" subtitle={`${links.length} رابط تسويقي`} actions={<Button icon="add" onClick={() => setOpen(true)}>رابط جديد</Button>} />
      <Card>
        <Table
          columns={[
            { key: 'title', header: 'الاسم' },
            { key: 'seller', header: 'الموظف/المسوّق', render: (l: StoreLink) => <><span className="muted">{l.sellerName || '—'}</span></> },
            { key: 'code', header: 'الكود', render: (l: StoreLink) => <span className="monospace">{l.code}</span> },
            { key: 'visits', header: 'الزيارات', render: (l: StoreLink) => <Badge>{l.visits || 0}</Badge> },
            { key: 'orders', header: 'الطلبات', render: (l: StoreLink) => <Badge tone="indigo">{l.ordersCount || 0}</Badge> },
            { key: 'revenue', header: 'الإيرادات', render: (l: StoreLink) => <span className="stat-value" style={{ fontSize: '0.9rem' }}>{formatCurrency(l.totalRevenue || 0)}</span> },
            { key: 'conversion', header: 'التحويل', render: (l: StoreLink) => { const v = l.visits || 0; return <Badge tone="amber">{v ? ((l.ordersCount || 0) / v * 100).toFixed(1) + '%' : '—'}</Badge> } },
            { key: 'active', header: 'الحالة', render: (l: StoreLink) => <Badge tone={l.active ? 'green' : 'slate'}>{l.active ? 'نشط' : 'موقوف'}</Badge> },
            { key: 'actions', header: '', render: (l: StoreLink) => <div className="flex" style={{ gap: 4 }}><Button variant="ghost" size="sm" icon="link" onClick={() => copy(l.code)}>نسخ</Button><Button variant="ghost" size="sm" icon="open_in_new" onClick={() => window.open(linkUrl(l.code), '_blank')}>فتح</Button></div> },
          ]}
          rows={links}
        />
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="رابط بيع جديد" footer={<Fragment><Button variant="ghost" onClick={() => setOpen(false)}>إلغاء</Button><Button onClick={submit}>إنشاء</Button></Fragment>}>
        <Input label="اسم الرابط / الحملة" value={title} onChange={setTitle} placeholder="حملة رمضان" required />
        <Input label="اسم الموظف أو المسوّق (اختياري)" value={sellerName} onChange={setSellerName} placeholder="أحمد" hint="اربط الرابط بموظف أو مسوّق لمعرفة أدائه عبر الرابط" />
      </Modal>
    </div>
  )
}
export default MerchantStoreLinks
