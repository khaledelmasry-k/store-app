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
import type { ShippingProvider, ShippingZone } from '../../shared/types'
import { Icon } from '../../shared/components/ui/Icon'

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
  const zones = shippingRes.data
  const toast = useToast()
  const [tab, setTab] = useState('settings')
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
    await storesService.update(store.id, { shipping: { ...cfg, providers: [...others, provider] } })
    toast.push('تم حفظ شركة الشحن')
    setProvOpen(false)
    setProvForm({ name: '', fee: '', estimatedDays: '', active: true })
  }

  const removeTarget = async () => {
    if (!deleteTarget) return
    if (deleteTarget.kind === 'zone') {
      await shippingService.remove(deleteTarget.id)
      toast.push('تم حذف المنطقة')
    } else {
      if (!store) return
      await storesService.update(store.id, { shipping: { ...cfg, providers: (cfg.providers || []).filter((p) => p.id !== deleteTarget.id) } })
      toast.push('تم حذف شركة الشحن')
    }
    setDeleteTarget(null)
  }

  if (shippingRes.loading) return <Loading />

  const zoneCount = zones.length
  const activeZones = zones.filter((z) => z.active).length
  const activeProviders = providers.filter((p) => p.active).length

  return (
    <div>
      <PageHeader title="الشحن والتوصيل" subtitle="إعدادات الشحن والمناطق وشركات التوصيل" />

      <Tabs
        tabs={[
          { key: 'settings', label: 'الإعدادات' },
          { key: 'zones', label: 'مناطق الشحن', count: zoneCount },
          { key: 'providers', label: 'شركات التوصيل', count: activeProviders },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'settings' && (
        <div className="mt-2">
          <div className="stats-grid">
            <StatsCard title="مناطق الشحن" value={zoneCount} icon="local_shipping" tone="primary" />
            <StatsCard title="مناطق نشطة" value={activeZones} icon="check_circle" tone="green" />
            <StatsCard title="شركات التوصيل" value={activeProviders} icon="local_shipping" tone="indigo" />
          </div>

          <Card title="إعدادات الشحن العامة" className="mt-2">
            <div className="field">
              <Toggle checked={!!cfg.enabled} onChange={(v) => storesService.update(store?.id || '', { shipping: { ...cfg, enabled: v } })} label="تفعيل الشحن والتوصيل" />
            </div>
            <div className="field mt-1">
              <span className="field-label">نموذج الشحن</span>
              <div className="flex">
                <button type="button" className={`btn ${cfg.model === 'flat' ? 'btn-primary' : 'btn-outline'}`} onClick={() => storesService.update(store?.id || '', { shipping: { ...cfg, model: 'flat' } })}>سعر موحد</button>
                <button type="button" className={`btn ${cfg.model === 'zones' ? 'btn-primary' : 'btn-outline'}`} onClick={() => storesService.update(store?.id || '', { shipping: { ...cfg, model: 'zones' } })}>حسب المنطقة</button>
              </div>
            </div>
            {cfg.model === 'flat' && (
              <Input label="سعر الشحن الموحد" type="number" value={String(cfg.flatFee ?? '')} onChange={(v) => storesService.update(store?.id || '', { shipping: { ...cfg, flatFee: Number(v) } })} />
            )}
            <Input label="شحن مجاني عند الطلب بقيمة (اختياري)" type="number" value={cfg.freeAbove ? String(cfg.freeAbove) : ''} onChange={(v) => storesService.update(store?.id || '', { shipping: { ...cfg, freeAbove: v === '' ? undefined : Number(v) } })} />
            <div className="field">
              <span className="field-label">سياسة الرفض والاسترجاع</span>
              <textarea className="input" rows={2} value={cfg.refusedPolicy || ''} onChange={(e) => storesService.update(store?.id || '', { shipping: { ...cfg, refusedPolicy: (e.target as HTMLTextAreaElement).value } })} placeholder="رسوم الرفض أو شروط الاسترجاع تظهر للعميل عند إتمام الطلب" />
            </div>
            <div className="flex flex-end mt-1">
              <Button icon="save" loading={savingCfg} onClick={saveConfig}>حفظ الإعدادات</Button>
            </div>
          </Card>
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
                { key: 'active', header: 'الحالة', render: (p: ShippingProvider) => <Badge tone={p.active ? 'green' : 'slate'}>{p.active ? 'نشطة' : 'موقوفة'}</Badge> },
                { key: 'actions', header: '', render: (p: ShippingProvider) => (
                  <div className="flex gap-1">
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
