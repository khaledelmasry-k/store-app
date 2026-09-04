import type { Order } from '../types'
import { STATUS_COLORS, STATUS_LABELS } from './constants'

/** A carrier failure is not a terminal order state, but it must be visible
 * wherever an order is displayed instead of being hidden behind “shipped”. */
export function visibleOrderStatus(order: Pick<Order, 'status' | 'shipmentStatus'>): string {
  return String(order.shipmentStatus || '').toUpperCase() === 'FAILED' ? 'FAILED' : String(order.status || 'NEW')
}

export function visibleOrderStatusLabel(order: Pick<Order, 'status' | 'shipmentStatus'>): string {
  const status = visibleOrderStatus(order)
  return status === 'FAILED' ? 'تعذر التسليم' : (STATUS_LABELS[status as keyof typeof STATUS_LABELS] || status)
}

export function visibleOrderStatusTone(order: Pick<Order, 'status' | 'shipmentStatus'>): string {
  const status = visibleOrderStatus(order)
  return status === 'FAILED' ? 'red' : (STATUS_COLORS[status as keyof typeof STATUS_COLORS] || 'slate')
}
