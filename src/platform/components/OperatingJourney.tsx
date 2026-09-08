import { FunctionalComponent } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { Icon } from '../../shared/components/ui/Icon'
import './OperatingJourney.css'

const STEPS = [
  { icon: 'storefront', labelAr: 'المتجر', labelEn: 'Store', step: '01' },
  { icon: 'shopping_bag', labelAr: 'الطلب', labelEn: 'Order', step: '02' },
  { icon: 'local_shipping', labelAr: 'الشحن', labelEn: 'Shipping', step: '03' },
  { icon: 'person', labelAr: 'العميل', labelEn: 'Customer', step: '04' },
  { icon: 'hub', labelAr: 'CRM', labelEn: 'CRM', step: '05' },
  { icon: 'bar_chart', labelAr: 'التقارير', labelEn: 'Reports', step: '06' },
] as const

// Premium van — larger, clearer, Matjari brand, not childish
function PremiumVan({ moving }: { moving: boolean }) {
  return (
    <svg viewBox="0 0 72 30" width="72" height="30" aria-hidden="true" fill="none" xmlns="http://www.w3.org/2000/svg" className="oj-van-svg">
      <g className="oj-van-body">
        {/* shadow */}
        <ellipse cx="36" cy="27" rx="22" ry="2.5" fill="currentColor" opacity="0.08" />
        {/* main body */}
        <rect x="3" y="6" width="48" height="15" rx="4" fill="currentColor" />
        <rect x="3" y="6" width="48" height="15" rx="4" fill="none" stroke="white" strokeOpacity="0.16" />
        {/* cabin */}
        <path d="M51 9 L63 9 L66 13 L66 19 L51 19 Z" fill="white" fillOpacity="0.96" stroke="currentColor" strokeOpacity="0.12" />
        <path d="M53 11.5 L62 11.5 L63.5 13.5 L63.5 17 L53 17 Z" fill="currentColor" opacity="0.14" />
        {/* window highlight */}
        <path d="M54 12.5 L60.5 12.5 L60.5 15.5 L54 15.5 Z" fill="white" opacity="0.0" />
        {/* door */}
        <path d="M33 6 V21" stroke="white" strokeOpacity="0.18" strokeWidth="1.1" />
        <rect x="7" y="10" width="20" height="2.2" rx="1.1" fill="white" opacity="0.18" />
        <rect x="7" y="13.2" width="14" height="1.6" rx="0.8" fill="white" opacity="0.12" />
        {/* headlight */}
        <rect x="65" y="13.2" width="2.2" height="3" rx="0.7" fill="#fef08a" />
        <rect x="65" y="13.2" width="2.2" height="3" rx="0.7" fill="none" stroke="white" strokeOpacity="0.6" />
        {/* wheels */}
        <g className={`oj-wheel ${moving ? 'is-spinning' : ''}`}>
          <circle cx="18" cy="23" r="5.2" fill="#0f172a" />
          <circle cx="18" cy="23" r="2.6" fill="white" />
          <circle cx="18" cy="23" r="1" fill="#0f172a" opacity="0.9" />
          <path d="M18 18 V20 M18 26 V28 M13 23 H15 M21 23 H23" stroke="white" strokeOpacity="0.95" strokeWidth="0.9" strokeLinecap="round" />
        </g>
        <g className={`oj-wheel ${moving ? 'is-spinning' : ''}`}>
          <circle cx="48" cy="23" r="5.2" fill="#0f172a" />
          <circle cx="48" cy="23" r="2.6" fill="white" />
          <circle cx="48" cy="23" r="1" fill="#0f172a" opacity="0.9" />
          <path d="M48 18 V20 M48 26 V28 M43 23 H45 M53 23 H55" stroke="white" strokeOpacity="0.95" strokeWidth="0.9" strokeLinecap="round" />
        </g>
      </g>
    </svg>
  )
}

export const OperatingJourney: FunctionalComponent = () => {
  const sectionRef = useRef<HTMLElement>(null)
  const desktopPathRef = useRef<SVGPathElement>(null)
  const mobilePathRef = useRef<SVGPathElement>(null)
  const desktopProgressRef = useRef<SVGPathElement>(null)
  const mobileProgressRef = useRef<SVGPathElement>(null)
  const [active, setActive] = useState(0)
  const [visible, setVisible] = useState(false)
  const [reduced, setReduced] = useState(false)
  const [isMoving, setIsMoving] = useState(false)
  const timerRef = useRef<number | null>(null)
  const isResettingRef = useRef(false)

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
        const e = entries[0]
        setVisible(e.isIntersecting && e.intersectionRatio > 0.16)
      },
      { threshold: [0, 0.16, 0.4] }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // setup path lengths for dasharray
  useEffect(() => {
    const setup = () => {
      const d = desktopPathRef.current
      const m = mobilePathRef.current
      const dp = desktopProgressRef.current
      const mp = mobileProgressRef.current
      if (d && dp) {
        const len = d.getTotalLength()
        dp.style.strokeDasharray = `${len}`
        dp.style.strokeDashoffset = `${len}`
      }
      if (m && mp) {
        const len = m.getTotalLength()
        mp.style.strokeDasharray = `${len}`
        mp.style.strokeDashoffset = `${len}`
      }
    }
    setup()
    window.addEventListener('resize', setup)
    return () => window.removeEventListener('resize', setup)
  }, [visible])

  // progress + van sync
  useEffect(() => {
    const dPath = desktopPathRef.current
    const mPath = mobilePathRef.current
    const dProg = desktopProgressRef.current
    const mProg = mobileProgressRef.current
    if (!dPath || !mPath || !dProg || !mProg) return
    const dLen = dPath.getTotalLength()
    const mLen = mPath.getTotalLength()
    const progress = active / (STEPS.length - 1)
    // desktop
    dProg.style.strokeDashoffset = `${dLen * (1 - progress)}`
    // mobile
    mProg.style.strokeDashoffset = `${mLen * (1 - progress)}`
    // van offset
    const dVan = document.querySelector<HTMLElement>('.oj-van--h .oj-van-inner')
    const mVan = document.querySelector<HTMLElement>('.oj-van--v .oj-van-inner')
    if (dVan) (dVan as HTMLElement).style.setProperty('--oj-offset', `${progress * 100}%`)
    if (mVan) (mVan as HTMLElement).style.setProperty('--oj-offset', `${progress * 100}%`)
  }, [active])

  // animation loop
  useEffect(() => {
    if (!visible || reduced) {
      setIsMoving(false)
      if (timerRef.current) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
      return
    }

    const travel = 1250 // 1.25s within 1.1-1.4
    const stop = 620 // 620ms within 500-750

    const scheduleNext = () => {
      if (isResettingRef.current) return
      setIsMoving(true)
      timerRef.current = window.setTimeout(() => {
        setIsMoving(false)
        timerRef.current = window.setTimeout(() => {
          if (active === STEPS.length - 1) {
            // pause at end then restart
            isResettingRef.current = true
            setActive(0)
            // keep van hidden briefly for smooth restart
            window.setTimeout(() => {
              isResettingRef.current = false
            }, 60)
            // next will be handled by effect re-run
          } else {
            setActive((v) => v + 1)
          }
        }, stop)
      }, travel)
    }

    scheduleNext()
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [active, visible, reduced])

  // reduced: show complete
  const displayActive = reduced ? STEPS.length - 1 : active

  return (
    <section
      ref={sectionRef}
      id="operating-flow"
      className={`oj-section oj-premium ${visible ? 'is-visible' : ''} ${reduced ? 'is-reduced' : ''}`}
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
          {/* Desktop curved route */}
          <div className="oj-route oj-route--desktop" aria-hidden="true">
            <svg viewBox="0 0 1000 120" preserveAspectRatio="none" className="oj-route-svg">
              <path ref={desktopPathRef} d="M 40 60 C 160 18, 260 92, 380 62 C 520 28, 620 88, 760 62 C 840 42, 900 58, 960 62" fill="none" stroke="#e7eaf1" strokeWidth="3" strokeLinecap="round" />
              <path ref={desktopProgressRef} d="M 40 60 C 160 18, 260 92, 380 62 C 520 28, 620 88, 760 62 C 840 42, 900 58, 960 62" fill="none" stroke="url(#oj-grad)" strokeWidth="3.6" strokeLinecap="round" />
              <defs>
                <linearGradient id="oj-grad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#c7d2fe" />
                  <stop offset="52%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#67e8f9" />
                </linearGradient>
              </defs>
            </svg>

            <div className="oj-nodes oj-nodes--desktop">
              {STEPS.map((s, idx) => {
                const state = idx < displayActive ? 'is-done' : idx === displayActive ? 'is-active' : ''
                return (
                  <span key={s.labelEn} className={`oj-node ${state}`} style={{ left: `${(idx / (STEPS.length - 1)) * 100}%` } as any}>
                    <i className="oj-node-dot" />
                    <i className="oj-node-ring" />
                    <i className="oj-node-glow" />
                  </span>
                )
              })}
            </div>

            <div className="oj-van oj-van--h" aria-hidden="true" style={{ opacity: visible ? 1 : 0 } as any}>
              <span className="oj-van-inner" style={{ ['--oj-offset' as any]: `${(displayActive / (STEPS.length - 1)) * 100}%` } as any}>
                <span className="oj-van-trail" />
                <PremiumVan moving={isMoving && visible && !reduced} />
              </span>
            </div>
          </div>

          {/* Mobile vertical curved route */}
          <div className="oj-route oj-route--mobile" aria-hidden="true">
            <svg viewBox="0 0 80 640" preserveAspectRatio="none" className="oj-route-svg oj-route-svg--v">
              <path ref={mobilePathRef} d="M 40 20 C 18 110, 62 190, 40 270 C 18 350, 62 430, 40 510 C 18 570, 62 610, 40 620" fill="none" stroke="#e7eaf1" strokeWidth="3" strokeLinecap="round" />
              <path ref={mobileProgressRef} d="M 40 20 C 18 110, 62 190, 40 270 C 18 350, 62 430, 40 510 C 18 570, 62 610, 40 620" fill="none" stroke="url(#oj-grad-v)" strokeWidth="3.6" strokeLinecap="round" />
              <defs>
                <linearGradient id="oj-grad-v" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#c7d2fe" />
                  <stop offset="52%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#67e8f9" />
                </linearGradient>
              </defs>
            </svg>

            <div className="oj-nodes oj-nodes--mobile">
              {STEPS.map((s, idx) => {
                const state = idx < displayActive ? 'is-done' : idx === displayActive ? 'is-active' : ''
                return (
                  <span key={s.labelEn} className={`oj-node ${state}`} style={{ top: `${(idx / (STEPS.length - 1)) * 100}%` } as any}>
                    <i className="oj-node-dot" />
                    <i className="oj-node-ring" />
                  </span>
                )
              })}
            </div>

            <div className="oj-van oj-van--v" aria-hidden="true">
              <span className="oj-van-inner" style={{ ['--oj-offset' as any]: `${(displayActive / (STEPS.length - 1)) * 100}%` } as any}>
                <span className="oj-van-trail oj-van-trail--v" />
                <span className="oj-van-rotate">
                  <PremiumVan moving={isMoving && visible && !reduced} />
                </span>
              </span>
            </div>
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
