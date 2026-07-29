import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../utils/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { getAdminStoreId } from "../utils/storeHelper.js";
import { parseJsonField } from "../utils/parseJson.js";
import { computeTotalStock } from "../utils/stock.js";

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
  const ref = qs(req.query.ref);

  const storeId = await getAdminStoreId(req.admin!);
  const where: any = storeId ? { storeId } : {};
  if (search) where.customerName = { contains: search };
  if (phone) where.phone = { contains: phone };
  const validStatuses = ["NEW", "CONTACTED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED"];
  if (status && validStatuses.includes(status)) where.status = status;
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
  const statuses = ["NEW", "CONTACTED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED"] as const;
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
  for (const st of statuses) s[st] = counts[st] || 0;
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

router.get("/dashboard", async (req: Request, res: Response) => {
  const storeId = await getAdminStoreId(req.admin!);

  if (req.admin!.role === "super_admin") {
    const statuses = ["NEW", "CONTACTED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED"] as const;
    const counts = await Promise.all(
      statuses.map((s) => prisma.order.count({ where: { status: s } }))
    );
    const totalOrders = counts.reduce((a, b) => a + b, 0);

    const stores = await prisma.store.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, ref: true, name: true } });
    const storeStatsData = await Promise.all(
      stores.map(async (st) => {
        const sts = await storeStats(st.id);
        return { ref: st.ref, name: st.name, ...sts };
      })
    );

    const product = await prisma.product.findFirst({ orderBy: { updatedAt: "desc" } });
    const variantStock = parseJsonField<Record<string, Record<string, number>>>(product?.variantStock ?? "{}", {});

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
      totalStock: computeTotalStock(variantStock),
      variantStock,
      recentOrders,
      isSuperAdmin: true,
    });
    return;
  }

  const where = storeId ? { storeId } : { createdBy: req.admin!.username };
  const statuses = ["NEW", "CONTACTED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED"] as const;
  const counts = await Promise.all(
    statuses.map((s) => prisma.order.count({ where: { ...where, status: s } }))
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

  const storeName = storeId ? (await prisma.store.findUnique({ where: { id: storeId } }))?.name : "";

  const product = await prisma.product.findFirst({ where: storeId ? { storeId } : {}, orderBy: { updatedAt: "desc" } });
  const variantStock = parseJsonField<Record<string, Record<string, number>>>(product?.variantStock ?? "{}", {});

  const recentOrders = await getRecentOrders(storeId);

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
    totalStock: computeTotalStock(variantStock),
    variantStock,
    storeName,
    recentOrders,
    isSuperAdmin: false,
  });
});

router.get("/seller-stats", async (req: Request, res: Response) => {
  const storeId = await getAdminStoreId(req.admin!);
  if (!storeId) {
    res.status(403).json({ error: "Store not found" });
    return;
  }
  const sellers = await prisma.seller.findMany({ where: { storeId } });
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

const statusUpdateSchema = z.object({
  status: z.enum(["NEW", "CONTACTED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED"]),
});

router.patch("/:id/status", async (req: Request<{ id: string }>, res: Response) => {
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

  if (parsed.data.status === "RETURNED" && order.status !== "RETURNED") {
    const productWhere: any = {};
    if (storeId) productWhere.storeId = storeId;
    const product = await prisma.product.findFirst({ where: productWhere, orderBy: { updatedAt: "desc" } });
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

  const productWhere: any = {};
  if (storeId) productWhere.storeId = storeId;
  const product = await prisma.product.findFirst({ where: productWhere, orderBy: { updatedAt: "desc" } });
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

  await prisma.order.delete({ where: { id: String(req.params.id) } });
  res.json({ success: true });
});

export default router;
