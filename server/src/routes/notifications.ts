import { Router, Request, Response } from "express";
import { prisma } from "../utils/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { getAdminStoreId } from "../utils/storeHelper.js";

const router = Router();
router.use(authMiddleware);

async function getTenantId(req: Request): Promise<string | null> {
  if (req.admin?.role === "super_admin") return null;
  const storeId = await getAdminStoreId(req.admin!);
  if (!storeId) return null;
  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { tenantId: true } });
  return store?.tenantId || null;
}

router.get("/", async (req: Request, res: Response) => {
  const tenantId = await getTenantId(req);
  if (!tenantId) { res.json({ notifications: [], unread: 0 }); return; }

  const limit = Math.min(50, parseInt(String(req.query.limit)) || 20);
  const notifications = await prisma.notification.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  const unread = await prisma.notification.count({ where: { tenantId, read: false } });

  res.json({
    notifications: notifications.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() })),
    unread,
  });
});

router.patch("/:id/read", async (req: Request, res: Response) => {
  const tenantId = await getTenantId(req);
  if (!tenantId) { res.status(403).json({ error: "No tenant" }); return; }

  await prisma.notification.updateMany({
    where: { id: String(req.params.id), tenantId },
    data: { read: true },
  });
  res.json({ success: true });
});

router.patch("/read-all", async (req: Request, res: Response) => {
  const tenantId = await getTenantId(req);
  if (!tenantId) { res.status(403).json({ error: "No tenant" }); return; }

  await prisma.notification.updateMany({
    where: { tenantId, read: false },
    data: { read: true },
  });
  res.json({ success: true });
});

export async function createNotification(tenantId: string, type: string, title: string, message: string, link?: string) {
  await prisma.notification.create({ data: { tenantId, type, title, message, link } });
}

export default router;
