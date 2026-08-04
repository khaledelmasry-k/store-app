import { listDocs, getDocById, createDoc, updateDocById, deleteDocById } from '../utils/firestore'
import type { Product } from '../types'

const PATH = 'products'

export const productsService = {
  list: (storeId: string) =>
    listDocs<Product>(PATH, { storeId, orderBy: { field: 'createdAt' } }),
  active: (storeId: string) =>
    listDocs<Product>(PATH, {
      storeId,
      where: { active: { value: true } },
      orderBy: { field: 'createdAt' },
    }),
  get: (id: string) => getDocById<Product>(PATH, id),
  create: (storeId: string, data: Omit<Product, 'id' | 'storeId'>) => createDoc<Product>(PATH, { ...data, storeId }),
  update: (id: string, data: Record<string, unknown>) => updateDocById(PATH, id, data),
  remove: (id: string) => deleteDocById(PATH, id),
}
