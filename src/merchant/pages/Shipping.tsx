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
import { Tabs } from '../../shared/components/ui/Tabs'
import { useStore } from '../../shared/hooks/useStore'
import { useCollection } from '../../shared/hooks/useCollection'
import { useToast } from '../../shared/hooks/useToast'
import { shippingService } from '../../shared/services/billing'
import { storesService } from '../../shared/services/stores'
import { formatCurrency } from '../../shared/utils/format'
import { GOVER_EG } from '../../shared/utils/constants'
import type { ShippingCompany, ShippingProvider, ShippingZone } from '../../shared/types'
import { Icon } from '../../shared/components/ui/Icon'
import './Shipping.css'

type ZoneDraft = {
  id?: string
  name: string
  governorates: string[]
  fee: string
  freeAbove: string
  estimatedDays: string
  providerId: string
  active: boolean
}

type ProviderDraft = {
  id?: string
  name: string
  fee: string
  estimatedDays: string
  active: boolean
}

export const MerchantShipping: FunctionalComponent = () => {
  const { store } = useStore()
  const storeId = store?.id || ''
  const shippingRes = useCollection<ShippingZone>('shipping', { storeId })
  const companiesRes = useCollection<ShippingCompany>('shippingCompanies', {}, true)
  const zones = shippingRes.data
  const toast = useToast()
  const [tab, setTab] = useState('settings')
  const [companySearch, setCompanySearch] = useState('')
  const [companySort, setCompanySort] = useState<'value' | 'price' | 'rating' | 'speed'>('value')
  const [savingCfg, setSavingCfg] = useState(false)
  const [zoneOpen, setZoneOpen] = useState(false)
  const [provOpen, setProvOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'zone' | 'provider'; id: string } | null>(null)
  const [zoneForm, setZoneForm] = useState<ZoneDraft>({ name: '', governorates: [], fee: '', freeAbove: '', estimatedDays: '', providerId: '', active: true })
  const [provForm, setProvForm] = useState<ProviderDraft>({ name: '', fee: '', estimatedDays: '', active: true })

  const cfg = store?.shipping || { enabled: false, model: 'flat' as const, flatFee: 0, freeAbove: 0, refusedPolicy: '', providers: [] }
  const providers = cfg.providers || []

  const toggleGovernorate = (g: string) => {
    const has = zoneForm.governorates.includes(g)
    setZoneForm({ ...zoneForm, governorates: has ? zoneForm.governorates.filter((x) => x !== g) : [...zoneForm.governorates, g] })
  }

  const saveConfig = async () => {
    if (!store) return
    setSavingCfg(true)
    try {
      const next = {
        ...cfg,
        enabled: cfg.enabled,
        model: cfg.model,
        flatFee: Number(cfg.flatFee || 0),
        freeAbove: cfg.freeAbove ? Number(cfg.freeAbove) : undefined,
        refusedPolicy: cfg.refusedPolicy || '',
      }
      await storesService.update(store.id, { shipping: next })
      toast.push('تم حفظ إعدادات الشحن')
    } catch (err: any) {
      toast.push('فشل حفظ الإعدادات', err?.message || 'حدث خطأ غير متوقع', 'error')
    } finally {
      setSavingCfg(false)
    }
  }

  // Auto-save for the inline settings controls. Guards against an unloaded
  // store (would otherwise write to an empty document id) and surfaces errors.
  const persistShipping = async (next: any) => {
    if (!store?.id) {
      toast.push('بيانات المتجر لم تُحمّل بعد', 'حاول مرة أخرى', 'error')
      return
    }
    try {
      await storesService.update(store.id, { shipping: { ...cfg, ...next } })
    } catch (err: any) {
      toast.push('تعذر حفظ إعدادات الشحن', err?.message || 'حدث خطأ غير متوقع', 'error')
    }
  }


  const formatPolicy = (before: string, after: string) => {
    const el = document.getElementById('shipping-policy-textarea') as HTMLTextAreaElement | null
    if (!el) return
    const { selectionStart: st, selectionEnd: en, value } = el
    const sel = value.slice(st, en)
    const next = value.slice(0, st) + before + sel + after + value.slice(en)
    persistShipping({ refusedPolicy: next })
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(st + before.length, en + before.length) })
  }

  const formatList = (prefix: string) => {
    const el = document.getElementById('shipping-policy-textarea') as HTMLTextAreaElement | null
    if (!el) return
    const { selectionStart: st, selectionEnd: en, value } = el
    const lines = value.slice(st, en).split('\n')
    const next = value.slice(0, st) + lines.map((l, i) => (prefix ? `${prefix}${l}` : `${i + 1}. ${l}`)).join('\n') + value.slice(en)
    persistShipping({ refusedPolicy: next })
    requestAnimationFrame(() => el.focus())
  }

  const submitZone = async () => {
    if (!storeId) return
    if (!zoneForm.name) {
      toast.push('أدخل اسم المنطقة', undefined, 'error')
      return
    }
    const data = {
      name: zoneForm.name.trim(),
      governorates: zoneForm.governorates,
      fee: Number(zoneForm.fee || 0),
      freeAbove: zoneForm.freeAbove ? Number(zoneForm.freeAbove) : undefined,
      estimatedDays: zoneForm.estimatedDays || '',
      providerId: zoneForm.providerId || '',
      active: zoneForm.active ?? true,
    }
    try {
      if (zoneForm.id) {
        await shippingService.update(zoneForm.id, data)
        toast.push('تم تحديث المنطقة')
      } else {
        await shippingService.create(storeId, data)
        toast.push('تم إضافة المنطقة')
      }
      setZoneOpen(false)
      setZoneForm({ name: '', governorates: [], fee: '', freeAbove: '', estimatedDays: '', providerId: '', active: true })
    } catch (err: any) {
      toast.push('فشل حفظ المنطقة', err?.message, 'error')
    }
  }

  const submitProvider = async () => {
    if (!store) return
    if (!provForm.name) {
      toast.push('أدخل اسم شركة الشحن', undefined, 'error')
      return
    }
    const provider: ShippingProvider = {
      id: provForm.id || `p_${Date.now()}`,
      name: provForm.name.trim(),
      fee: Number(provForm.fee || 0),
      estimatedDays: provForm.estimatedDays || '',
      active: provForm.active ?? true,
    }
    const others = (cfg.providers || []).filter((p) => p.id !== provider.id)
    try {
      await storesService.update(store.id, { shipping: { ...cfg, providers: [...others, provider] } })
      toast.push('تم حفظ شركة الشحن')
    } catch (err: any) {
      toast.push('تعذر حفظ شركة الشحن', err?.message || 'حدث خطأ غير متوقع', 'error')
    }
    setProvOpen(false)
    setProvForm({ name: '', fee: '', estimatedDays: '', active: true })
  }

  const removeTarget = async () => {
    if (!deleteTarget) return
    try {
      if (deleteTarget.kind === 'zone') {
        await shippingService.remove(deleteTarget.id)
        toast.push('تم حذف المنطقة')
      } else {
        if (!store) return
        await storesService.update(store.id, { shipping: { ...cfg, providers: (cfg.providers || []).filter((p) => p.id !== deleteTarget.id) } })
        toast.push('تم حذف شركة الشحن')
      }
    } catch (err: any) {
      toast.push('تعذر الحذف', err?.message || 'حدث خطأ غير متوقع', 'error')
    }
    setDeleteTarget(null)
  }

  if (shippingRes.loading) return <Loading />

  const zoneCount = zones.length
  const activeZones = zones.filter((z) => z.active).length
  const activeProviders = providers.filter((p) => p.active).length
  const eligibleCompanies = companiesRes.data
    .filter((company) => company.status === 'active')
    .filter((company) => !companySearch.trim() || company.name.toLowerCase().includes(companySearch.trim().toLowerCase()))
    .sort((a, b) => {
      if (companySort === 'rating') return Number(b.averageRating || 0) - Number(a.averageRating || 0)
      if (companySort === 'speed') return Number(a.ratesByZone?.default?.estimatedDays || 99) - Number(b.ratesByZone?.default?.estimatedDays || 99)
      if (companySort === 'price') return Number(a.ratesByZone?.default?.deliveryPrice || 0) - Number(b.ratesByZone?.default?.deliveryPrice || 0)
      const av = Number(a.averageRating || 0) * Math.log10(Number(a.completedShipments || 0) + 10)
      const bv = Number(b.averageRating || 0) * Math.log10(Number(b.completedShipments || 0) + 10)
      return bv - av
    })

  return (
    <div className="merchant-operations merchant-shipping-page">
      <PageHeader title="الشحن والتوصيل" subtitle="إعدادات الشحن والمناطق وشركات التوصيل" />

      <Tabs
        tabs={[
          { key: 'marketplace', label: 'شركات الشحن', count: eligibleCompanies.length },
          { key: 'settings', label: 'الإعدادات' },
          { key: 'zones', label: 'مناطق الشحن', count: zoneCount },
          { key: 'providers', label: 'شركات التوصيل', count: activeProviders },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'marketplace' && (
        <section className="shipping-marketplace mt-2" aria-label="مقارنة شركات الشحن">
          <div className="card shipping-marketplace-head">
            <div>
              <h2 className="card-title">قارن شركات الشحن قبل إسناد الشحنة</h2>
              <p className="muted small">الأسعار المعروضة تقديرية، ويُحفظ السعر المختار كلقطة تاريخية على الشحنة.</p>
            </div>
            <div className="shipping-marketplace-controls">
              <Input label="بحث" value={companySearch} onChange={setCompanySearch} placeholder="اسم الشركة" />
              <label className="field"><span className="field-label">ترتيب</span><select className="input" value={companySort} onChange={(e) => setCompanySort((e.target as HTMLSelectElement).value as typeof companySort)}><option value="value">أفضل قيمة</option><option value="price">الأرخص</option><option value="rating">الأعلى تقييماً</option><option value="speed">الأسرع</option></select></label>
            </div>
          </div>
          {companiesRes.loading ? <Loading /> : eligibleCompanies.length === 0 ? (
            <Card title="لا توجد شركات شحن متاحة"><p className="muted">سيظهر هنا ما تديره إدارة المنصة من شركات فعالة.</p></Card>
          ) : (
            <div className="shipping-company-grid">
              {eligibleCompanies.map((company) => {
                const rate = company.ratesByZone?.default || Object.values(company.ratesByZone || {})[0]
                return <Card key={company.id} className="shipping-company-card">
                  <div className="shipping-company-brand"><div className="shipping-company-logo">{company.logo ? <img src={company.logo} alt="" /> : <Icon name="local_shipping" ariaHidden />}</div><div><h3>{company.name}</h3><Badge tone="green">متاحة</Badge></div></div>
                  <div className="shipping-company-metrics"><span><strong>{formatCurrency(Number(rate?.deliveryPrice || 0))}</strong><small>التوصيل</small></span><span><strong>{formatCurrency(Number(rate?.returnPrice || 0))}</strong><small>المرتجع</small></span><span><strong>★ {Number(company.averageRating || 0).toFixed(1)}</strong><small>{company.reviewsCount || 0} مراجعة موثقة</small></span></div>
                  <div className="shipping-company-meta"><span><Icon name="schedule" ariaHidden /> {rate?.estimatedDays || 'حسب المنطقة'}</span><span><Icon name="verified" ariaHidden /> نجاح {company.deliverySuccessRate != null ? `${company.deliverySuccessRate}%` : '—'}</span></div>
                  <p className="muted small">{company.completedShipments || 0} شحنة مكتملة · لا يتم الاختيار تلقائياً</p>
                </Card>
              })}
            </div>
          )}
        </section>
      )}

      {tab === 'settings' && (
        <div className="mt-2">
          <div className="stats-grid">
            <StatsCard title="مناطق الشحن" value={zoneCount} icon="local_shipping" tone="primary" />
            <StatsCard title="مناطق نشطة" value={activeZones} icon="check_circle" tone="green" />
            <StatsCard title="شركات التوصيل" value={activeProviders} icon="local_shipping" tone="indigo" />
          </div>

          <div className="shipping-settings-grid">
            <div className="shipping-settings-main">
              <Card title="تفعيل الشحن" className="mt-2" titleIcon="local_shipping">
                <div className="field">
                  <Toggle checked={!!cfg.enabled} onChange={(v) => persistShipping({ enabled: v })} label="تفعيل الشحن والتوصيل" />
                  <div className="muted small">السماح للعملاء باختيار خيارات الشحن عند إتمام الطلب</div>
                </div>
              </Card>

              <Card title="استراتيجية تسعير الشحن" className="mt-2">
                <div className="field">
                  <span className="field-label">نموذج التسعير</span>
                  <div className="shipping-model-grid">
                    <button type="button" className={`shipping-model-card${cfg.model === 'flat' ? ' is-active' : ''}`} onClick={() => persistShipping({ model: 'flat' })}>
                      <span className="shipping-model-body">
                        <span className="shipping-model-title">سعر ثابت</span>
                        <span className="shipping-model-sub">تكلفة موحدة لجميع الطلبات</span>
                      </span>
                      <Icon name="check_circle" ariaHidden />
                    </button>
                    <button type="button" className={`shipping-model-card${cfg.model === 'zones' ? ' is-active' : ''}`} onClick={() => persistShipping({ model: 'zones' })}>
                      <span className="shipping-model-body">
                        <span className="shipping-model-title">حسب المنطقة</span>
                        <span className="shipping-model-sub">تخصيص الأسعار حسب المنطقة الجغرافية</span>
                      </span>
                      <Icon name="check_circle" ariaHidden />
                    </button>
                  </div>
                </div>
                <div className="shipping-fee-grid">
                  {cfg.model === 'flat' && (
                    <div className="field">
                      <span className="field-label">رسوم الشحن الثابتة</span>
                      <div className="input-with-unit">
                        <input className="input" type="number" min="0" value={cfg.flatFee ?? ''} onChange={(e) => persistShipping({ flatFee: Number((e.target as HTMLInputElement).value || 0) })} />
                        <span className="input-unit">ج.م</span>
                      </div>
                    </div>
                  )}
                  <div className="field">
                    <span className="field-label">شحن مجاني للطلبات فوق <span className="field-label-optional">(اختياري)</span></span>
                    <div className="input-with-unit">
                      <input className="input" type="number" min="0" value={cfg.freeAbove ? String(cfg.freeAbove) : ''} onChange={(e) => { const v = (e.target as HTMLInputElement).value; persistShipping({ freeAbove: v === '' ? undefined : Number(v) }) }} />
                      <span className="input-unit">ج.م</span>
                    </div>
                  </div>
                </div>
              </Card>

              <Card title="سياسة الشحن والاسترجاع" className="mt-2" titleIcon="policy" titleIconTone="secondary">
                <div className="muted small mb-1">تظهر هذه المعلومات للعملاء في صفحة إتمام الطلب</div>
                <div className="shipping-policy-editor">
                  <div className="shipping-policy-toolbar">
                    <button type="button" title="عريض" onClick={() => formatPolicy('**', '**')}><Icon name="format_bold" ariaHidden /></button>
                    <button type="button" title="مائل" onClick={() => formatPolicy('_', '_')}><Icon name="format_italic" ariaHidden /></button>
                    <button type="button" title="تسطير" onClick={() => formatPolicy('__', '__')}><Icon name="format_underlined" ariaHidden /></button>
                    <span className="shipping-policy-sep" />
                    <button type="button" title="قائمة نقطية" onClick={() => formatList('- ')}><Icon name="format_list_bulleted" ariaHidden /></button>
                    <button type="button" title="قائمة مرقمة" onClick={() => formatList('')}><Icon name="format_list_numbered" ariaHidden /></button>
                  </div>
                  <textarea className="shipping-policy-textarea" id="shipping-policy-textarea" rows={7} value={cfg.refusedPolicy || ''} onChange={(e) => persistShipping({ refusedPolicy: (e.target as HTMLTextAreaElement).value })} placeholder="اكتب سياسة الشحن والاسترجاع هنا..." />
                </div>
                <div className="flex flex-end mt-1">
                  <Button icon="save" loading={savingCfg} onClick={saveConfig}>حفظ التغييرات</Button>
                </div>
              </Card>
            </div>

            <div className="shipping-settings-side">
              <div className="shipping-preview-card">
                <h4 className="shipping-preview-head"><Icon name="visibility" ariaHidden /> معاينة إتمام الطلب</h4>
                <div className="shipping-preview-sheet">
                  <div className="shipping-preview-row"><span>الإجمالي الفرعي</span><span>450 ج.م</span></div>
                  <div className="shipping-preview-row"><span className="muted small">الشحن ({cfg.model === 'flat' ? 'سعر ثابت' : 'حسب المنطقة'})</span><span className="font-medium">{cfg.model === 'flat' ? `${formatCurrency(cfg.flatFee || 0)}` : '—'}</span></div>
                  <div className="shipping-preview-total"><span>الإجمالي</span><span>{formatCurrency(450 + (cfg.model === 'flat' ? Number(cfg.flatFee || 0) : 0))}</span></div>
                  {cfg.model === 'flat' && !!cfg.freeAbove && Number(cfg.freeAbove) > 450 && (
                    <div className="shipping-free-hint">
                      <Icon name="local_shipping" ariaHidden />
                      <span>أضف منتجات بقيمة {formatCurrency(Number(cfg.freeAbove) - 450)} للحصول على شحن مجاني</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'zones' && (
        <div className="mt-2">
          <Card title="مناطق الشحن" actions={<Button icon="add" size="sm" onClick={() => setZoneOpen(true)}>إضافة منطقة</Button>}>
            <Table cardMode
              columns={[
                { key: 'name', header: 'الاسم' },
                { key: 'governorates', header: 'المحافظات', render: (z: ShippingZone) => <span className="muted small">{z.governorates.length} محافظة</span> },
                { key: 'fee', header: 'السعر', render: (z: ShippingZone) => formatCurrency(z.fee || 0) },
                { key: 'freeAbove', header: 'مجاني فوق', render: (z: ShippingZone) => (z.freeAbove ? formatCurrency(z.freeAbove) : '—') },
                { key: 'estimatedDays', header: 'المدة', render: (z: ShippingZone) => z.estimatedDays || '—' },
                { key: 'active', header: 'الحالة', render: (z: ShippingZone) => <Badge tone={z.active ? 'green' : 'slate'}>{z.active ? 'نشطة' : 'موقوفة'}</Badge> },
                { key: 'actions', header: '', render: (z: ShippingZone) => (
                  <div className="flex gap-1">
                    <button className="icon-btn" onClick={() => { setZoneForm({ id: z.id, name: z.name, governorates: z.governorates || [], fee: String(z.fee || ''), freeAbove: z.freeAbove ? String(z.freeAbove) : '', estimatedDays: z.estimatedDays || '', providerId: z.providerId || '', active: z.active ?? true }); setZoneOpen(true) }}><Icon name="edit" /></button>
                    <button className="icon-btn icon-btn-danger" onClick={() => setDeleteTarget({ kind: 'zone', id: z.id })}><Icon name="delete" /></button>
                  </div>
                ) },
              ]}
              rows={zones}
            />
          </Card>
        </div>
      )}

      {tab === 'providers' && (
        <div className="mt-2">
          <Card title="شركات التوصيل" actions={<Button icon="add" size="sm" onClick={() => setProvOpen(true)}>إضافة شركة</Button>}>
            <Table cardMode
              columns={[
                { key: 'name', header: 'الاسم' },
                { key: 'fee', header: 'السعر', render: (p: ShippingProvider) => formatCurrency(p.fee || 0) },
                { key: 'estimatedDays', header: 'المدة', render: (p: ShippingProvider) => p.estimatedDays || '—' },
                { key: 'active', header: 'الحالة', render: (p: ShippingProvider) => (
                  <div className="flex gap-1">
                    <Badge tone={p.active ? 'green' : 'slate'}>{p.active ? 'نشطة' : 'موقوفة'}</Badge>
                    {cfg.defaultProviderId === p.id && p.active && <Badge tone="amber">افتراضي</Badge>}
                  </div>
                ) },
                { key: 'actions', header: '', render: (p: ShippingProvider) => (
                  <div className="flex gap-1">
                    <button className="icon-btn" title={cfg.defaultProviderId === p.id ? 'الشركة الافتراضية' : 'تعيين كشركة افتراضية'} disabled={cfg.defaultProviderId === p.id} onClick={() => persistShipping({ defaultProviderId: p.id })}><Icon name="star" /></button>
                    <button className="icon-btn" onClick={() => { setProvForm({ id: p.id, name: p.name, fee: String(p.fee || ''), estimatedDays: p.estimatedDays || '', active: p.active ?? true }); setProvOpen(true) }}><Icon name="edit" /></button>
                    <button className="icon-btn icon-btn-danger" onClick={() => setDeleteTarget({ kind: 'provider', id: p.id })}><Icon name="delete" /></button>
                  </div>
                ) },
              ]}
              rows={providers}
            />
          </Card>
        </div>
      )}

      <Modal open={zoneOpen} onClose={() => setZoneOpen(false)} title={zoneForm.id ? 'تعديل منطقة شحن' : 'إضافة منطقة شحن'}>
        <Input label="اسم المنطقة" value={zoneForm.name} onChange={(v) => setZoneForm({ ...zoneForm, name: v })} required placeholder="مثال: القاهرة الكبرى" />
        <div className="field">
          <span className="field-label">المحافظات ({zoneForm.governorates.length})</span>
          <div className="governorate-grid">
            {GOVER_EG.map((g) => (
              <button key={g} type="button" className={`chip ${zoneForm.governorates.includes(g) ? 'chip-active' : ''}`} onClick={() => toggleGovernorate(g)}>{g}</button>
            ))}
          </div>
        </div>
        <div className="grid grid-2">
          <Input label="سعر الشحن" type="number" value={zoneForm.fee} onChange={(v) => setZoneForm({ ...zoneForm, fee: v })} />
          <Input label="شحن مجاني فوق (اختياري)" type="number" value={zoneForm.freeAbove} onChange={(v) => setZoneForm({ ...zoneForm, freeAbove: v })} />
        </div>
        <div className="grid grid-2">
          <Input label="المدة المتوقعة" value={zoneForm.estimatedDays} onChange={(v) => setZoneForm({ ...zoneForm, estimatedDays: v })} placeholder="3-5 أيام" />
          {providers.length > 0 && (
            <div className="field">
              <span className="field-label">شركة التوصيل</span>
              <select className="input" value={zoneForm.providerId} onChange={(e) => setZoneForm({ ...zoneForm, providerId: (e.target as HTMLSelectElement).value })}>
                <option value="">بدون</option>
                {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="field">
          <Toggle checked={zoneForm.active} onChange={(v) => setZoneForm({ ...zoneForm, active: v })} label="نشطة" />
        </div>
        <div className="flex flex-end">
          <Button variant="ghost" onClick={() => setZoneOpen(false)}>إلغاء</Button>
          <Button onClick={submitZone}>حفظ</Button>
        </div>
      </Modal>

      <Modal open={provOpen} onClose={() => setProvOpen(false)} title={provForm.id ? 'تعديل شركة توصيل' : 'إضافة شركة توصيل'}>
        <Input label="اسم الشركة" value={provForm.name} onChange={(v) => setProvForm({ ...provForm, name: v })} required placeholder="مثال: أرامكس" />
        <div className="grid grid-2">
          <Input label="السعر الافتراضي" type="number" value={provForm.fee} onChange={(v) => setProvForm({ ...provForm, fee: v })} />
          <Input label="المدة المتوقعة" value={provForm.estimatedDays} onChange={(v) => setProvForm({ ...provForm, estimatedDays: v })} placeholder="2-4 أيام" />
        </div>
        <div className="field">
          <Toggle checked={provForm.active} onChange={(v) => setProvForm({ ...provForm, active: v })} label="نشطة" />
        </div>
        <div className="flex flex-end">
          <Button variant="ghost" onClick={() => setProvOpen(false)}>إلغاء</Button>
          <Button onClick={submitProvider}>حفظ</Button>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onCancel={() => setDeleteTarget(null)} onConfirm={removeTarget} title="تأكيد الحذف" description="سيتم حذف هذا العنصر نهائياً" confirmLabel="حذف" />
    </div>
  )
}
export default MerchantShipping
