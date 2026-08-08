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

  // When switching stores (slug changes), reload that store's cart.
  useEffect(() => {
    try {
      setItems(JSON.parse(localStorage.getItem(cartKey) || '[]'))
    } catch {
      setItems([])
    }
  }, [cartKey])

  const add = (line: CartLine) =>
    setItems((prev) => {
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

  const remove = (index: number) => setItems((prev) => prev.filter((_, i) => i !== index))
  const setQty = (index: number, qty: number) =>
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, quantity: qty } : item)))
  const clear = () => setItems([])

  const count = items.reduce((s, i) => s + i.quantity, 0)
  const subtotal = cartSubtotal(items)

  const value: CartState = { items, add, remove, setQty, clear, count, subtotal, scopeSlug, setScopeSlug }
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}
