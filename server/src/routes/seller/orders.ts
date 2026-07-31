import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../../utils/prisma.js";
import { authMiddleware } from "../../middleware/auth.js";
import { requireStore, requirePermission } from "../../middleware/permission.js";
import { parseJsonField } from "../../utils/parseJson.js";

function qs(val: unknown): string {
  return typeof val === "string" ? val : "";
}

const router = Router();
router.use(authMiddleware, requireStore);

function storeWhere(req: Request): { storeId: string } | {} {
  return req.storeId ? { storeId: req.storeId } : {};
}

router.get("/", async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(qs(req.query.page)) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(qs(req.query.limit)) || 10));
  const search = qs(req.query.search);
  const status = qs(req.query.status);
  const phone = qs(req.query.phone);

  const where: any = storeWhere(req);
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
  const where: any = { id: String(req.params.id), ...storeWhere(req) };
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

router.patch("/:id/status", requirePermission("orders", "edit"), async (req: Request<{ id: string }>, res: Response) => {
  const statusUpdateSchema = z.object({
    status: z.enum(["NEW", "CONTACTED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED"]),
  });

  const parsed = statusUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid status" });
    return;
  }

  const where: any = { id: String(req.params.id), ...storeWhere(req) };
  const order = await prisma.order.findFirst({
    where,
    include: { items: true },
  });
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  if (
    (parsed.data.status === "RETURNED" || parsed.data.status === "CANCELLED") &&
    order.status !== "RETURNED" &&
    order.status !== "CANCELLED"
  ) {
    await restoreOrderStock(order.items);
  }

  const updated = await prisma.order.update({
    where: { id: String(req.params.id) },
    data: { status: parsed.data.status },
  });
  res.json(updated);
});

router.delete("/:id", requirePermission("orders", "delete"), async (req: Request<{ id: string }>, res: Response) => {  const where: any = { id: String(req.params.id), ...storeWhere(req) };
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

// Restore stock to each product referenced by the order items (per productId).
async function restoreOrderStock(items: Array<{ productId: string | null; color: string; size: string; quantity: number }>) {
  const ids = [...new Set(items.filter((i) => i.productId).map((i) => i.productId!))];
  if (ids.length === 0) return;
  const products = await prisma.product.findMany({ where: { id: { in: ids } } });
  for (const product of products) {
    const vs = parseJsonField<Record<string, Record<string, number>>>(product.variantStock, {});
    const itemGroup = items.filter((i) => i.productId === product.id);
    if (itemGroup.length === 0) continue;
    const newVs = JSON.parse(JSON.stringify(vs));
    for (const item of itemGroup) {
      if (!newVs[item.color]) newVs[item.color] = {};
      newVs[item.color][item.size] = (newVs[item.color][item.size] ?? 0) + item.quantity;
    }
    await prisma.product.update({
      where: { id: product.id },
      data: { variantStock: JSON.stringify(newVs) },
    });
  }
}

export default router;