import { FunctionalComponent } from 'preact'
import { useState } from 'preact/hooks'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { Button } from '../../shared/components/ui/Button'
import { Input } from '../../shared/components/ui/Input'
import { Toggle } from '../../shared/components/ui/Toggle'
import { useStore } from '../../shared/hooks/useStore'
import { useToast } from '../../shared/hooks/useToast'
import { storesService } from '../../shared/services/stores'
import type { Store } from '../../shared/types'

export const MerchantSettings: FunctionalComponent = () => {
  const { store } = useStore()
  const toast = useToast()
  const [form, setForm] = useState<Partial<Store>>({})

  const save = async () => {
    if (!store) return
    await storesService.update(store.id, form)
    toast.push('تم حفظ الإعدادات')
  }

  const saveTheme = async (primary: string) => {
    if (!store) return
    await storesService.update(store.id, { theme: { ...store.theme, primary } })
    toast.push('تم تحديث اللون')
  }

  return (
    <div>
      <PageHeader title="إعدادات المتجر" subtitle="البيانات العامة والظهور" />
      <Card title="المعلومات الأساسية" className="mb-2">
        <div className="grid grid-2">
          <Input label="اسم المتجر" value={form.name ?? store?.name ?? ''} onChange={(v) => setForm({ ...form, name: v })} />
          <Input label="الرابط (ref)" value={form.ref ?? store?.ref ?? ''} onChange={(v) => setForm({ ...form, ref: v })} />
          <Input label="رقم الهاتف" value={form.phone ?? store?.phone ?? ''} onChange={(v) => setForm({ ...form, phone: v })} />
          <Input label="العنوان" value={form.address ?? store?.address ?? ''} onChange={(v) => setForm({ ...form, address: v })} />
          <Input label="الوصف" value={form.description ?? store?.description ?? ''} onChange={(v) => setForm({ ...form, description: v })} />
          <select className="input" value={form.currency ?? store?.currency ?? 'EGP'} onChange={(e) => setForm({ ...form, currency: (e.target as HTMLSelectElement).value })}>
            {['EGP', 'USD', 'SAR', 'AED'].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="field mt-1">
          <Toggle checked={form.active ?? store?.active ?? true} onChange={(v) => setForm({ ...form, active: v })} label="المتجر مفتوح للعملاء" />
        </div>
        <div className="flex" style={{ justifyContent: 'flex-end' }}>
          <Button onClick={save}>حفظ</Button>
        </div>
      </Card>
      <Card title="اللون الأساسي" subtitle="سيُستخدم في صفحة المتجر">
        <div className="flex">
          {['#6366f1', '#16a34a', '#dc2626', '#d97706', '#0284c7', '#7c3aed', '#0f172a'].map((c) => (
            <button
              key={c}
              type="button"
              className="icon-btn"
              style={{ width: 44, height: 44, borderRadius: 12, background: c, border: store?.theme?.primary === c ? '3px solid var(--border-strong)' : 'none' }}
              onClick={() => saveTheme(c)}
            />
          ))}
        </div>
      </Card>
    </div>
  )
}
export default MerchantSettings
