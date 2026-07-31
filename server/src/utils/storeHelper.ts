import { prisma } from "./prisma.js";
import type { AuthPayload } from "../middleware/auth.js";

/**
 * Resolve all store ids an admin belongs to (tenant membership + legacy direct ownership).
 * Super admins get an empty list (they are not scoped to any store).
 */
export async function getAdminStoreIds(admin: AuthPayload): Promise<string[]> {
  if (admin.role === "super_admin") return [];

  const ids = new Set<string>();

  // Tenant membership (covers owners, editors, invited members)
  const memberships = await prisma.tenantUser.findMany({
    where: { adminId: admin.adminId },
    select: { tenantId: true },
  });
  if (memberships.length > 0) {
    const stores = await prisma.store.findMany({
      where: { tenantId: { in: memberships.map((m) => m.tenantId) } },
      select: { id: true },
    });
    for (const s of stores) ids.add(s.id);
  }

  // Legacy direct ownership (adminId on the store row)
  const owned = await prisma.store.findMany({
    where: { adminId: admin.adminId },
    select: { id: true },
  });
  for (const s of owned) ids.add(s.id);

  return [...ids];
}

/**
 * Get the admin's current store id. Super admins return null (unscoped).
 * Prefers an already-resolved storeId on the payload (set by requireStore).
 */
export async function getAdminStoreId(admin: AuthPayload): Promise<string | null> {
  if (admin.role === "super_admin") return null;
  if (admin.storeId) return admin.storeId;
  const ids = await getAdminStoreIds(admin);
  return ids[0] ?? null;
}
