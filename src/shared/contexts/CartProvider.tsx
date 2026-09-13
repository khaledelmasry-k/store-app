import { FunctionalComponent } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { useLocation } from 'wouter'
import { CartContext, type CartState } from './cart-context'
import { parseStoreLocation } from '../utils/store-route'
import { cartSubtotal } from '../utils/pricing'
import type { CartLine } from '../types'

const CART_KEY = 'mk-cart'

export const CartProvider: FunctionalComponent = ({ children }) => {
  const [loc] = useLocation()
  const { slug: urlSlug } = parseStoreLocation(loc)
  // Standalone pages (e.g. /landing/:slug) carry no store slug in the URL, so
  // they can pin the cart to a store via setScopeSlug. The URL slug wins when
  // present; otherwise the override applies.
  const [scopeSlug, setScopeSlug] = useState<string | null>(null)
  const slug = urlSlug || scopeSlug
  // Scope the cart per store so items from store A never leak into store B's
  // checkout (the backend rejects cross-tenant items anyway).
  const cartKey = slug ? `${CART_KEY}-${slug}` : CART_KEY

  const [items, setItems] = useState<CartLine[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(cartKey) || '[]')
    } catch {
      return []
    }
  })

  useEffect(() => {
    localStorage.setItem(cartKey, JSON.stringify(items))
  }, [cartKey, items])

  // Persist mutations synchronously as well as after render. A shopper can
  // navigate immediately after pressing “add to cart”; relying only on the
  // render effect risks losing that just-added line during a document route
  // transition.
  const updateItems = (updater: (previous: CartLine[]) => CartLine[]) => {
    setItems((previous) => {
      const next = updater(previous)
      try {
        localStorage.setItem(cartKey, JSON.stringify(next))
      } catch {
        // The normal effect remains the best-effort persistence fallback.
      }
      return next
    })
  }

  // When switching stores (slug changes), reload that store's cart.
  useEffect(() => {
    try {
      setItems(JSON.parse(localStorage.getItem(cartKey) || '[]'))
    } catch {
      setItems([])
    }
  }, [cartKey])

  const add = (line: CartLine) =>
    updateItems((prev) => {
      // Bundle (quantity) pricing lines never merge — each add is a distinct
      // bundle selection (merging would sum quantities and break the tier).
      if (line.pricingMode === 'quantity') return [...prev, line]
      const idx = prev.findIndex(
        (i) =>
          i.productId === line.productId &&
          // Prefer exact-variant identity so different variants never collapse
          // into one line; fall back to color+size for legacy cart entries.
          ((line.variantId && i.variantId === line.variantId) ||
            (!line.variantId && i.color === line.color && i.size === line.size)),
      )
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], quantity: next[idx].quantity + line.quantity }
        return next
      }
      return [...prev, line]
    })

  const remove = (index: number) => updateItems((prev) => prev.filter((_, i) => i !== index))
  const setQty = (index: number, qty: number) =>
    updateItems((prev) => prev.map((item, i) => (i === index ? { ...item, quantity: qty } : item)))
  const clear = () => updateItems(() => [])

  const count = items.reduce((s, i) => s + i.quantity, 0)
  const subtotal = cartSubtotal(items)

  const value: CartState = { items, add, remove, setQty, clear, count, subtotal, scopeSlug, setScopeSlug }
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}
