import { FunctionalComponent } from 'preact'
import { useState } from 'preact/hooks'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { Button } from '../../shared/components/ui/Button'
import { Input } from '../../shared/components/ui/Input'
import { Badge } from '../../shared/components/ui/Badge'
import { useCollection } from '../../shared/hooks/useCollection'
import { createDoc, updateDocById } from '../../shared/utils/firestore'
import type { ShippingCompany } from '../../shared/types'

export const PlatformShippingCompanies: FunctionalComponent = () => {
  const companies = useCollection<ShippingCompany>('shippingCompanies', {}, true)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const save = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      await createDoc('shippingCompanies', { name: name.trim(), status: 'active', averageRating: 0, reviewsCount: 0, completedShipments: 0, deliverySuccessRate: 0, ratesByZone: {} })
      setName('')
    } finally { setSaving(false) }
  }
  return <div className="platform-operations platform-shipping-companies-page">
    <PageHeader title="شركات الشحن" subtitle="إدارة الشركات والمعدلات والبيانات التشغيلية الموثقة" />
    <Card title="إضافة شركة شحن" className="mb-2"><div className="toolbar"><Input label="اسم الشركة" value={name} onChange={setName} placeholder="مثال: شركة التوصيل" /><Button loading={saving} onClick={save}>إضافة</Button></div></Card>
    <div className="card-grid">
      {companies.data.map((company) => <Card key={company.id} title={company.name} actions={<Badge tone={company.status === 'active' ? 'green' : 'slate'}>{company.status === 'active' ? 'نشطة' : 'متوقفة'}</Badge>}>
        <div className="grid grid-3"><span>★ {Number(company.averageRating || 0).toFixed(1)}<small className="muted"> التقييم</small></span><span>{company.reviewsCount || 0}<small className="muted"> مراجعة</small></span><span>{company.completedShipments || 0}<small className="muted"> شحنة</small></span></div>
        <Button size="sm" variant="outline" onClick={() => updateDocById('shippingCompanies', company.id, { status: company.status === 'active' ? 'disabled' : 'active' })}>{company.status === 'active' ? 'تعطيل الشركة' : 'تفعيل الشركة'}</Button>
      </Card>)}
    </div>
  </div>
}
export default PlatformShippingCompanies
