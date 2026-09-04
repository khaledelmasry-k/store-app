import { listDocs, getDocById, createDoc, setDocById, updateDocById, deleteDocById } from '../utils/firestore'
import type { Product, ProductCost } from '../types'

const PATH = 'products'
const COST_PATH = 'productCosts'

export const productsService = {
  list: (storeId: string) =>
    listDocs<Product>(PATH, { storeId, orderBy: { field: 'createdAt' } }),
  all: () => listDocs<Product>(PATH),
  active: (storeId: string) =>
    listDocs<Product>(PATH, {
      storeId,
      where: { active: { value: true } },
      orderBy: { field: 'createdAt' },
    }),
  get: (id: string) => getDocById<Product>(PATH, id),
  create: (storeId: string, data: Omit<Product, 'id' | 'storeId'>, id?: string) =>
    id
      ? setDocById<Product>(PATH, id, { ...data, storeId })
      : createDoc<Product>(PATH, { ...data, storeId }),
  update: (id: string, data: Record<string, unknown>) => updateDocById(PATH, id, data),
  remove: (id: string) => deleteDocById(PATH, id),
}

/**
 * Private cost-price service. `costPrice` is sensitive merchant data and is
 * stored OUTSIDE the publicly-readable `products` collection, so it can never
 * leak to the storefront, cart, checkout or customer order views.
 */
export const productCostsService = {
  list: (storeId: string) => listDocs<ProductCost>(COST_PATH, { storeId }),
  get: (id: string) => getDocById<ProductCost>(COST_PATH, id),
  set: (productId: string, storeId: string, data: Pick<ProductCost, 'costPrice'> & Partial<Pick<ProductCost, 'variantCosts' | 'estimatedAdCostPerSale' | 'estimatedAdCostMode'>>) =>
    setDocById<ProductCost>(COST_PATH, productId, { storeId, ...data }),
  remove: (productId: string) => deleteDocById(COST_PATH, productId),
}
