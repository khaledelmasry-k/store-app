export interface Admin {
  id: string;
  username: string;
  email: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  oldPrice: number | null;
  pricingTiers: Record<string, number>;
  variantStock: Record<string, Record<string, number>>;
  images: Record<string, string>;
  colors: string[];
  sizes: string[];
  active: boolean;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  color: string;
  size: string;
  quantity: number;
}

export type OrderStatus =
  | "NEW"
  | "CONTACTED"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "RETURNED";

export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  phone: string;
  governorate: string;
  city: string;
  address: string;
  notes: string | null;
  items: OrderItem[];
  totalPrice: number;
  status: OrderStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface PersonStats {
  totalOrders: number;
  newOrders: number;
  contactedOrders: number;
  processingOrders: number;
  shippedOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  returnedOrders: number;
  expectedRevenue: number;
  confirmedRevenue: number;
  totalQuantity: number;
}

export interface DashboardStats {
  totalOrders: number;
  newOrders: number;
  contactedOrders: number;
  processingOrders: number;
  shippedOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  returnedOrders: number;
  expectedRevenue: number;
  confirmedRevenue: number;
  confirmedOrders?: number;
  khaledStats: PersonStats;
  mahmoudStats: PersonStats;
  stores: {
    khaled: { id: string; ref: string; name: string; stats: PersonStats };
    mahmoud: { id: string; ref: string; name: string; stats: PersonStats };
  };
  totalStock: number;
  variantStock: Record<string, Record<string, number>>;
}

export interface Store {
  id: string;
  ref: string;
  name: string;
  active: boolean;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  orders: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
