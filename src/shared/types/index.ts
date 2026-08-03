export type Role = 'superAdmin' | 'merchant' | 'staff' | 'customer'

export interface FirestoreMeta {
  createdAt: { seconds: number; nanoseconds: number }
  updatedAt: { seconds: number; nanoseconds: number }
  createdBy: string
}

export interface User extends Partial<FirestoreMeta> {
  id: string
  uid: string
  email: string
  name: string
  role: Role
  storeIds: string[]
  permissions?: string[]
  photoURL?: string
  phone?: string
  active: boolean
  impersonatedBy?: string
  impersonatedUntil?: { seconds: number; nanoseconds: number }
}

export interface Store extends Partial<FirestoreMeta> {
  id: string
  ref: string
  name: string
  slug: string
  active: boolean
  ownerId: string
  currency: string
  logo?: string
  description?: string
  phone?: string
  address?: string
  theme: { primary: string; darkMode: boolean }
}

export interface Category extends Partial<FirestoreMeta> {
  id: string
  storeId: string
  name: string
  slug: string
  order: number
  active: boolean
}

export interface ProductVariant {
  color: string
  size: string
  stock: number
}

export interface Product extends Partial<FirestoreMeta> {
  id: string
  storeId: string
  name: string
  description: string
  price: number
  oldPrice?: number | null
  sku?: string | null
  categoryId?: string | null
  images: string[]
  stock: number
  variants: ProductVariant[]
  colors: string[]
  sizes: string[]
  active: boolean
  featured?: boolean
  lowStockThreshold?: number
}

export type OrderStatus =
  | 'NEW'
  | 'CONTACTED'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'RETURNED'

export interface OrderItem {
  id: string
  productId: string
  name: string
  price: number
  quantity: number
  color?: string
  size?: string
}

export interface Order extends Partial<FirestoreMeta> {
  id: string
  storeId: string
  orderNumber: string
  customerName: string
  phone: string
  governorate: string
  city: string
  address: string
  notes?: string | null
  customerId?: string | null
  items: OrderItem[]
  subtotal: number
  shippingFee: number
  discount: number
  totalPrice: number
  status: OrderStatus
  paymentMethod: string
  couponCode?: string | null
  trackingCode?: string | null
  salesLinkRef?: string | null
}

export interface Customer extends Partial<FirestoreMeta> {
  id: string
  storeId: string
  name: string
  phone: string
  email?: string
  governorate?: string
  city?: string
  address?: string
  segment?: string
  note?: string
  totalOrders: number
  totalSpent: number
  lastOrderAt?: { seconds: number; nanoseconds: number }
  tags?: string[]
}

export interface SubscriptionPlan extends Partial<FirestoreMeta> {
  id: string
  name: string
  description?: string
  priceMonthly: number
  priceYearly: number
  productLimit: number
  orderLimitPerMonth: number
  features: string[]
  active: boolean
}

export type SubscriptionStatus = 'pending' | 'active' | 'expired' | 'cancelled' | 'rejected'

export interface Subscription extends Partial<FirestoreMeta> {
  id: string
  storeId: string
  planId: string
  planName: string
  status: SubscriptionStatus
  startedAt?: { seconds: number; nanoseconds: number }
  expiresAt?: { seconds: number; nanoseconds: number }
  approvedBy?: string
  adminEmail?: string
  requestNote?: string
}

export type TransactionType = 'subscription' | 'payment' | 'refund' | 'adjustment'
export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'cancelled'

export interface Transaction extends Partial<FirestoreMeta> {
  id: string
  storeId: string
  type: TransactionType
  amount: number
  status: TransactionStatus
  description?: string
  reference?: string
  subscriptionId?: string
}

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded'

export interface Payment extends Partial<FirestoreMeta> {
  id: string
  storeId: string
  orderId?: string
  amount: number
  method: 'cod' | 'bank' | 'card' | 'wallet'
  status: PaymentStatus
  reference?: string
  paidAt?: { seconds: number; nanoseconds: number }
}

export interface Coupon extends Partial<FirestoreMeta> {
  id: string
  storeId: string
  code: string
  type: 'percent' | 'fixed'
  value: number
  minOrder?: number
  maxUses?: number
  usedCount: number
  active: boolean
  expiresAt?: { seconds: number; nanoseconds: number }
}

export interface ShippingZone extends Partial<FirestoreMeta> {
  id: string
  storeId: string
  name: string
  governorates: string[]
  fee: number
  freeAbove?: number
  active: boolean
}

export interface Notification extends Partial<FirestoreMeta> {
  id: string
  storeId?: string
  userId?: string
  title: string
  body: string
  type: 'order' | 'system' | 'billing' | 'ticket'
  read: boolean
}

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed'
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface Ticket extends Partial<FirestoreMeta> {
  id: string
  storeId?: string
  createdBy: string
  subject: string
  description: string
  status: TicketStatus
  priority: TicketPriority
  replies: { by: string; body: string; at: { seconds: number; nanoseconds: number } }[]
}

export interface AuditLog extends Partial<FirestoreMeta> {
  id: string
  storeId?: string
  userId?: string
  action: string
  resource: string
  resourceId?: string
  meta?: Record<string, unknown>
}

export interface PlatformSettings {
  id: string
  currency: string
  defaultPlanId: string
  registrationEnabled: boolean
  maintenanceMode: boolean
  contactEmail: string
  supportPhone: string
  maxStoresPerMerchant: number
  allowCustomerAccounts: boolean
}

export interface DailyAnalytics extends Partial<FirestoreMeta> {
  id: string
  storeId: string
  date: string // YYYY-MM-DD
  orders: number
  revenue: number
  newCustomers: number
  byStatus: Record<string, number>
}

export interface StoreLink extends Partial<FirestoreMeta> {
  id: string
  storeId: string
  code: string
  title: string
  active: boolean
  visits: number
  ordersCount?: number
  totalRevenue?: number
  createdBy: string
}

export interface LandingPage extends Partial<FirestoreMeta> {
  id: string
  storeId: string
  slug: string
  title: string
  subtitle?: string
  heroImage?: string
  ctaText?: string
  sections: { type: 'hero' | 'features' | 'cta' | 'testimonials'; title?: string; body?: string }[]
  active: boolean
}

export interface TeamMember extends Partial<FirestoreMeta> {
  id: string
  storeId: string
  userId: string
  role: string
  name: string
  email: string
  active: boolean
}

export interface RoleDef extends Partial<FirestoreMeta> {
  id: string
  storeId: string
  name: string
  permissions: string[]
  isSystem?: boolean
}

export interface Invitation extends Partial<FirestoreMeta> {
  id: string
  storeId: string
  email: string
  role: string
  token: string
  status: 'pending' | 'accepted' | 'expired'
  expiresAt: { seconds: number; nanoseconds: number }
}

export interface Address extends Partial<FirestoreMeta> {
  id: string
  userId: string
  storeId: string
  label: string
  name: string
  phone: string
  governorate: string
  city: string
  address: string
  isDefault?: boolean
}

export interface WishlistItem extends Partial<FirestoreMeta> {
  id: string
  userId: string
  productId: string
}

export interface CartLine {
  productId: string
  name: string
  price: number
  image?: string
  quantity: number
  color?: string
  size?: string
}

export interface ApiResult<T> {
  data: T | null
  error: string | null
}
