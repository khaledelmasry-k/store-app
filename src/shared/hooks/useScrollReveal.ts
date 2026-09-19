import { useEffect } from 'preact/hooks'
import type { RefObject } from 'preact'

/** Gap between neighbouring items in the same row/grid, in ms. */
const STAGGER_MS = 70
/** Cap the cascade so a long grid never keeps the last card waiting. */
const MAX_STAGGER_STEPS = 5

/**
 * Reveals elements as they scroll into view — they rise and fade in.
 *
 * Safety contract: the CSS that hides an element is scoped to the
 * `has-scroll-reveal` class, and this hook only sets that class once the
 * observer is actually running. If JS never executes, the browser lacks
 * IntersectionObserver, or the visitor asked for reduced motion, the class is
 * never set and every element renders at its normal opacity. Content is never
 * left invisible by a failure in here.
 *
 * Revealing is one-shot: an element is unobserved once shown, so scrolling
 * back up does not replay the animation.
 *
 * @param ref       container to search within
 * @param selector  CSS selector for the elements to reveal
 */
export function useScrollReveal(ref: RefObject<HTMLElement>, selector: string) {
  useEffect(() => {
    const root = ref.current
    if (!root) return
    if (typeof IntersectionObserver === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const targets = Array.from(root.querySelectorAll<HTMLElement>(selector))
    if (targets.length === 0) return

    for (const el of targets) el.setAttribute('data-reveal', '')
    document.documentElement.classList.add('has-scroll-reveal')

    const observer = new IntersectionObserver(
      (entries) => {
        // Items that cross the threshold together are usually a row of cards.
        // Cascade them by their position among the siblings entering in the
        // same batch, so a grid unfolds instead of snapping in as one block.
        const arriving = entries.filter((entry) => entry.isIntersecting)
        const seenPerParent = new Map<Element | null, number>()

        for (const entry of arriving) {
          const el = entry.target as HTMLElement
          const parent = el.parentElement
          const order = seenPerParent.get(parent) ?? 0
          seenPerParent.set(parent, order + 1)

          el.style.setProperty('--reveal-delay', `${Math.min(order, MAX_STAGGER_STEPS) * STAGGER_MS}ms`)
          el.classList.add('is-revealed')
          observer.unobserve(el)
        }
      },
      // Start slightly before the element is fully in view so the motion reads
      // as the page arriving, not as a delayed reaction to the scroll.
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    )

    for (const el of targets) observer.observe(el)

    return () => {
      observer.disconnect()
      for (const el of targets) {
        el.removeAttribute('data-reveal')
        el.style.removeProperty('--reveal-delay')
      }
    }
  }, [ref, selector])
}

export default useScrollReveal
