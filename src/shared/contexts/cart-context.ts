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
}

export const CartContext = createContext<CartState>({
  items: [],
  add: () => {},
  remove: () => {},
  setQty: () => {},
  clear: () => {},
  count: 0,
  subtotal: 0,
})
