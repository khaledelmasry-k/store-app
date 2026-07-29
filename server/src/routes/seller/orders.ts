import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../../utils/prisma.js";
import { authMiddleware } from "../../middleware/auth.js";
import { getAdminStoreId } from "../../utils/storeHelper.js";

function qs(val: unknown): string {
  return typeof val === "string" ? val : "";
}

const router = Router();
router.use(authMiddleware);

router.get("/", async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(qs(req.query.page)) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(qs(req.query.limit)) || 10));
  const search = qs(req.query.search);
  const status = qs(req.query.status);
  const phone = qs(req.query.phone);

  const storeId = await getAdminStoreId(req.admin!);
  const where: any = storeId ? { storeId } : {};
  if (search) where.customerName = { contains: search };
  if (phone) where.phone = { contains: phone };
  const validStatuses = ["NEW", "CONTACTED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED"];
  if (status && validStatuses.includes(status)) where.status = status;

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: { items: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.order.count({ where }),
  ]);

  res.json({
    orders,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

router.get("/:id", async (req: Request<{ id: string }>, res: Response) => {
  const storeId = await getAdminStoreId(req.admin!);
  const where: any = { id: String(req.params.id) };
  if (storeId) where.storeId = storeId;
  const order = await prisma.order.findFirst({
    where,
    include: { items: true },
  });
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  res.json(order);
});

router.patch("/:id/status", async (req: Request<{ id: string }>, res: Response) => {
  const statusUpdateSchema = z.object({
    status: z.enum(["NEW", "CONTACTED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED"]),
  });

  const parsed = statusUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid status" });
    return;
  }

  const storeId = await getAdminStoreId(req.admin!);
  const where: any = { id: String(req.params.id) };
  if (storeId) where.storeId = storeId;
  const order = await prisma.order.findFirst({
    where,
    include: { items: true },
  });
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  const updated = await prisma.order.update({
    where: { id: String(req.params.id) },
    data: { status: parsed.data.status },
  });
  res.json(updated);
});

router.delete("/:id", async (req: Request<{ id: string }>, res: Response) => {
  const storeId = await getAdminStoreId(req.admin!);
  const where: any = { id: String(req.params.id) };
  if (storeId) where.storeId = storeId;
  const order = await prisma.order.findFirst({
    where,
    include: { items: true },
  });
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  await prisma.order.delete({ where: { id: String(req.params.id) } });
  res.json({ success: true });
});

export default router;