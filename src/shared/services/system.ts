import { listDocs, getDocById, createDoc, updateDocById, deleteDocById } from '../utils/firestore'
import type { Notification, Ticket, AuditLog, DailyAnalytics, StoreLink, LandingPage, TeamMember, RoleDef, Invitation, Address, WishlistItem, PlatformSettings } from '../types'

const notifications = 'notifications'
const tickets = 'tickets'
const audit = 'auditLogs'
const analytics = 'analytics'
const links = 'storeLinks'
const landing = 'landingPages'
const team = 'team'
const roles = 'roles'
const invites = 'invitations'
const addresses = 'addresses'
const wishlist = 'wishlist'
const settings = 'settings'

export const notificationsService = {
  list: (storeId?: string, userId?: string) =>
    listDocs<Notification>(notifications, {
      storeId,
      userId,
      orderBy: { field: 'createdAt' },
    }),
  create: (data: Omit<Notification, 'id'>) => createDoc<Notification>(notifications, data),
  update: (id: string, data: Record<string, unknown>) => updateDocById(notifications, id, data),
  remove: (id: string) => deleteDocById(notifications, id),
}

export const ticketsService = {
  list: (storeId?: string) =>
    listDocs<Ticket>(tickets, { storeId, orderBy: { field: 'createdAt' } }),
  create: (data: Omit<Ticket, 'id'>) => createDoc<Ticket>(tickets, data),
  update: (id: string, data: Record<string, unknown>) => updateDocById(tickets, id, data),
}

export const auditService = {
  list: (storeId?: string) =>
    listDocs<AuditLog>(audit, { storeId, orderBy: { field: 'createdAt' } }),
  create: (data: Omit<AuditLog, 'id'>) => createDoc<AuditLog>(audit, data),
}

export const analyticsService = {
  byStore: (storeId: string) =>
    listDocs<DailyAnalytics>(analytics, { storeId, orderBy: { field: 'date' } }),
  all: () => listDocs<DailyAnalytics>(analytics, { orderBy: { field: 'date' } }),
}

export const storeLinksService = {
  list: (storeId: string) => listDocs<StoreLink>(links, { storeId, orderBy: { field: 'createdAt' } }),
  create: (storeId: string, data: Omit<StoreLink, 'id' | 'storeId'>) => createDoc<StoreLink>(links, { ...data, storeId }),
  update: (id: string, data: Record<string, unknown>) => updateDocById(links, id, data),
  remove: (id: string) => deleteDocById(links, id),
}

export const landingPagesService = {
  list: (storeId: string) => listDocs<LandingPage>(landing, { storeId, orderBy: { field: 'createdAt' } }),
  create: (storeId: string, data: Omit<LandingPage, 'id' | 'storeId'>) => createDoc<LandingPage>(landing, { ...data, storeId }),
  update: (id: string, data: Record<string, unknown>) => updateDocById(landing, id, data),
  remove: (id: string) => deleteDocById(landing, id),
}

/** True when any landing page (any store) already claims the slug. Landing
 * pages render on the shared `/landing/:slug` route, so slugs must be unique
 * globally — not just per store. */
export async function landingSlugTaken(slug: string, excludeId?: string): Promise<boolean> {
  const matches = await listDocs<LandingPage>(landing, { where: { slug: { value: slug } } })
  return matches.some((m) => m.id !== excludeId)
}

/** Derives a globally-unique slug by appending `-2`, `-3`, ... as needed. */
export async function uniqueLandingSlug(base: string, excludeId?: string): Promise<string> {
  let slug = base
  let i = 2
  while (await landingSlugTaken(slug, excludeId)) {
    slug = `${base}-${i++}`
  }
  return slug
}

export const teamService = {
  list: (storeId: string) => listDocs<TeamMember>(team, { storeId, orderBy: { field: 'name' } }),
  create: (storeId: string, data: Omit<TeamMember, 'id' | 'storeId'>) => createDoc<TeamMember>(team, { ...data, storeId }),
  update: (id: string, data: Record<string, unknown>) => updateDocById(team, id, data),
  remove: (id: string) => deleteDocById(team, id),
}

export const rolesService = {
  list: (storeId: string) => listDocs<RoleDef>(roles, { storeId, orderBy: { field: 'name' } }),
  create: (storeId: string, data: Omit<RoleDef, 'id' | 'storeId'>) => createDoc<RoleDef>(roles, { ...data, storeId }),
  update: (id: string, data: Record<string, unknown>) => updateDocById(roles, id, data),
  remove: (id: string) => deleteDocById(roles, id),
}

export const invitationsService = {
  list: (storeId: string) => listDocs<Invitation>(invites, { storeId, orderBy: { field: 'createdAt' } }),
  create: (storeId: string, data: Omit<Invitation, 'id' | 'storeId'>) => createDoc<Invitation>(invites, { ...data, storeId }),
  update: (id: string, data: Record<string, unknown>) => updateDocById(invites, id, data),
  remove: (id: string) => deleteDocById(invites, id),
}

export const addressesService = {
  byUser: (userId: string) => listDocs<Address>(addresses, { userId, orderBy: { field: 'createdAt' } }),
  create: (data: Omit<Address, 'id'>) => createDoc<Address>(addresses, data),
  update: (id: string, data: Record<string, unknown>) => updateDocById(addresses, id, data),
  remove: (id: string) => deleteDocById(addresses, id),
}

export const wishlistService = {
  byUser: (userId: string) => listDocs<WishlistItem>(wishlist, { userId, orderBy: { field: 'createdAt' } }),
  create: (data: Omit<WishlistItem, 'id'>) => createDoc<WishlistItem>(wishlist, data),
  remove: (id: string) => deleteDocById(wishlist, id),
}

export const settingsService = {
  get: () => getDocById<PlatformSettings>(settings, 'platform'),
  update: (data: Record<string, unknown>) => updateDocById(settings, 'platform', data),
}
