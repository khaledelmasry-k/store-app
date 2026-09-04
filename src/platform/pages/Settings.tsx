import { FunctionalComponent } from 'preact'
import { useState } from 'preact/hooks'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { Button } from '../../shared/components/ui/Button'
import { Input } from '../../shared/components/ui/Input'
import { Textarea } from '../../shared/components/ui/Textarea'
import { Toggle } from '../../shared/components/ui/Toggle'
import { useDocument } from '../../shared/hooks/useDocument'
import { useToast } from '../../shared/hooks/useToast'
import { settingsService } from '../../shared/services/system'
import { saveEnterpriseWhatsAppSettingsCallable } from '../../shared/services/auth'
import type { PlatformSettings as PlatformSettingsData } from '../../shared/types'
import './Settings.css'

export const PlatformSettings: FunctionalComponent = () => {
  const { data } = useDocument<PlatformSettingsData>('settings', 'platform')
  const toast = useToast()
  const [form, setForm] = useState<Partial<PlatformSettingsData>>({})

  const whatsappNumber = String(form.enterpriseWhatsAppNumber ?? data?.enterpriseWhatsAppNumber ?? '')
  const whatsappEnabled = form.enterpriseWhatsAppEnabled ?? data?.enterpriseWhatsAppEnabled ?? false
  const normalizeWhatsApp = (value: string) => value.replace(/\D/g, '').slice(0, 15)

  const save = async () => {
    try {
      await settingsService.update(form)
      toast.push('تم حفظ الإعدادات')
    } catch {
      toast.push('تعذر حفظ الإعدادات')
    }
  }

  const saveWhatsApp = async () => {
    const normalized = normalizeWhatsApp(whatsappNumber)
    if (whatsappEnabled && (normalized.length < 8 || normalized.length > 15)) {
      toast.push('أدخل رقم واتساب بصيغة دولية صحيحة')
      return
    }
    try {
      await saveEnterpriseWhatsAppSettingsCallable({
        number: normalized,
        enabled: Boolean(whatsappEnabled),
        message: String(form.enterpriseWhatsAppMessage ?? data?.enterpriseWhatsAppMessage ?? ''),
      })
      setForm((prev) => ({ ...prev, enterpriseWhatsAppNumber: normalized }))
      toast.push('تم حفظ إعدادات واتساب المبيعات')
    } catch {
      toast.push('تعذر حفظ إعدادات واتساب المبيعات')
    }
  }

  return (
    <div className="platform-operations platform-settings-page">
      <PageHeader title="إعدادات المنصة" subtitle="الإعدادات العامة للمنصة" context={<span className="platform-intro-meta">إعدادات التجارة والتواصل والدفع والسياسات</span>} actions={<Button icon="save" onClick={save}>حفظ الإعدادات</Button>} />

      <Card title="التجارة" subtitle="العملة وحدود الاشتراك" className="mb-2">
        <div className="grid grid-2">
          <Input label="العملة الافتراضية" value={form.currency ?? data?.currency ?? 'EGP'} onChange={(v) => setForm({ ...form, currency: v })} />
          <Input label="حد المتاجر لكل تاجر" type="number" value={form.maxStoresPerMerchant ?? data?.maxStoresPerMerchant ?? 1} onChange={(v) => setForm({ ...form, maxStoresPerMerchant: Number(v) })} />
        </div>
      </Card>

      <Card title="التواصل والدعم" subtitle="بيانات التواصل التي تظهر للتجار" className="mb-2">
        <div className="grid grid-2">
          <Input label="بريد الدعم" type="email" value={form.contactEmail ?? data?.contactEmail ?? ''} onChange={(v) => setForm({ ...form, contactEmail: v })} />
          <Input label="هاتف الدعم" value={form.supportPhone ?? data?.supportPhone ?? ''} onChange={(v) => setForm({ ...form, supportPhone: v })} />
        </div>
      </Card>

      <Card title="التواصل والمبيعات" subtitle="إعداد قناة التواصل الخاصة بحلول Enterprise وWhite Label" className="mb-2">
        <div className="grid grid-2">
          <div>
            <Input
              label="رقم واتساب المبيعات"
              value={whatsappNumber}
              onChange={(v) => setForm({ ...form, enterpriseWhatsAppNumber: normalizeWhatsApp(v) })}
              placeholder="2010XXXXXXXX"
            />
            <small className="field-hint">اكتب الرقم بصيغة دولية، مثال: 2010XXXXXXXX</small>
          </div>
          <Textarea
            label="رسالة واتساب الافتراضية"
            value={form.enterpriseWhatsAppMessage ?? data?.enterpriseWhatsAppMessage ?? ''}
            onChange={(v) => setForm({ ...form, enterpriseWhatsAppMessage: v })}
            rows={3}
            placeholder="مرحبًا، أرغب في الحصول على عرض سعر لحلول Enterprise / White Label من Matjari."
          />
        </div>
        <div className="settings-flags">
          <Toggle checked={Boolean(whatsappEnabled)} onChange={(v) => setForm({ ...form, enterpriseWhatsAppEnabled: v })} label="تفعيل التواصل عبر واتساب" />
        </div>
        <div className="settings-actions"><Button icon="save" onClick={saveWhatsApp}>حفظ إعدادات واتساب</Button></div>
      </Card>

      <Card title="أتمتة واتساب للمنصة" subtitle="إرسال رمز التحقق وإشعارات التسجيل من رقم المنصة" className="mb-2">
        <div className="platform-whatsapp-pending" role="status">
          <div><span className="platform-whatsapp-pending__state">قريبًا</span><strong>الربط غير مفعّل بعد</strong></div>
          <p>سيتم تفعيل إرسال رمز OTP عند تسجيل التاجر بعد ربط مزود واتساب حقيقي. لا يتم حاليًا إرسال أي رموز أو رسائل تلقائية، ولا تظهر حالة اتصال غير حقيقية.</p>
        </div>
      </Card>

      <Card title="الدفع اليدوي للاشتراكات" subtitle="تظهر هذه التعليمات للتاجر عند تفعيل اشتراكه" className="mb-2">
        <Textarea
          label="تعليمات الدفع"
          value={form.paymentInstructions ?? data?.paymentInstructions ?? ''}
          onChange={(v) => setForm({ ...form, paymentInstructions: v })}
          rows={4}
          placeholder={'مثال:\nفودافون كاش: 0100xxxxxxx\nمحفظة إنستاباي: 0100xxxxxxx\nبعد التحويل أرسل رقم العملية في النموذج.'}
        />
        <Input label="وسيلة تواصل الدفع (اختياري)" value={form.paymentContact ?? data?.paymentContact ?? ''} onChange={(v) => setForm({ ...form, paymentContact: v })} placeholder="رقم واتساب / بريد لاستفسارات الدفع" />
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
