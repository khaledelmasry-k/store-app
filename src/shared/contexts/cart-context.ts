import { createContext } from 'preact'
import type { CartLine } from '../types'

export interface CartState {
  items: CartLine[]
  add: (line: CartLine) => void
  remove: (index: number) => void
  setQty: (index: number, qty: number) => void
  clear: () => void
  count: number
  subtotal: number
  /** The store slug the cart is currently scoped to (null = unscoped). */
  scopeSlug: string | null
  /**
   * Pins the cart to a specific store's scope (used by the standalone
   * `/landing/:slug` page, whose URL carries no store slug). The URL-scoped
   * slug always wins when present; the override only applies otherwise.
   */
  setScopeSlug: (slug: string | null) => void
}

export const CartContext = createContext<CartState>({
  items: [],
  add: () => {},
  remove: () => {},
  setQty: () => {},
  clear: () => {},
  count: 0,
  subtotal: 0,
  scopeSlug: null,
  setScopeSlug: () => {},
})
