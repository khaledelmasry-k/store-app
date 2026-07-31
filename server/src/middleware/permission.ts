import { Request, Response, NextFunction } from "express";
import { prisma } from "../utils/prisma.js";
import { getAdminStoreId, getAdminStoreIds } from "../utils/storeHelper.js";

/**
 * Resolves the admin's current store and attaches it to the request.
 * - Super admins are unscoped (req.storeId = null, may pass ?storeId=).
 * - Merchants use the X-Store-Id header when it belongs to them, else their first store.
 * - Rejects with 403 when a merchant has no store at all (prevents unscoped where:{} leaks).
 */
export async function requireStore(req: Request, res: Response, next: NextFunction) {
  try {
    const admin = req.admin;
    if (!admin) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (admin.role === "super_admin") {
      req.storeId = null;
      next();
      return;
    }

    const ids = await getAdminStoreIds(admin);
    if (ids.length === 0) {
      res.status(403).json({ error: "Store not found for this account" });
      return;
    }

    const requested = req.headers["x-store-id"];
    const resolved = typeof requested === "string" && requested && ids.includes(requested)
      ? requested
      : ids[0];
    req.storeId = resolved;
    admin.storeId = resolved;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Resolve the tenantId scoped to the current request.
 * Super admins are unscoped (null); merchants are scoped via their store's tenant.
 * Returns null when the caller has no accessible tenant (routes must 403).
 */
export async function getReqTenantId(req: Request): Promise<string | null> {
  const admin = req.admin;
  if (!admin) return null;
  if (admin.role === "super_admin") return null;

  const storeId = req.storeId || (await getAdminStoreId(admin));
  if (!storeId) return null;
  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { tenantId: true } });
  return store?.tenantId || null;
}

/** Static list of RBAC resources/actions used by the permission system. */
export const RESOURCES = [
  "products",
  "orders",
  "customers",
  "reports",
  "settings",
  "team",
  "sellers",
  "landing-pages",
  "store-links",
] as const;

export const ACTIONS = ["view", "create", "edit", "delete"] as const;

export type Resource = (typeof RESOURCES)[number];
export type Action = (typeof ACTIONS)[number];

async function getTenantRole(req: Request): Promise<string | null> {
  const admin = req.admin;
  if (!admin) return null;
  if (admin.role === "super_admin") return "SUPER_ADMIN";

  const membership = await prisma.tenantUser.findFirst({
    where: { adminId: admin.adminId },
    select: { role: true },
  });
  if (membership) return membership.role;

  // Legacy sellers (created before tenantUser rows existed) own their store directly.
  const storeId = req.storeId || (await getAdminStoreId(admin));
  if (storeId) {
    const owned = await prisma.store.findFirst({ where: { id: storeId, adminId: admin.adminId } });
    if (owned) return "OWNER";
  }
  return null;
}

/**
 * RBAC gate. MVP policy:
 * - SUPER_ADMIN, OWNER, ADMIN: full access (any resource/action).
 * - EDITOR (and anything else): read-only (view action only).
 * The Role/Permission tables exist but are not wired to users yet, so this
 * uses the tenant membership role as the source of truth.
 */
export function requirePermission(resource: Resource, action: Action) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const role = await getTenantRole(req);
      if (!role) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      if (role === "SUPER_ADMIN" || role === "OWNER" || role === "ADMIN") {
        next();
        return;
      }
      // EDITOR and unknown roles: read-only
      if (action === "view") {
        next();
        return;
      }
      res.status(403).json({ error: "Forbidden: insufficient permissions" });
    } catch (err) {
      next(err);
    }
  };
}
