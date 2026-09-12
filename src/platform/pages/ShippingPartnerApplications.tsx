import { FunctionalComponent } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { Button } from '../../shared/components/ui/Button'
import { listShippingPartnerApplicationsCallable, updateShippingPartnerApplicationCallable, approveShippingPartnerApplicationCallable } from '../../shared/services/auth'

export const ShippingPartnerApplications: FunctionalComponent = () => {
  const [items, setItems] = useState<any[]>([])
  const load = () => listShippingPartnerApplicationsCallable().then((r: any) => setItems(r.data?.applications || [])).catch(() => setItems([]))
  useEffect(() => { void load() }, [])
  const setStatus = async (id: string, status: string) => { await updateShippingPartnerApplicationCallable({ id, status }); await load() }
  const approve = async (id: string) => { await approveShippingPartnerApplicationCallable({ id }); await load() }
  return <div className="stack-list"><PageHeader title="طلبات الشراكة" subtitle="مراجعة طلبات شركات الشحن دون كشف أي أسرار تكامل." /><div className="stack-list">{items.map((item) => <Card key={item.id} title={item.companyName}><p>{item.contactName} · {item.businessEmail}</p><p className="muted">{item.websiteUrl || '—'} · الحالة: {item.status}</p><div className="flex" style={{ gap: 8, flexWrap: 'wrap' }}><Button size="sm" variant="outline" onClick={() => setStatus(item.id, 'reviewing')}>قيد المراجعة</Button><Button size="sm" onClick={() => approve(item.id)}>اعتماد وإنشاء مسودة</Button><Button size="sm" variant="ghost" onClick={() => setStatus(item.id, 'rejected')}>رفض</Button></div></Card>)}{items.length === 0 && <Card><p className="muted">لا توجد طلبات شراكة حالياً.</p></Card>}</div></div>
}
export default ShippingPartnerApplications
