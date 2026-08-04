import { FunctionalComponent } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { Skeleton } from '../components/ui/Skeleton'

export function lazy<T = Record<string, any>>(
  factory: () => Promise<{ default: FunctionalComponent<T> }>,
  fallback: FunctionalComponent = () => <Skeleton rows={8} />,
): FunctionalComponent<T> {
  const Lazy: FunctionalComponent<T> = (props) => {
    const [Comp, setComp] = useState<FunctionalComponent<T> | null>(null)
    useEffect(() => {
      let cancelled = false
      factory().then((mod) => {
        if (!cancelled) setComp(() => mod.default)
      })
      return () => {
        cancelled = true
      }
    }, [])
    if (!Comp) return fallback
    return <Comp {...props} />
  }
  return Lazy
}
