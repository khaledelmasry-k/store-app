import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../utils/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireStore, requirePermission } from "../middleware/permission.js";
import { parseJsonField } from "../utils/parseJson.js";
import { computeTotalStock } from "../utils/stock.js";

function qs(val: unknown): string {
  return typeof val === "string" ? val : "";
}

const router = Router();
router.use(authMiddleware, requireStore);

function storeWhere(req: Request): { storeId: string } | {} {
  return req.storeId ? { storeId: req.storeId } : {};
}

const VALID_STATUSES = ["NEW", "CONTACTED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED"] as const;

router.get("/", async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(qs(req.query.page)) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(qs(req.query.limit)) || 10));
  const search = qs(req.query.search);
  const status = qs(req.query.status);
  const phone = qs(req.query.phone);
  const ref = qs(req.query.ref);

  const where: any = storeWhere(req);
  if (search) where.customerName = { contains: search };
  if (phone) where.phone = { contains: phone };
  if (status && VALID_STATUSES.includes(status as any)) where.status = status;
  if (ref) where.createdBy = ref;

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

async function storeStats(storeId: string) {
  const orders = await prisma.order.findMany({ where: { storeId }, include: { items: true } });
  const counts: Record<string, number> = {};
  let expectedRevenue = 0;
  let confirmedRevenue = 0;
  let totalQuantity = 0;
  for (const o of orders) {
    counts[o.status] = (counts[o.status] || 0) + 1;
    if (o.status !== "CANCELLED" && o.status !== "RETURNED") expectedRevenue += o.totalPrice;
    if (o.status === "DELIVERED") confirmedRevenue += o.totalPrice;
    for (const item of o.items) totalQuantity += item.quantity;
  }
  const s = {} as Record<string, number>;
  for (const st of VALID_STATUSES) s[st] = counts[st] || 0;
  return {
    totalOrders: orders.length,
    newOrders: s.NEW,
    contactedOrders: s.CONTACTED,
    processingOrders: s.PROCESSING,
    shippedOrders: s.SHIPPED,
    deliveredOrders: s.DELIVERED,
    cancelledOrders: s.CANCELLED,
    returnedOrders: s.RETURNED,
    expectedRevenue,
    confirmedRevenue,
    totalQuantity,
  };
}

async function getRecentOrders(storeId: string | null) {
  const where: any = {};
  if (storeId) where.storeId = storeId;
  return prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, orderNumber: true, customerName: true, phone: true, totalPrice: true, status: true, createdAt: true },
  });
}

// Aggregate total stock across ALL products of a store (not just the most recent one).
async function getStoreStock(storeId: string | null) {
  const products = await prisma.product.findMany({
    where: storeId ? { storeId } : {},
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
  return { totalStock, variantStock };
}

router.get("/dashboard", async (req: Request, res: Response) => {
  if (req.admin!.role === "super_admin") {
    const counts = await Promise.all(
      VALID_STATUSES.map((s) => prisma.order.count({ where: { status: s } }))
    );
    const totalOrders = counts.reduce((a, b) => a + b, 0);

    const stores = await prisma.store.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, ref: true, name: true, active: true } });
    const storeStatsData = await Promise.all(
      stores.map(async (st) => {
        const sts = await storeStats(st.id);
        return { ref: st.ref, name: st.name, ...sts };
      })
    );

    const { totalStock, variantStock } = await getStoreStock(null);
    const expectedRevenue = storeStatsData.reduce((a, b) => a + b.expectedRevenue, 0);
    const confirmedRevenue = storeStatsData.reduce((a, b) => a + b.confirmedRevenue, 0);
    const recentOrders = await getRecentOrders(null);

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
      confirmedOrders: counts[4],
      storesStats: storeStatsData,
      totalStock,
      variantStock,
      recentOrders,
      isSuperAdmin: true,
    });
    return;
  }

  const where: any = storeWhere(req);
  if (!req.storeId) {
    res.status(403).json({ error: "Store not found for this account" });
    return;
  }

  const counts = await Promise.all(
    VALID_STATUSES.map((s) => prisma.order.count({ where: { ...where, status: s } }))
  );
  const totalOrders = counts.reduce((a, b) => a + b, 0);

  const orders = await prisma.order.findMany({ where, include: { items: true } });
  let expectedRevenue = 0;
  let confirmedRevenue = 0;
  let totalQuantity = 0;
  for (const o of orders) {
    if (o.status !== "CANCELLED" && o.status !== "RETURNED") expectedRevenue += o.totalPrice;
    if (o.status === "DELIVERED") confirmedRevenue += o.totalPrice;
    for (const item of o.items) totalQuantity += item.quantity;
  }

  const storeName = (await prisma.store.findUnique({ where: { id: req.storeId } }))?.name || "";

  const { totalStock, variantStock } = await getStoreStock(req.storeId);
  const recentOrders = await getRecentOrders(req.storeId);

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
    confirmedOrders: counts[4],
    totalQuantity,
    totalStock,
    variantStock,
    storeName,
    recentOrders,
    isSuperAdmin: false,
  });
});

router.get("/seller-stats", async (req: Request, res: Response) => {
  if (!req.storeId) {
    res.status(403).json({ error: "Store not found" });
    return;
  }
  const sellers = await prisma.seller.findMany({ where: { storeId: req.storeId } });
  const stats = await Promise.all(
    sellers.map(async (seller) => {
      const orders = await prisma.order.findMany({
        where: { sellerId: seller.id },
        include: { items: true },
      });
      let totalRevenue = 0;
      let confirmedRevenue = 0;
      let totalQuantity = 0;
      const counts: Record<string, number> = {};
      for (const o of orders) {
        counts[o.status] = (counts[o.status] || 0) + 1;
        if (o.status !== "CANCELLED" && o.status !== "RETURNED") totalRevenue += o.totalPrice;
        if (o.status === "DELIVERED") confirmedRevenue += o.totalPrice;
        for (const item of o.items) totalQuantity += item.quantity;
      }
      return {
        id: seller.id,
        name: seller.name,
        active: seller.active,
        commission: seller.commission,
        totalOrders: orders.length,
        totalRevenue,
        confirmedRevenue,
        totalQuantity,
        newOrders: counts.NEW || 0,
        contactedOrders: counts.CONTACTED || 0,
        processingOrders: counts.PROCESSING || 0,
        shippedOrders: counts.SHIPPED || 0,
        deliveredOrders: counts.DELIVERED || 0,
        cancelledOrders: counts.CANCELLED || 0,
        returnedOrders: counts.RETURNED || 0,
      };
    })
  );
  res.json(stats);
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

const statusUpdateSchema = z.object({
  status: z.enum(VALID_STATUSES),
});

router.patch("/:id/status", requirePermission("orders", "edit"), async (req: Request<{ id: string }>, res: Response) => {
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

  // Restore stock for the actual products in the order (per item.productId)
  // when the order is returned or cancelled (inventory is released back).
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

router.delete("/:id", requirePermission("orders", "delete"), async (req: Request<{ id: string }>, res: Response) => {
  const where: any = { id: String(req.params.id), ...storeWhere(req) };
  const order = await prisma.order.findFirst({
    where,
    include: { items: true },
  });
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  await restoreOrderStock(order.items);
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
