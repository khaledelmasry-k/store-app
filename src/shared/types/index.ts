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

export interface StoreTheme {
  primary: string
  secondary?: string
  darkMode: boolean
  /** Selected storefront template id (see shared/utils/themes.ts). */
  template?: string
}

/** Shipping provider a store works with (e.g. Aramex, Bosta, local courier). */
export interface ShippingProvider {
  id: string
  name: string
  /** Flat fee charged by this provider (fallback when no zone matches). */
  fee: number
  estimatedDays?: string
  active: boolean
}

export type ShippingModel = 'flat' | 'zones'

/** Per-store shipping configuration. */
export interface StoreShipping {
  /** Master switch — when false, no shipping fee is charged at checkout. */
  enabled: boolean
  /** flat = single flat fee; zones = per-governorate shipping zones. */
  model: ShippingModel
  /** Flat fee used when model === 'flat'. */
  flatFee: number
  /** Free shipping above this subtotal (0/undefined = disabled). */
  freeAbove?: number
  /** Policy shown at checkout for refused deliveries. */
  refusedPolicy?: string
  /** Preferred shipping providers used by this store. */
  providers?: ShippingProvider[]
}

export interface Store extends Partial<FirestoreMeta> {
  id: string
  ref: string
  name: string
  slug: string
  active: boolean
  /** Whether the storefront is publicly visible and can accept orders. */
  published: boolean
  ownerId: string
  currency: string
  logo?: string
  description?: string
  phone?: string
  address?: string
  seoTitle?: string
  seoDescription?: string
  theme: StoreTheme
  shipping?: StoreShipping
}

export interface Category extends Partial<FirestoreMeta> {
  id: string
  storeId: string
  name: string
  slug: string
  order: number
  active: boolean
}

/** A color the merchant can assign to a product, optionally mapped to images. */
export interface ColorOption {
  id: string
  name: string
  hex: string
  /** Index into `Product.images` — the image shown when this color is selected. */
  imageIndex?: number
  /** All image indexes valid for this color (defaults to `imageIndex`). */
  imageIndexes?: number[]
}

export interface ProductVariant {
  /** Stable variant id (nanoid for new products; legacy: `${color}|${size}`). */
  id?: string
  color?: string
  /** Links the variant to a ColorOption when present. */
  colorId?: string
  size?: string
  sku?: string
  /** Optional per-variant price — falls back to the product price. */
  price?: number
  stock: number
  /** Index into `Product.images` for a variant-specific image. */
  imageIndex?: number
}

/** One quantity-pricing tier. `maxQuantity: null` means "from minQuantity upward". */
export interface QuantityTier {
  minQuantity: number
  maxQuantity: number | null
  price: number
}

export type PricingMode = 'standard' | 'quantity'

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
  /** Rich color definitions (name/hex/image mapping). Legacy products omit this. */
  colorOptions?: ColorOption[]
  /** Pricing mode — 'standard' (unit price) or 'quantity' (tiered bulk pricing). */
  pricingMode?: PricingMode
  /** Quantity tiers, used when `pricingMode === 'quantity'`. */
  quantityTiers?: QuantityTier[]
  active: boolean
  featured?: boolean
  lowStockThreshold?: number
}

/** Variant display label, e.g. "أسود / M". */
export function variantLabel(color?: string | null, size?: string | null): string {
  return [color, size].filter(Boolean).join(' / ')
}

/** Deterministic fallback variant id for legacy variants without an explicit id. */
export function legacyVariantId(color?: string | null, size?: string | null): string {
  return `${color || ''}|${size || ''}`
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
  /** Exact variant id when the customer selected a variant. */
  variantId?: string
  /** Unit price actually charged (may differ from base price under quantity pricing). */
  unitPrice?: number
  /** Pricing snapshot — 'standard' or 'quantity'. */
  pricingMode?: PricingMode
}

/** Snapshot of the shipping calculation at order time. */
export interface ShippingSnapshot {
  enabled: boolean
  model?: ShippingModel
  freeDelivery?: boolean
  providerId?: string | null
  zoneId?: string | null
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
  /** Shipping method label captured at order time. */
  shippingMethod?: string
  /** Snapshot of the shipping configuration/quote at order time. */
  shippingSnapshot?: ShippingSnapshot
  discount: number
  totalPrice: number
  status: OrderStatus
  paymentMethod: string
  couponCode?: string | null
  trackingCode?: string | null
  salesLinkRef?: string | null
  salesLinkId?: string | null
  salesLinkStaffId?: string | null
  salesLinkSnapshot?: SalesLinkSnapshot | null
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

export type OrderUsageLevel = 'none' | 'normal' | 'moderate' | 'approaching' | 'near' | 'reached'

/** One row of the Super Admin operational view (getPlatformOverview). */
export interface PlatformMerchantRow {
  storeId: string
  storeName: string
  ref: string
  slug: string
  active: boolean
  published: boolean
  createdAt?: { seconds: number; nanoseconds: number } | null
  ownerName: string | null
  ownerEmail: string | null
  ownerRole: string | null
  subId: string | null
  planId: string | null
  planName: string | null
  planPriceMonthly: number
  productLimit: number
  subStatus: SubscriptionStatus | null
  subStartedAt?: { seconds: number; nanoseconds: number } | null
  subExpiresAt?: { seconds: number; nanoseconds: number } | null
  orderLimit: number
  ordersUsed: number
  remaining: number | null
  usagePercent: number
  usageLevel: OrderUsageLevel
}

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
  /** Live counter of orders created during the current subscription period. */
  ordersUsed?: number
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
  estimatedDays?: string
  providerId?: string
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

export type StoreLinkDestinationType = 'home' | 'catalog' | 'product' | 'landing' | 'custom'

export interface StoreLink extends Partial<FirestoreMeta> {
  id: string
  storeId: string
  /** Short unique code used in the public `/s/:code` URL. */
  code: string
  /** Display name (e.g. "رابط فيسبوك لمحمود"). */
  name: string
  title: string
  active: boolean
  /** Hidden from the storefront + redirect (soft-delete). */
  archived?: boolean
  visits: number
  ordersCount?: number
  totalRevenue?: number
  sellerName?: string
  staffId?: string
  /** Where the link should take visitors. */
  destinationType: StoreLinkDestinationType
  /** Product id / landing page id / custom URL depending on destinationType. */
  destinationId?: string
  /** Campaign/tracking metadata (UTM-ish). */
  source?: string
  campaign?: string
  content?: string
  createdBy: string
}

/** Snapshot of the sales link captured on the order at creation time. */
export interface SalesLinkSnapshot {
  code: string
  title?: string
  sellerName?: string
  destinationType?: StoreLinkDestinationType
}

export type LandingPageStatus = 'draft' | 'published'

export interface LandingHero {
  image?: string
  title: string
  subtitle?: string
  ctaText?: string
}

export interface LandingSectionItem {
  title?: string
  body?: string
}

export interface LandingSection {
  type: 'features' | 'steps' | 'testimonials' | 'faq' | 'cta'
  title?: string
  body?: string
  items?: LandingSectionItem[]
}

export interface LandingPage extends Partial<FirestoreMeta> {
  id: string
  storeId: string
  slug: string
  title: string
  status: LandingPageStatus
  /** Storefront template id used for rendering (see shared/utils/themes.ts). */
  template: string
  /** Featured product shown in the embedded QuickBuy panel. */
  productId?: string | null
  hero: LandingHero
  seo?: { title?: string; description?: string }
  sections: LandingSection[]
  views: number
  /** DELIVERED-only orders attributed to this page. */
  ordersCount: number
  /** DELIVERED-only revenue attributed to this page. */
  totalRevenue: number
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
  /** Exact variant id — used to merge/keep distinct variants in the cart. */
  variantId?: string
  /** Pricing mode snapshot at add-time — used to recompute line totals with quantity pricing. */
  pricingMode?: PricingMode
  /** Quantity tiers snapshot at add-time. */
  quantityTiers?: QuantityTier[]
}

export interface ApiResult<T> {
  data: T | null
  error: string | null
}
