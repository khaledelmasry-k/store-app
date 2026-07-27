import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../utils/prisma.js";
import { authMiddleware } from "../middleware/auth.js";

function qs(val: unknown): string {
  return typeof val === "string" ? val : "";
}

function parseJsonField<T>(val: unknown, fallback: T): T {
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      if (typeof fallback === "object" && !Array.isArray(fallback) && fallback !== null) {
        if (typeof parsed === "object" && !Array.isArray(parsed) && parsed !== null) return parsed;
        return fallback;
      }
      if (Array.isArray(fallback)) {
        if (Array.isArray(parsed)) return parsed as T;
        return fallback;
      }
      return parsed;
    } catch { return fallback; }
  }
  return val as T;
}

function computeTotalStock(vs: Record<string, Record<string, number>>): number {
  let total = 0;
  for (const sizes of Object.values(vs)) {
    for (const qty of Object.values(sizes)) {
      total += qty;
    }
  }
  return total;
}

const router = Router();
router.use(authMiddleware);

router.get("/", async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(qs(req.query.page)) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(qs(req.query.limit)) || 10));
  const search = qs(req.query.search);
  const status = qs(req.query.status);
  const phone = qs(req.query.phone);

  const where: any = {};
  if (search) where.customerName = { contains: search };
  if (phone) where.phone = { contains: phone };
  const validStatuses = ["NEW", "CONTACTED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"];
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

async function personStats(createdBy: string) {
  const statuses = ["NEW", "CONTACTED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"] as const;
  const orders = await prisma.order.findMany({
    where: { createdBy },
    include: { items: true },
  });
  const counts: Record<string, number> = {};
  let totalRevenue = 0;
  let totalQuantity = 0;
  for (const o of orders) {
    counts[o.status] = (counts[o.status] || 0) + 1;
    totalRevenue += o.totalPrice;
    for (const item of o.items) totalQuantity += item.quantity;
  }
  const s = {} as Record<string, number>;
  for (const st of statuses) s[st] = counts[st] || 0;
  return {
    totalOrders: orders.length,
    newOrders: s.NEW,
    contactedOrders: s.CONTACTED,
    processingOrders: s.PROCESSING,
    shippedOrders: s.SHIPPED,
    deliveredOrders: s.DELIVERED,
    cancelledOrders: s.CANCELLED,
    totalRevenue,
    totalQuantity,
  };
}

router.get("/dashboard", async (_req: Request, res: Response) => {
  const statuses = ["NEW", "CONTACTED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"] as const;
  const counts = await Promise.all(
    statuses.map((s) => prisma.order.count({ where: { status: s } }))
  );
  const totalOrders = counts.reduce((a, b) => a + b, 0);

  const [khaledStats, mahmoudStats] = await Promise.all([
    personStats("1"),
    personStats("2"),
  ]);

  const product = await prisma.product.findFirst();
  const variantStock = parseJsonField<Record<string, Record<string, number>>>(product?.variantStock ?? "{}", {});

  res.json({
    totalOrders,
    newOrders: counts[0],
    contactedOrders: counts[1],
    processingOrders: counts[2],
    shippedOrders: counts[3],
    deliveredOrders: counts[4],
    cancelledOrders: counts[5],
    khaledStats,
    mahmoudStats,
    totalStock: computeTotalStock(variantStock),
    variantStock,
  });
});

router.get("/:id", async (req: Request<{ id: string }>, res: Response) => {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: { items: true },
  });
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  res.json(order);
});

const statusUpdateSchema = z.object({
  status: z.enum(["NEW", "CONTACTED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"]),
});

router.patch("/:id/status", async (req: Request<{ id: string }>, res: Response) => {
  const parsed = statusUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid status" });
    return;
  }
  const updated = await prisma.order.update({
    where: { id: req.params.id },
    data: { status: parsed.data.status },
  });
  res.json(updated);
});

router.delete("/:id", async (req: Request<{ id: string }>, res: Response) => {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: { items: true },
  });
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  const product = await prisma.product.findFirst();
  if (product) {
    const variantStock = parseJsonField<Record<string, Record<string, number>>>(product.variantStock, {});
    for (const item of order.items) {
      if (!variantStock[item.color]) variantStock[item.color] = {};
      variantStock[item.color][item.size] = (variantStock[item.color][item.size] ?? 0) + item.quantity;
    }
    await prisma.product.update({
      where: { id: product.id },
      data: { variantStock: JSON.stringify(variantStock) },
    });
  }

  await prisma.order.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

export default router;
