import { listDocs, getDocById, createDoc, updateDocById } from '../utils/firestore'
import type { User } from '../types'

const PATH = 'users'

export const usersService = {
  list: () => listDocs<User>(PATH, { orderBy: { field: 'createdAt' } }),
  byRole: (role: string) => listDocs<User>(PATH, { where: { role: { value: role } } }),
  get: (id: string) => getDocById<User>(PATH, id),
  create: (data: Omit<User, 'id'>) => createDoc<User>(PATH, data),
  update: (id: string, data: Record<string, unknown>) => updateDocById(PATH, id, data),
}
