import { Router, Request, Response } from "express";
import { prisma } from "../../utils/prisma.js";
import { authMiddleware } from "../../middleware/auth.js";
import { requireStore } from "../../middleware/permission.js";
import { parseJsonField } from "../../utils/parseJson.js";
import { computeTotalStock } from "../../utils/stock.js";

const router = Router();
router.use(authMiddleware, requireStore);

router.get("/", async (req: Request, res: Response) => {
  const statuses = ["NEW", "CONTACTED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED"] as const;
  const where = req.storeId ? { storeId: req.storeId } : {};

  const counts = await Promise.all(
    statuses.map((s) => prisma.order.count({ where: { ...where, status: s } }))
  );

  const totalOrders = counts.reduce((a: number, b: number) => a + b, 0);

  const orders = await prisma.order.findMany({
    where,
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });

  let expectedRevenue = 0;
  let confirmedRevenue = 0;
  let totalQuantity = 0;
  for (const o of orders) {
    if (o.status !== "CANCELLED" && o.status !== "RETURNED") expectedRevenue += o.totalPrice;
    if (o.status === "DELIVERED") confirmedRevenue += o.totalPrice;
    for (const item of o.items) totalQuantity += item.quantity;
  }

  const storeName = req.storeId ? (await prisma.store.findUnique({ where: { id: req.storeId } }))?.name : "";

  const products = await prisma.product.findMany({
    where: req.storeId ? { storeId: req.storeId } : {},
    select: { variantStock: true },
  });
  let totalStock = 0;
  const variantStock: Record<string, Record<string, number>> = {};
  for (const p of products) {
    const vs = parseJsonField<Record<string, Record<string, number>>>(p.variantStock, {});
    for (const [color, sizes] of Object.entries(vs)) {
      if (!variantStock[color]) variantStock[color] = {};
      for (const [size, qty] of Object.entries(sizes)) {
        variantStock[color][size] = (variantStock[color][size] || 0) + qty;
      }
    }
    totalStock += computeTotalStock(vs);
  }

  res.json({
    totalOrders,
    newOrders: counts[0],
    contactedOrders: counts[1],
    processingOrders: counts[2],
    shippedOrders: counts[3],
    deliveredOrders: counts[4],
    cancelledOrders: counts[5],
    returnedOrders: counts[6],
    expectedRevenue,
    confirmedRevenue,
    totalQuantity,
    totalStock,
    variantStock,
    storeName,
    isSuperAdmin: req.admin!.role === "super_admin",
  });
});

export default router;
