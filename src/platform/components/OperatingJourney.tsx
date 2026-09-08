import { FunctionalComponent } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { Icon } from '../../shared/components/ui/Icon'
import './OperatingJourney.css'

type Step = {
  icon: string
  labelAr: string
  labelEn: string
  step: string
}

const STEPS: Step[] = [
  { icon: 'storefront', labelAr: 'المتجر', labelEn: 'Store', step: '01' },
  { icon: 'shopping_bag', labelAr: 'الطلب', labelEn: 'Order', step: '02' },
  { icon: 'local_shipping', labelAr: 'الشحن', labelEn: 'Shipping', step: '03' },
  { icon: 'person', labelAr: 'العميل', labelEn: 'Customer', step: '04' },
  { icon: 'hub', labelAr: 'CRM', labelEn: 'CRM', step: '05' },
  { icon: 'bar_chart', labelAr: 'التقارير', labelEn: 'Reports', step: '06' },
]

function VanSvg({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 28"
      width="64"
      height="28"
      aria-hidden="true"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* body */}
      <rect x="2" y="7" width="44" height="14" rx="3" fill="currentColor" opacity="0.95" />
      <rect x="2" y="7" width="44" height="14" rx="3" stroke="white" strokeOpacity="0.14" />
      {/* cabin */}
      <path d="M46 11 L56 11 L58 15 L58 19 L46 19 Z" fill="white" fillOpacity="0.92" stroke="currentColor" strokeOpacity="0.18" />
      {/* window */}
      <path d="M48 13 L55 13 L55 17 L48 17 Z" fill="currentColor" opacity="0.18" />
      {/* wheels */}
      <circle cx="16" cy="22" r="5" fill="#0f172a" />
      <circle cx="16" cy="22" r="2.2" fill="white" fillOpacity="0.92" />
      <circle cx="44" cy="22" r="5" fill="#0f172a" />
      <circle cx="44" cy="22" r="2.2" fill="white" fillOpacity="0.92" />
      {/* door line */}
      <path d="M30 7 V21" stroke="white" strokeOpacity="0.22" strokeWidth="1" />
      {/* headlight */}
      <rect x="57.5" y="14.5" width="2" height="2.5" rx="0.6" fill="#fef08a" />
      {/* brand stripe */}
      <rect x="6" y="11" width="18" height="2" rx="1" fill="white" fillOpacity="0.22" />
    </svg>
  )
}

export const OperatingJourney: FunctionalComponent = () => {
  const sectionRef = useRef<HTMLElement>(null)
  const [active, setActive] = useState(0)
  const [visible, setVisible] = useState(false)
  const [reduced, setReduced] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(m.matches)
    update()
    m.addEventListener('change', update)
    return () => m.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    const el = sectionRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        setVisible(entry.isIntersecting && entry.intersectionRatio > 0.18)
      },
      { threshold: [0, 0.18, 0.35] }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    if (!visible || reduced) {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
      return
    }

    const schedule = (nextActive: number, delay: number) => {
      timerRef.current = window.setTimeout(() => {
        if (nextActive === 0) {
          // loop reset: disable transition briefly to avoid flying back
          setIsResetting(true)
          setActive(0)
          // re-enable after paint
          window.setTimeout(() => setIsResetting(false), 40)
          // then continue to 1 after normal delay
          timerRef.current = window.setTimeout(() => setActive(1), 1800)
        } else {
          setActive(nextActive)
        }
      }, delay)
    }

    // active is current, schedule next
    if (active === STEPS.length - 1) {
      // pause at end before loop
      schedule(0, 1400)
    } else {
      schedule(active + 1, 1750)
    }

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [active, visible, reduced])

  // when section becomes visible first time, ensure we start from 0 after a short entry delay
  useEffect(() => {
    if (visible && !reduced) {
      // small delay to let entry animation play before van starts
      const t = window.setTimeout(() => {
        // if already at 0, kick to 1 after 900ms, else keep
        if (active === 0) {
          // don't reset immediately, let the interval handle
        }
      }, 600)
      return () => window.clearTimeout(t)
    }
  }, [visible, reduced, active])

  // for reduced motion, show static full state
  const displayActive = reduced ? STEPS.length - 1 : active
  const progressPercent = reduced ? 100 : (displayActive / (STEPS.length - 1)) * 100

  return (
    <section
      ref={sectionRef}
      id="operating-flow"
      className={`oj-section ${visible ? 'is-visible' : ''} ${reduced ? 'is-reduced' : ''} ${isResetting ? 'is-resetting' : ''}`}
      aria-labelledby="oj-title"
      dir="rtl"
    >
      <div className="oj-bg" aria-hidden="true">
        <span className="oj-bg-gradient" />
        <span className="oj-bg-glow" />
      </div>

      <div className="oj-container">
        <div className="oj-header">
          <span className="oj-eyebrow">دورة التشغيل</span>
          <h2 id="oj-title">من المتجر إلى القرار، بلا فجوات</h2>
          <p>كل مرحلة تبني على اللي قبلها داخل Matjari.</p>
        </div>

        <div className="oj-stage" role="group" aria-label="رحلة التشغيل من المتجر إلى التقارير">
          {/* timeline */}
          <div className="oj-timeline" aria-hidden="true">
            <div className="oj-road">
              <span className="oj-road-base" />
              <span
                className="oj-road-progress"
                style={{ width: `${progressPercent}%`, ['--oj-progress-h' as any]: `${progressPercent}%` } as any}
              />
              <span className="oj-road-dashed" />
            </div>

            <div className="oj-nodes">
              {STEPS.map((s, idx) => {
                const state = idx < displayActive ? 'is-done' : idx === displayActive ? 'is-active' : ''
                return (
                  <span key={s.labelEn} className={`oj-node ${state}`}>
                    <i className="oj-node-dot" />
                    <i className="oj-node-ring" aria-hidden="true" />
                  </span>
                )
              })}
            </div>

            {/* desktop van */}
            <span
              className="oj-van oj-van--h"
              style={{ right: `calc(${progressPercent}% - 32px)` } as any}
              aria-hidden="true"
            >
              <VanSvg />
            </span>

            {/* mobile van */}
            <span
              className="oj-van oj-van--v"
              style={{ top: `calc(${progressPercent}% - 14px)` } as any}
              aria-hidden="true"
            >
              <VanSvg />
            </span>
          </div>

          {/* cards */}
          <ol className="oj-cards">
            {STEPS.map((s, idx) => {
              const isActive = idx === displayActive
              const isDone = idx < displayActive
              return (
                <li
                  key={s.labelEn}
                  className={`oj-card ${isActive ? 'is-active' : ''} ${isDone ? 'is-done' : ''}`}
                  style={{ transitionDelay: visible ? `${idx * 70}ms` : '0ms' } as any}
                  aria-current={isActive ? 'step' : undefined}
                >
                  <span className="oj-card-step">{s.step}</span>
                  <span className={`oj-card-icon ${isActive ? 'is-active' : ''}`}>
                    <Icon name={s.icon as any} />
                  </span>
                  <strong className="oj-card-label">{s.labelAr}</strong>
                  <small className="oj-card-en">{s.labelEn}</small>
                  {isDone && <span className="oj-card-check" aria-hidden="true"><Icon name="check" /></span>}
                </li>
              )
            })}
          </ol>
        </div>
      </div>
    </section>
  )
}

export default OperatingJourney
