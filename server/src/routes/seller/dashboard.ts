import { Router, Request, Response } from "express";
import { prisma } from "../../utils/prisma.js";
import { authMiddleware } from "../../middleware/auth.js";
import { getAdminStoreId } from "../../utils/storeHelper.js";
import { parseJsonField } from "../../utils/parseJson.js";
import { computeTotalStock } from "../../utils/stock.js";

const router = Router();
router.use(authMiddleware);

router.get("/", async (req: Request, res: Response) => {
  const storeId = await getAdminStoreId(req.admin!);
  const statuses = ["NEW", "CONTACTED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED"] as const;

  const where = storeId ? { storeId } : { createdBy: req.admin!.username };

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

  const storeName = storeId ? (await prisma.store.findUnique({ where: { id: storeId } }))?.name : "";

  const product = await prisma.product.findFirst({
    where: storeId ? { storeId } : {},
    orderBy: { updatedAt: "desc" },
  });

  const variantStock = parseJsonField<Record<string, Record<string, number>>>(product?.variantStock ?? "{}", {});

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
    totalStock: computeTotalStock(variantStock),
    variantStock,
    storeName,
    isSuperAdmin: req.admin!.role === "super_admin",
  });
});

export default router;