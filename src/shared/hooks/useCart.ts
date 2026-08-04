import { useContext } from 'preact/hooks'
import { CartContext } from '../contexts/cart-context'

export function useCart() {
  return useContext(CartContext)
}
