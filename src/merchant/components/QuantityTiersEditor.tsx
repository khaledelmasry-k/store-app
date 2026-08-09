import { FunctionalComponent } from 'preact'
import type { QuantityTier } from '../../shared/types'
import { Input } from '../../shared/components/ui/Input'
import { Button } from '../../shared/components/ui/Button'
import { Icon } from '../../shared/components/ui/Icon'
import { formatCurrency } from '../../shared/utils/format'
import { piecesLabel } from '../../shared/utils/pricing'

interface Props {
  tiers: QuantityTier[]
  onChange: (tiers: QuantityTier[]) => void
}

export const QuantityTiersEditor: FunctionalComponent<Props> = ({ tiers, onChange }) => {
  const update = (index: number, patch: Partial<QuantityTier>) => {
    const next = tiers.map((t, i) => (i === index ? { ...t, ...patch } : t))
    onChange(next)
  }

  const add = () => {
    const maxQty = tiers.reduce((m, t) => Math.max(m, t.quantity || 0), 0)
    onChange([...tiers, { quantity: maxQty + 1, price: 0 }])
  }

  const remove = (index: number) => {
    onChange(tiers.filter((_, i) => i !== index))
  }

  const move = (from: number, dir: -1 | 1) => {
    const to = from + dir
    if (to < 0 || to >= tiers.length) return
    const next = [...tiers]
    ;[next[from], next[to]] = [next[to], next[from]]
    onChange(next)
  }

  const sorted = [...tiers].sort((a, b) => (a.quantity || 0) - (b.quantity || 0))

  return (
    <div className="qty-tier-editor mt-1">
      <div className="field">
        <span className="field-label">السعر الإجمالي حسب عدد القطع</span>
        <p className="field-hint">السعر هو إجمالي ثمن الباقة كاملة — لا يُضرب في عدد القطع.</p>
      </div>
      <div className="qty-tier-editor-list">
        {tiers.map((t, i) => (
          <div key={i} className="qty-tier-editor-row">
            <button type="button" className="icon-btn" disabled={i === 0} onClick={() => move(i, -1)} title="تحريك لأعلى">
              <Icon name="arrow_upward" />
            </button>
            <button type="button" className="icon-btn" disabled={i === tiers.length - 1} onClick={() => move(i, 1)} title="تحريك لأسفل">
              <Icon name="arrow_downward" />
            </button>
            <Input label="عدد القطع" type="number" value={t.quantity || ''} onChange={(v) => update(i, { quantity: Math.max(1, Math.round(Number(v) || 1)) })} />
            <Input label="السعر الإجمالي" type="number" value={t.price || ''} onChange={(v) => update(i, { price: Number(v) })} />
            <button type="button" className="icon-btn icon-btn-danger" onClick={() => remove(i)} title="حذف المستوى">
              <Icon name="delete" />
            </button>
          </div>
        ))}
      </div>
      <Button variant="outline" size="sm" icon="add" onClick={add}>إضافة مستوى سعري</Button>
      {sorted.length > 0 && (
        <div className="qty-tier-editor-summary muted small mt-1">
          <div className="field-label">معاينة للعميل</div>
          {sorted.map((t) => (
            <div key={t.quantity} className="summary-row">
              <span>{t.quantity} {piecesLabel(t.quantity)}</span>
              <span>{formatCurrency(t.price || 0)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
