import { FunctionalComponent, Fragment } from 'preact'
import { useState } from 'preact/hooks'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { Table } from '../../shared/components/ui/Table'
import { Badge } from '../../shared/components/ui/Badge'
import { Button } from '../../shared/components/ui/Button'
import { Modal } from '../../shared/components/ui/Modal'
import { Input } from '../../shared/components/ui/Input'
import { Textarea } from '../../shared/components/ui/Textarea'
import { Toggle } from '../../shared/components/ui/Toggle'
import { ConfirmDialog } from '../../shared/components/ui/ConfirmDialog'
import { useStore } from '../../shared/hooks/useStore'
import { useCollection } from '../../shared/hooks/useCollection'
import { useToast } from '../../shared/hooks/useToast'
import { landingPagesService } from '../../shared/services/system'
import { slugify } from '../../shared/utils/format'
import type { LandingPage } from '../../shared/types'

export const MerchantLandingPages: FunctionalComponent = () => {
  const { store } = useStore()
  const storeId = store?.id || ''
  const pagesRes = useCollection<LandingPage>('landingPages', { storeId });
  const pages = pagesRes.data
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<LandingPage | null>(null)
  const [form, setForm] = useState<Partial<LandingPage>>({ active: true })

  const submit = async () => {
    if (!form.title) return
    await landingPagesService.create(storeId, {
      slug: slugify(form.title),
      title: form.title,
      subtitle: form.subtitle || '',
      heroImage: form.heroImage || '',
      ctaText: form.ctaText || '',
      sections: [{ type: 'hero', title: form.title, body: form.subtitle }],
      active: form.active ?? true,
    })
    toast.push('تم إنشاء صفحة الهبوط')
    setOpen(false)
    setForm({ active: true })
  }

  const remove = async () => {
    if (!deleteTarget) return
    await landingPagesService.remove(deleteTarget.id)
    toast.push('تم الحذف')
    setDeleteTarget(null)
  }

  return (
    <div>
      <PageHeader title="صفحات الهبوط" subtitle={`${pages.length} صفحة`} actions={<Button icon="add" onClick={() => setOpen(true)}>صفحة جديدة</Button>} />
      <Card>
        <Table
          columns={[
            { key: 'title', header: 'العنوان' },
            { key: 'slug', header: 'الرابط', render: (p: LandingPage) => <span className="monospace">/{p.slug}</span> },
            { key: 'active', header: 'الحالة', render: (p: LandingPage) => <Badge tone={p.active ? 'green' : 'slate'}>{p.active ? 'نشطة' : 'مخفية'}</Badge> },
            { key: 'actions', header: '', render: (p: LandingPage) => <button className="icon-btn" onClick={() => setDeleteTarget(p)}><span className="material-symbols-outlined">delete</span></button> },
          ]}
          rows={pages}
        />
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="صفحة هبوط جديدة" footer={<Fragment><Button variant="ghost" onClick={() => setOpen(false)}>إلغاء</Button><Button onClick={submit}>حفظ</Button></Fragment>}>
        <Input label="العنوان" value={form.title || ''} onChange={(v) => setForm({ ...form, title: v })} required />
        <Textarea label="الوصف المختصر" value={form.subtitle || ''} onChange={(v) => setForm({ ...form, subtitle: v })} rows={2} />
        <Input label="رابط الصورة الرئيسية" value={form.heroImage || ''} onChange={(v) => setForm({ ...form, heroImage: v })} />
        <Input label="نص الزر" value={form.ctaText || ''} onChange={(v) => setForm({ ...form, ctaText: v })} />
        <div className="field mt-1">
          <Toggle checked={form.active ?? true} onChange={(v) => setForm({ ...form, active: v })} label="نشطة" />
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onCancel={() => setDeleteTarget(null)} onConfirm={remove} title="حذف الصفحة" description={`سيتم حذف "${deleteTarget?.title}"`} confirmLabel="حذف" />
    </div>
  )
}
export default MerchantLandingPages
