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
  /** Platform approval state for merchant onboarding. Absent on legacy users. */
  merchantStatus?: 'pending_approval' | 'active' | 'rejected' | 'suspended' | 'deleting'
  impersonatedBy?: string
  impersonatedUntil?: { seconds: number; nanoseconds: number }
  addresses?: UserAddress[]
  onboardingTourCompleted?: boolean
  onboardingTourSkipped?: boolean
  onboardingTourVersion?: number
}

export interface UserAddress {
  id: string
  label: string
  name: string
  phone: string
  governorate: string
  city: string
  area?: string
  address: string
  isDefault: boolean
}

export interface StoreTheme {
  primary: string
  secondary?: string
  darkMode: boolean
  /** Selected storefront template id (see shared/utils/themes.ts). */
  template?: string
  /** How product images are framed on the storefront: as uploaded (contain) or cropped to fill (cover). */
  imageFit?: 'contain' | 'cover'
}

/** Legacy embedded provider shape, retained for old store documents only. */
export interface ShippingProvider {
  id: string
  name: string
  /** Flat fee charged by this provider (fallback when no zone matches). */
  fee: number
  estimatedDays?: string
  active: boolean
}

/** Legacy marketplace carrier shape, retained for old shipment compatibility. */
export interface ShippingCompany extends Partial<FirestoreMeta> {
  id: string
  name: string
  logo?: string
  status: 'active' | 'disabled' | 'pending'
  zones?: string[]
  ratesByZone?: Record<string, { deliveryPrice: number; returnPrice?: number; codFee?: number; additionalFees?: number; estimatedDays?: string }>
  services?: string[]
  averageRating?: number
  reviewsCount?: number
  completedShipments?: number
  deliverySuccessRate?: number
}

export type ShippingProviderStatus = 'active' | 'inactive' | 'draft'
export type ShippingIntegrationType = 'api' | 'manual'
export type ShippingCredentialMode = 'platform' | 'merchant' | 'hybrid'

export interface ShippingZoneRule {
  zoneId: string
  zoneName: string
  country?: string
  governorates?: string[]
  cities?: string[]
  areas?: string[]
  excludedGovernorates?: string[]
  excludedCities?: string[]
  excludedAreas?: string[]
  baseRate: number
  codFee?: number
  returnFee?: number
  extraKgRate?: number
  baseWeight?: number
  freeShippingThreshold?: number
  etaMin?: number
  etaMax?: number
  etaUnit?: 'hours' | 'days'
  enabled?: boolean
}

/** A provider-owned service. Rates and ETAs are resolved server-side. */
export interface ShippingProviderService {
  code: string
  name: string
  enabled?: boolean
  serviceType?: 'same_day' | 'next_day' | 'standard' | 'economy' | 'express' | 'custom'
  estimatedMinHours?: number
  estimatedMaxHours?: number
  supportsCOD?: boolean
  supportsReturns?: boolean
  supportsPickup?: boolean
  supportedZones?: string[]
  rateMode?: 'api' | 'fixed' | 'zone' | 'weight' | 'hybrid' | 'provider'
  fixedRate?: number
  freeShippingThreshold?: number
  baseWeight?: number
  extraKgRate?: number
  zoneRules?: ShippingZoneRule[]
}

/** Platform-owned provider definition. Credentials are never part of this type. */
export interface ShippingProviderDefinition extends Partial<FirestoreMeta> {
  id: string
  name: string
  slug: string
  logoUrl?: string | null
  description?: string
  status: ShippingProviderStatus
  integrationType: ShippingIntegrationType
  credentialMode: ShippingCredentialMode
  supportsCOD?: boolean
  supportsReturns?: boolean
  supportsTracking?: boolean
  supportsWebhooks?: boolean
  supportsPickup?: boolean
  supportedCountries?: string[]
  defaultServiceCodes?: string[]
  services?: ShippingProviderService[]
  allowMerchantRateOverride?: boolean
  adapterConfigured?: boolean
  lastTestedAt?: { seconds: number; nanoseconds: number } | null
}

/** Store-owned provider configuration. Secrets remain server-side. */
export interface StoreShippingProviderConfig extends Partial<FirestoreMeta> {
  id: string
  storeId: string
  providerId: string
  enabled: boolean
  displayName?: string
  serviceCode?: string
  pickupAddressId?: string | null
  codEnabled?: boolean
  returnEnabled?: boolean
  defaultPackageWeight?: number
  rateMode?: 'api' | 'fixed' | 'zone' | 'weight' | 'hybrid'
  fixedRate?: number
  freeShippingThreshold?: number
  enabledServiceCodes?: string[]
  rateMarkup?: number
  etaMinHours?: number
  etaMaxHours?: number
  allowRateOverride?: boolean
  configurationStatus: 'not_configured' | 'needs_setup' | 'ready' | 'error' | 'suspended' | 'NOT_CONFIGURED' | 'CONFIGURED' | 'CONNECTED' | 'ERROR' | 'EXPIRED' | 'DISABLED' | 'INVALID_CREDENTIALS' | 'PROVIDER_UNAVAILABLE' | 'CONFIGURATION_ERROR'
  maskedAccountIdentifier?: string | null
  lastVerifiedAt?: { seconds: number; nanoseconds: number } | null
  isDefault?: boolean
  /** Wasla-specific pickup profile and destination name-to-ID mapping. */
  waslaPickupLocationType?: string
  waslaPickupLocationName?: string
  waslaPickupContactPhone?: string
  waslaPickupAddressLine1?: string
  waslaPickupGovernorateId?: number
  waslaPickupCityId?: number
  waslaGovernorateIds?: Record<string, number>
  waslaCityIds?: Record<string, number>
  credential?: {
    status: string
    maskedCredentials?: Record<string, string | null>
    lastValidatedAt?: { seconds: number; nanoseconds: number } | null
    lastValidationStatus?: string | null
  } | null
}

export interface ShipmentPriceSnapshot {
  shippingCompanyId: string
  shippingCompanyName: string
  zoneId?: string
  deliveryPrice: number
  returnPrice: number
  codFee: number
  additionalFees: number
  quotedAt: { seconds: number; nanoseconds: number } | string
}

export interface Shipment extends Partial<FirestoreMeta> {
  id: string
  storeId: string
  orderId: string
  active?: boolean
  status: string
  shippingCompanyId?: string
  shippingCompanyName?: string
  providerId?: string
  provider?: string
  providerName?: string
  integrationType?: 'api' | 'manual'
  providerShipmentId?: string
  trackingUrl?: string | null
  events?: Array<{ status: string; at: { seconds: number; nanoseconds: number }; note?: string }>
  priceSnapshot?: ShipmentPriceSnapshot
  trackingNumber?: string
  externalShipmentId?: string | null
  failureReason?: string | null
  labelUrl?: string | null
  documentAvailable?: boolean
  documentProvider?: string | null
  documentVerifiedAt?: { seconds: number; nanoseconds: number } | null
  shippingCost?: number | null
  codAmount?: number
  currentStatus?: string
  lastSyncedAt?: { seconds: number; nanoseconds: number } | null
  customerShippingFee?: number
  carrierShippingCost?: number
  carrierReturnCost?: number
  // Set only by the server-side settlement workflow. It means the merchant
  // confirmed receipt of the carrier's COD remittance for this shipment.
  settlementId?: string | null
  settledAt?: { seconds: number; nanoseconds: number } | null
  settlementReference?: string | null
}

/** An auditable COD remittance recorded by the merchant. Carriers do not
 * expose a settlement feed in every API, so this is deliberately a confirmed
 * ledger entry rather than an inferred bank transfer. */
export interface ShippingSettlement extends Partial<FirestoreMeta> {
  id: string
  storeId: string
  providerId: string
  providerName: string
  shipmentIds: string[]
  shipmentCount: number
  grossCodCollected: number
  carrierFees: number
  netMerchantDue: number
  reference?: string | null
  note?: string | null
  settledAt?: { seconds: number; nanoseconds: number } | null
  createdBy?: string
}

export interface ShippingCompanyReview extends Partial<FirestoreMeta> {
  id: string
  merchantId: string
  shippingCompanyId: string
  shipmentId: string
  orderId: string
  pickupSpeed: number
  deliverySpeed: number
  reliability: number
  shipmentCondition: number
  supportQuality: number
  overallRating: number
  comment?: string
}

export type ShippingModel = 'flat' | 'zones'

/** Legacy per-store shipping configuration kept for migration/read fallback. */
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
  /** When false (or unset), the refused-policy text is hidden at checkout. */
  refusedPolicyEnabled?: boolean
  /** Preferred provider used for the flat model when there are several. */
  defaultProviderId?: string
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
  /** Canonical storefront publication state. `published` is retained as a
   * compatibility flag for legacy documents and public projections. */
  storeStatus?: 'draft' | 'published' | 'suspended'
  ownerId: string
  /** Canonical pointer to the one effective subscription for this store. */
  activeSubscriptionId?: string
  /** SuperAdmin-only safety marker: destructive test cleanup only targets stores with this flag. */
  isTestMerchant?: boolean
  currency: string
  logo?: string
  /** Hero banner image shown at the top of the storefront home page. */
  heroImage?: string
  /** Legacy alias retained so older storefront banners continue to render. */
  hero?: string
  description?: string
  phone?: string
  address?: string
  seoTitle?: string
  seoDescription?: string
  theme: StoreTheme
  shipping?: StoreShipping
  /** Bytes of uploaded assets currently used by this store (maintained server-side). */
  storageUsed?: number
  /** Bytes of storage quota granted by the active plan (0/missing = unlimited). */
  storageLimitBytes?: number
}

export interface Category extends Partial<FirestoreMeta> {
  id: string
  storeId: string
  name: string
  slug: string
  order: number
  active: boolean
  /** Archived legacy plans remain readable for historical subscriptions but are not purchasable. */
  isPurchasable?: boolean
  archived?: boolean
  status?: 'active' | 'archived'
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

/**
 * One quantity-pricing tier: a bundle of exactly `quantity` pieces priced at a
 * TOTAL `price`. The price is the full package price, never a per-piece price.
 * Legacy tiers may carry `minQuantity`/`maxQuantity` (unit-price semantics) —
 * the pricing engine detects that shape for backward compatibility.
 */
export interface QuantityTier {
  quantity: number
  price: number
  /** Legacy range field — ignored for new products. */
  minQuantity?: number
  /** Legacy range field — ignored for new products. */
  maxQuantity?: number | null
}

export type PricingMode = 'standard' | 'quantity'

/**
 * How quantity pricing behaves when the requested quantity exceeds the highest
 * configured bundle tier.
 * - 'cap'    (default, safest): highest bundle total + remaining units at base price.
 * - 'repeat' : repeat the highest bundle as many times as it fits, remainder at base price.
 * - 'last'   : always charge the highest bundle total once, regardless of overflow.
 */
export type QuantityPricingStrategy = 'cap' | 'repeat' | 'last'

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
  /** Behavior when quantity exceeds the highest tier (default 'cap'). */
  quantityPricingStrategy?: QuantityPricingStrategy
  active: boolean
  /** Canonical storefront featured flag; `featured` is retained for legacy reads. */
  isFeatured?: boolean
  featured?: boolean
  lowStockThreshold?: number
}

/**
 * Private merchant cost data, keyed by the product id. Lives in its OWN
 * collection (`productCosts`) — NEVER on the public `products` doc — so the
 * storefront / customers can never read it. Readable only by the owning
 * merchant, staff with a product view permission, or the platform admin.
 */
export interface ProductCost extends Partial<FirestoreMeta> {
  id: string
  storeId: string
  /** Cost per unit at the product level. Private merchant data. */
  costPrice: number
  /** Estimated customer-acquisition cost allocated to a successful sale. */
  estimatedAdCostPerSale?: number
  /** Whether the estimate applies once per order or once per item. */
  estimatedAdCostMode?: 'per_order' | 'per_item'
  /** Optional per-variant cost, keyed by variant id. */
  variantCosts?: Record<string, number>
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
  /** Authoritative charged amount for this line (bundle total under quantity pricing). */
  lineTotal?: number
  /** Snapshot of the selected quantity tier (quantity pricing only). */
  quantityTier?: { quantity: number; price: number }
  /** Pricing strategy snapshot at order time (quantity pricing only). */
  quantityPricingStrategy?: QuantityPricingStrategy
}

export interface OrderItemCostSnapshot {
  lineId: string
  productId: string
  variantId?: string | null
  quantity: number
  /** Private merchant-only unit cost captured when the order was created. */
  costPrice: number
  source: 'product' | 'variant'
  estimatedAdCostSnapshot?: number
  estimatedAdCostMode?: 'per_order' | 'per_item'
  capturedAt?: { seconds: number; nanoseconds: number }
}

/**
 * Private merchant/platform cost snapshot for an order. Kept OUTSIDE the
 * customer-readable `orders` document so storefront tracking never exposes
 * cost price while historical gross profit stays stable after cost edits.
 */
export interface OrderCost extends Partial<FirestoreMeta> {
  id: string
  orderId: string
  storeId: string
  items: OrderItemCostSnapshot[]
}

/** Snapshot of the shipping calculation at order time. */
export interface ShippingSnapshot {
  enabled: boolean
  model?: ShippingModel
  freeDelivery?: boolean
  providerId?: string | null
  providerName?: string | null
  providerSlug?: string | null
  serviceCode?: string | null
  serviceName?: string | null
  rate?: number
  currency?: string
  etaMin?: number | null
  etaMax?: number | null
  etaUnit?: 'hours' | 'days' | null
  zoneId?: string | null
  zoneName?: string | null
  codFee?: number
  returnFee?: number
  weightKg?: number
}

export interface Order extends Partial<FirestoreMeta> {
  id: string
  storeId: string
  orderNumber: string
  customerName: string
  phone: string
  governorate: string
  city: string
  area?: string
  address: string
  notes?: string | null
  customerId?: string | null
  /** 'guest' when the order was placed without an account, 'registered' after claim/sign-in. */
  customerType?: 'guest' | 'registered'
  /** Firestore id of the linked customers/{id} doc (upserted by storeId+phone). */
  customerDocId?: string | null
  /** Ordered list of status transitions captured from the backend. */
  statusHistory?: { status: OrderStatus; at: { seconds: number; nanoseconds: number }; by?: string }[]
  items: OrderItem[]
  subtotal: number
  shippingFee: number
  /** Shipping method label captured at order time. */
  shippingMethod?: string
  shippingProviderId?: string | null
  shippingProviderName?: string | null
  shippingRate?: number
  /** Snapshot of the shipping configuration/quote at order time. */
  shippingSnapshot?: ShippingSnapshot
  discount: number
  totalPrice: number
  status: OrderStatus
  paymentMethod: string
  couponCode?: string | null
  trackingCode?: string | null
  activeShipmentId?: string | null
  shipmentProviderId?: string | null
  shipmentStatus?: string | null
  shippingCreationStatus?: 'PROCESSING' | 'CREATED' | 'FAILED' | null
  shippingCreationErrorCode?: string | null
  shippingCreationErrorMessage?: string | null
  shippingLastAttemptAt?: { seconds: number; nanoseconds: number } | null
  shippingRetryCount?: number
  /** Merchant-managed return lifecycle. Inventory is restored only after receipt is confirmed. */
  returnStatus?: 'REQUESTED' | 'RECEIVED' | null
  returnRequestedAt?: { seconds: number; nanoseconds: number } | null
  returnReceivedAt?: { seconds: number; nanoseconds: number } | null
  salesLinkRef?: string | null
  salesLinkId?: string | null
  salesLinkStaffId?: string | null
   salesLinkSnapshot?: SalesLinkSnapshot | null
  campaignId?: string | null
  campaignNameSnapshot?: string | null
  attributionSource?: string | null
  utmSource?: string | null
  utmCampaign?: string | null
   /** True once stock has been restored for a cancelled/returned order (idempotency). */
   stockRestored?: boolean
}

export interface Customer extends Partial<FirestoreMeta> {
  id: string
  storeId: string
  name: string
  phone: string
  /** Normalized phone digits (EG: 01XXXXXXXXX) used for dedup and lookup. */
  phoneNormalized?: string
  email?: string
  governorate?: string
  city?: string
  area?: string
  address?: string
  segment?: string
  /** CRM stage — canonical. Legacy `segment` is retained for back-compat. */
  stage?: string
  note?: string
  /** Merchant notes history (append-only, newest last). */
  notes?: { body: string; at: { seconds: number; nanoseconds: number }; by?: string }[]
  /** GUEST (checkout without account) or REGISTERED (claimed/account). */
  type?: 'guest' | 'registered'
  /** Auth uid of the linked account when registered. */
  userId?: string | null
  totalOrders: number
  totalSpent: number
  lastOrderAt?: { seconds: number; nanoseconds: number }
  tags?: string[]
  /** Marketing attribution snapshots captured at last order. */
  lastSalesLinkId?: string | null
  lastSalesLinkCode?: string | null
  lastCampaignId?: string | null
  lastUtmSource?: string | null
  lastUtmCampaign?: string | null
  attributionSource?: string | null
  /** CRM computed metrics cache (refreshed on order events). */
  metrics?: CustomerMetrics
  /** Addresses history — primary is governorate/city/address, extras in array. */
  addresses?: CustomerAddress[]
  /** Follow-up summary (denormalized count of pending). */
  pendingFollowUpsCount?: number
  nextFollowUpAt?: { seconds: number; nanoseconds: number } | null
}

export interface CustomerAddress {
  id: string
  label?: string
  governorate: string
  city: string
  area?: string
  address: string
  isDefault?: boolean
}

export type CrmStage = 'lead' | 'new' | 'active' | 'repeat' | 'vip' | 'at_risk' | 'lost'

export interface CustomerFollowUp extends Partial<FirestoreMeta> {
  id: string
  storeId: string
  customerId: string
  /** Customer phone snapshot for quick display without extra join. */
  customerName?: string
  customerPhone?: string
  dueAt: { seconds: number; nanoseconds: number }
  status: 'pending' | 'done' | 'cancelled' | 'overdue'
  notes?: string
  result?: string
  assignedTo?: string | null
  assignedToName?: string | null
  createdBy?: string
  completedAt?: { seconds: number; nanoseconds: number } | null
}

export type CustomerTimelineType =
  | 'customer.created'
  | 'customer.updated'
  | 'customer.note'
  | 'customer.tag'
  | 'customer.stage_change'
  | 'order.created'
  | 'order.status_changed'
  | 'order.cancelled'
  | 'order.returned'
  | 'payment'
  | 'shipment.created'
  | 'shipment.delivered'
  | 'shipment.returned'
  | 'shipment.failed'
  | 'follow_up.created'
  | 'follow_up.completed'
  | 'follow_up.cancelled'
  | 'note.added'
  | 'notification.sent'

export interface CustomerTimelineEvent extends Partial<FirestoreMeta> {
  id: string
  storeId: string
  customerId: string
  type: CustomerTimelineType
  title: string
  body?: string
  orderId?: string | null
  orderNumber?: string | null
  shipmentId?: string | null
  followUpId?: string | null
  meta?: Record<string, unknown>
  createdBy?: string
}

export interface CustomerMetrics {
  totalOrders: number
  deliveredOrders: number
  cancelledOrders: number
  returnedOrders: number
  shippedOrders: number
  totalRevenue: number
  avgOrderValue: number
  lifetimeValue: number
  lastOrderAt?: { seconds: number; nanoseconds: number } | null
  lastOrderNumber?: string | null
  lastOrderStatus?: string | null
  daysSinceLastOrder?: number | null
  returnRate: number
  cancellationRate: number
  repeatPurchaseRate: number
  frequency?: number
  // enriched
  products?: { productId: string; name: string; qty: number; revenue: number }[]
  topProduct?: { productId: string; name: string } | null
  salesLinkId?: string | null
  campaignId?: string | null
}

export interface SubscriptionPlan extends Partial<FirestoreMeta> {
  id: string
  name: string
  /** URL-friendly plan slug (e.g. "starter"). Defaults to id if unset. */
  slug?: string
  description?: string
  priceMonthly: number
  priceYearly: number
  /** Commercial model. Existing plans default to recurring subscriptions. */
  billingModel?: 'subscription' | 'one_time'
  /** Server-priced lifetime store offer (used when billingModel is one_time). */
  oneTimePrice?: number
  productLimit: number
  orderLimitPerMonth: number
  features: string[]
  active: boolean
  /** Archived legacy plans remain readable for historical subscriptions but are not purchasable. */
  isPurchasable?: boolean
  archived?: boolean
  status?: 'active' | 'archived'
  /** Free-trial length in days (default 3). */
  trialDays?: number
  /** First-paid-month discounted price (0/undefined = no launch offer). */
  launchPrice?: number
  /** Whether the launch offer is currently active for new subscribers. */
  launchEnabled?: boolean
  /** Optional hard expiry for the launch offer (server-scheduler disables it). */
  launchExpiresAt?: { seconds: number; nanoseconds: number } | null
  /** Platform-controlled availability for one-time launch offers. */
  isLaunchOffer?: boolean
  /** When false, new one-time purchase requests are rejected and the public CTA is hidden. */
  isPubliclyAvailable?: boolean
  /** Optional server-enforced cap for launch offer requests/owners. */
  launchOfferLimit?: number
  /** Server-maintained count of reserved/approved launch offer slots. */
  launchOfferSoldCount?: number
  /** Optional closing date for the one-time launch offer. */
  launchOfferEndsAt?: { seconds: number; nanoseconds: number } | null
  landingPagesLimit?: number
  salesLinksLimit?: number
  staffLimit?: number
   /** Storage quota in megabytes (0/missing = unlimited). */
   storageLimit?: number
   /** Whether this is the recommended/popular plan (shows "الأكثر طلباً"). */
   isPopular?: boolean
   /** --- Explicit unlimited resource flags --- */
   /** When true, product creation is not capped by `productLimit` (supersedes it). */
   unlimitedProducts?: boolean
   /** When true, sales-link creation is not capped by `salesLinksLimit` (supersedes it). */
   unlimitedSalesLinks?: boolean
  /** Display order for plan sorting (lower first). */
  sortOrder?: number
  /** --- Structured feature gates (Phase 6 model) --- */
  /** Single store per merchant (always true here), reserved for future tiers. */
  storeLimit?: number
  /** Tiered/bulk quantity pricing for product lines. */
  quantityPricing?: boolean
  /** Multi-option products with independent per-variant stock keeping. */
  variantInventory?: boolean
  /** Discount codes applied at checkout. */
  coupons?: boolean
  /** Recover visitors who added to cart but didn't order. */
  abandonedCart?: boolean
  /** Basic analytics dashboard + daily analytics snapshots. */
  analytics?: boolean
  /** Automated customer notifications through the store's WhatsApp Business account. */
  whatsappAutomation?: boolean
  /** Advanced reports (revenue/export-grade). */
  advancedReports?: boolean
  /** Connect a custom domain to the storefront. */
  customDomain?: boolean
  /** Programmatic API access + webhooks. */
  apiAccess?: boolean
  /** Remove the platform "Powered by M&K" branding. */
  removeBranding?: boolean
  /** Priority support queue. */
  prioritySupport?: boolean
}

export type SubscriptionStatus = 'pending' | 'pending_approval' | 'trialing' | 'active' | 'expired' | 'suspended' | 'cancelled' | 'rejected'

/** Billing cycle charged for a subscription. Monthly renews every 30 days; yearly every 365. */
export type BillingCycle = 'monthly' | 'yearly'

export type OrderUsageLevel = 'none' | 'normal' | 'moderate' | 'approaching' | 'near' | 'reached'

/** One row of the Super Admin operational view (getPlatformOverview). */
export interface PlatformMerchantRow {
  storeId: string
  storeName: string
  ref: string
  slug: string
  active: boolean
  merchantStatus?: 'pending_approval' | 'active' | 'rejected' | 'suspended' | 'deleting'
  storeStatus?: 'draft' | 'published' | 'suspended'
  published: boolean
  createdAt?: { seconds: number; nanoseconds: number } | null
  ownerName: string | null
  ownerId?: string | null
  ownerEmail: string | null
  ownerRole: string | null
  isTestMerchant?: boolean
  subId: string | null
  planId: string | null
  planName: string | null
  planPriceMonthly: number
  productLimit: number
  productsUsed?: number
  storageUsed?: number
  storageLimitBytes?: number
  subStatus: SubscriptionStatus | null
  subStartedAt?: { seconds: number; nanoseconds: number } | null
  subExpiresAt?: { seconds: number; nanoseconds: number } | null
  trialStartedAt?: { seconds: number; nanoseconds: number } | null
  trialEndsAt?: { seconds: number; nanoseconds: number } | null
  activatedAt?: { seconds: number; nanoseconds: number } | null
  currentPeriodStart?: { seconds: number; nanoseconds: number } | null
  currentPeriodEnd?: { seconds: number; nanoseconds: number } | null
  firstMonthPrice: number
  normalPriceSnapshot: number
  launchUsed: boolean
  periodNumber: number
  pendingPayment: boolean
  orderLimit: number
  ordersUsed: number
  remaining: number | null
  usagePercent: number
  usageLevel: OrderUsageLevel
}

export interface PlatformMetrics {
  totalMerchants: number
  activeStores: number
  trialing: number
  activeSubscriptions: number
  expired: number
  suspended: number
  cancelled: number
  pendingPaymentRequests: number
  launchActivations: number
  nearLimit: number
  reachedLimit: number
  mrr: number
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
  /** Trial window (server timestamps). */
  trialStartedAt?: { seconds: number; nanoseconds: number }
  trialEndsAt?: { seconds: number; nanoseconds: number }
  trialUsed?: boolean
  trialPlanId?: string
  trialStatus?: 'active' | 'expired'
  /** Paid-period window. */
  currentPeriodStart?: { seconds: number; nanoseconds: number }
  currentPeriodEnd?: { seconds: number; nanoseconds: number }
  activatedAt?: { seconds: number; nanoseconds: number }
  /** Price snapshots captured at trial start (never mutate after). */
  normalPriceSnapshot?: number
  /** Legacy alias retained for historical subscription imports. */
  priceSnapshot?: number
  launchPriceSnapshot?: number
  /** Yearly price snapshot (when billingCycle === 'yearly'). */
  yearlyPriceSnapshot?: number
  /** True when the first paid month/year used the launch (discounted) price. */
  launchUsed?: boolean
  /** Billing cycle (monthly = 30 days, yearly = 365 days). */
  billingCycle?: BillingCycle
  /** Paid billing cycle number (0 = trial, 1 = first paid month). */
  periodNumber?: number
  suspendedReason?: string
  /** Dedupe flag for lazy "trial ending soon" notifications. */
  trialEndingNotified?: boolean
  /** Immutable entitlements captured when this period was activated. */
  limitsSnapshot?: Record<string, number>
  featuresSnapshot?: string[]
  featureFlagsSnapshot?: Record<string, boolean>
  activeChangeRequestId?: string
  pendingPaymentId?: string
  /** Lifetime ownership is server-set only and never expires. */
  billingModel?: 'subscription' | 'one_time'
  ownershipType?: 'subscription' | 'lifetime'
  lifetimeAccess?: boolean
  purchasedAt?: { seconds: number; nanoseconds: number }
  purchasePaymentId?: string
  purchaseOfferId?: string
  purchaseSnapshot?: Record<string, unknown>
}

export type SubscriptionChangeRequestStatus = 'pending_payment' | 'pending_approval' | 'approved' | 'rejected' | 'cancelled'

export interface SubscriptionChangeRequest extends Partial<FirestoreMeta> {
  id: string
  storeId: string
  subscriptionId: string
  fromPlanId: string
  fromPlanName?: string
  toPlanId: string
  toPlanName?: string
  billingCycle: BillingCycle
  quotedAmount: number
  currency?: string
  status: SubscriptionChangeRequestStatus
  paymentId?: string
  requestedBy?: string
  requestedAt?: { seconds: number; nanoseconds: number }
  submittedAt?: { seconds: number; nanoseconds: number }
  processedAt?: { seconds: number; nanoseconds: number }
  planSnapshot?: Record<string, unknown>
}

export type SubscriptionPaymentStatus = 'pending' | 'approved' | 'rejected'

export interface SubscriptionPayment extends Partial<FirestoreMeta> {
  id: string
  subscriptionId: string
  storeId: string
  planId: string
  planName: string
  /** Amount computed server-side from the subscription's price snapshots. */
  amount: number
  paymentMethod: string
  reference: string
  note?: string
  screenshotUrl?: string
  status: SubscriptionPaymentStatus
  /** Billing cycle this payment pays for (1 = first paid month). */
  periodNumber: number
  reviewedBy?: string
  reviewedAt?: { seconds: number; nanoseconds: number }
  reviewNote?: string
  changeRequestId?: string
  purchaseRequestId?: string
  offerId?: string
  paymentPurpose?: 'subscription_activation' | 'subscription_upgrade' | 'subscription_renewal' | 'one_time_store_purchase'
}

export type StorePurchaseRequestStatus = 'pending_payment' | 'submitted' | 'pending_approval' | 'approved' | 'rejected' | 'cancelled'

export interface StorePurchaseRequest extends Partial<FirestoreMeta> {
  id: string
  storeId: string
  merchantId: string
  subscriptionId: string
  offerId: string
  billingModel: 'one_time'
  quotedAmount: number
  currency: string
  status: StorePurchaseRequestStatus
  paymentId?: string
  requestedAt?: { seconds: number; nanoseconds: number }
  submittedAt?: { seconds: number; nanoseconds: number }
  approvedAt?: { seconds: number; nanoseconds: number }
  processedAt?: { seconds: number; nanoseconds: number }
  offerSnapshot?: Record<string, unknown>
  previousBillingModel?: 'subscription' | 'one_time'
  previousPlanId?: string | null
  previousPlanName?: string | null
}

/** Safe, public storefront status exposed by getPublicStoreStatus. */
export interface PublicStoreStatus {
  purchasable: boolean
  reason?: string
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
  /** Platform campaigns are visible to the merchant but controlled by the platform. */
  source?: 'platform' | 'merchant'
  createdByRole?: 'superAdmin' | 'merchant' | 'staff'
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

export interface PlatformPromotion extends Partial<FirestoreMeta> {
  id: string
  title: string
  message?: string
  type: 'announcement' | 'plan_offer' | 'maintenance' | 'feature_announcement' | 'general_offer'
  status: 'draft' | 'scheduled' | 'active' | 'expired' | 'cancelled'
  audienceType: 'all_merchants' | 'selected_plans' | 'selected_merchants'
  targetPlanIds?: string[]
  targetMerchantIds?: string[]
  placement?: string[]
  ctaLabel?: string
  ctaType?: string
  ctaTarget?: string
  startsAt?: any
  endsAt?: any
  planId?: string
  discountType?: 'percentage' | 'fixed'
  discountValue?: number
  promotionalPrice?: number
  allowCouponStacking?: boolean
}

/** Merchant-private manual advertising campaign. No external ad API is implied. */
export interface AdCampaign extends Partial<FirestoreMeta> {
  id: string
  storeId: string
  name: string
  platform: 'facebook' | 'instagram' | 'tiktok' | 'google' | 'other'
  status: 'active' | 'paused' | 'ended'
  startDate?: any
  endDate?: any
  totalSpend: number
  dailyBudget?: number
  attributionMode?: 'manual' | 'sales_link' | 'landing_page' | 'campaign_parameter'
  productIds?: string[]
  attributedOrders?: number
  attributedRevenue?: number
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
  /** Manual payment instructions shown to merchants during activation. */
  paymentInstructions?: string
  paymentContact?: string
  /** Public-safe Enterprise sales contact, managed by platform admins. */
  enterpriseWhatsAppNumber?: string
  enterpriseWhatsAppEnabled?: boolean
  enterpriseWhatsAppMessage?: string
  /** Non-sensitive setup state for future Meta WhatsApp automation. */
  whatsappAutomation?: {
    senderNumber?: string
    events?: Array<'order.created' | 'shipment.created' | 'shipment.delivered' | 'shipment.returned'>
    templates?: Partial<Record<'order.created' | 'shipment.created' | 'shipment.delivered' | 'shipment.returned', string>>
  }
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
  /** Optional banner/illustration image shown with this section. */
  image?: string
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
  storeId?: string
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
  /** Quantity pricing strategy snapshot at add-time. */
  quantityPricingStrategy?: QuantityPricingStrategy
  /**
   * Authoritative charged amount for the line. For quantity pricing this is
   * the bundle's TOTAL tier price (never unit × qty); for standard pricing it
   * is price × quantity. Recomputed from the tier snapshot when qty changes.
   */
  lineTotal?: number
  /**
   * Max purchasable quantity snapshot at add-time (in-stock units for the
   * selected variant/selection). The cart stepper clamps against it; the
   * backend re-validates against live stock so this is only a UX ceiling.
   */
  maxQty?: number
}

export interface ApiResult<T> {
  data: T | null
  error: string | null
}
