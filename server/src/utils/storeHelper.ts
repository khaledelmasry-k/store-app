import { prisma } from "./prisma.js";
import type { AuthPayload } from "../middleware/auth.js";

export async function getAdminStoreId(admin: AuthPayload): Promise<string | null> {
  if (admin.role === "super_admin") return null;
  const store = await prisma.store.findFirst({ where: { adminId: admin.adminId } });
  return store?.id ?? null;
}
