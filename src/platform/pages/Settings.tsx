import { FunctionalComponent } from 'preact'
import { useState } from 'preact/hooks'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { Button } from '../../shared/components/ui/Button'
import { Input } from '../../shared/components/ui/Input'
import { Toggle } from '../../shared/components/ui/Toggle'
import { useDocument } from '../../shared/hooks/useDocument'
import { useToast } from '../../shared/hooks/useToast'
import { settingsService } from '../../shared/services/system'
import type { PlatformSettings as PlatformSettingsData } from '../../shared/types'

export const PlatformSettings: FunctionalComponent = () => {
  const { data } = useDocument<PlatformSettingsData>('settings', 'platform')
  const toast = useToast()
  const [form, setForm] = useState<Partial<PlatformSettingsData>>({})

  const save = async () => {
    await settingsService.update(form)
    toast.push('تم حفظ الإعدادات')
  }

  return (
    <div>
      <PageHeader title="إعدادات المنصة" subtitle="الإعدادات العامة للمنصة" actions={<Button icon="save" onClick={save}>حفظ الإعدادات</Button>} />

      <Card title="التجارة" subtitle="العملة وحدود الاشتراك" className="mb-2">
        <div className="grid grid-2">
          <Input label="العملة الافتراضية" value={form.currency ?? data?.currency ?? 'EGP'} onChange={(v) => setForm({ ...form, currency: v })} />
          <Input label="حد المتاجر لكل تاجر" type="number" value={form.maxStoresPerMerchant ?? data?.maxStoresPerMerchant ?? 1} onChange={(v) => setForm({ ...form, maxStoresPerMerchant: Number(v) })} />
        </div>
      </Card>

      <Card title="التواصل والدعم" subtitle="بينات التواصل التي تظهر للتجار" className="mb-2">
        <div className="grid grid-2">
          <Input label="بريد الدعم" type="email" value={form.contactEmail ?? data?.contactEmail ?? ''} onChange={(v) => setForm({ ...form, contactEmail: v })} />
          <Input label="هاتف الدعم" value={form.supportPhone ?? data?.supportPhone ?? ''} onChange={(v) => setForm({ ...form, supportPhone: v })} />
        </div>
      </Card>

      <Card title="السياسات" subtitle="تفعيل أو إيقاف الخدمات">
        <div className="settings-flags">
          <Toggle checked={form.registrationEnabled ?? data?.registrationEnabled ?? true} onChange={(v) => setForm({ ...form, registrationEnabled: v })} label="تفعيل تسجيل التجار" />
          <Toggle checked={form.allowCustomerAccounts ?? data?.allowCustomerAccounts ?? true} onChange={(v) => setForm({ ...form, allowCustomerAccounts: v })} label="تفعيل حسابات العملاء" />
          <Toggle checked={form.maintenanceMode ?? data?.maintenanceMode ?? false} onChange={(v) => setForm({ ...form, maintenanceMode: v })} label="وضع الصيانة" />
        </div>
      </Card>
    </div>
  )
}
export default PlatformSettings
