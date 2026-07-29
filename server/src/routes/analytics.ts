import { Router, Request, Response } from "express";
import { prisma } from "../utils/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { getAdminStoreId } from "../utils/storeHelper.js";
import { parseJsonField } from "../utils/parseJson.js";

const router = Router();
router.use(authMiddleware);

function qs(val: unknown): string { return typeof val === "string" ? val : ""; }
function num(val: unknown): number | undefined { const n = parseInt(qs(val)); return isNaN(n) ? undefined : n; }

function buildWhere(req: Request, adminRole: string, storeId: string | null) {
  const where: any = {};
  if (adminRole !== "super_admin" && storeId) {
    where.storeId = storeId;
  } else {
    if (qs(req.query.tenantId)) where.tenantId = qs(req.query.tenantId);
    if (qs(req.query.storeId)) where.storeId = qs(req.query.storeId);
  }
  if (qs(req.query.sellerId)) where.sellerId = qs(req.query.sellerId);
  if (qs(req.query.landingPageId)) where.landingPageId = qs(req.query.landingPageId);
  if (qs(req.query.marketingLinkId)) where.marketingLinkId = qs(req.query.marketingLinkId);
  if (qs(req.query.utmCampaign)) where.utmCampaign = qs(req.query.utmCampaign);
  if (qs(req.query.status)) where.status = qs(req.query.status);

  const dateFrom = qs(req.query.dateFrom);
  const dateTo = qs(req.query.dateTo);
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(dateFrom);
    if (dateTo) where.createdAt.lte = new Date(dateTo);
  }
  return where;
}

router.get("/overview", async (req: Request, res: Response) => {
  const storeId = await getAdminStoreId(req.admin!);
  const where = buildWhere(req, req.admin!.role, storeId);

  const [orders, products] = await Promise.all([
    prisma.order.findMany({ where, select: { totalPrice: true, status: true, createdAt: true, items: true, sellerId: true } }),
    prisma.product.findMany({
      where: storeId ? { storeId } : {},
      select: { id: true, name: true, price: true },
    }),
  ]);

  const totalOrders = orders.length;
  const confirmedStatuses = ["DELIVERED", "SHIPPED", "PROCESSING", "CONTACTED"];
  const confirmedOrders = orders.filter((o) => confirmedStatuses.includes(o.status));
  const totalRevenue = confirmedOrders.reduce((s, o) => s + o.totalPrice, 0);
  const avgOrderValue = confirmedOrders.length > 0 ? totalRevenue / confirmedOrders.length : 0;

  const sellerOrderCount: Record<string, { orders: number; revenue: number }> = {};
  for (const o of orders) {
    if (o.sellerId) {
      if (!sellerOrderCount[o.sellerId]) sellerOrderCount[o.sellerId] = { orders: 0, revenue: 0 };
      sellerOrderCount[o.sellerId].orders++;
      if (confirmedStatuses.includes(o.status)) sellerOrderCount[o.sellerId].revenue += o.totalPrice;
    }
  }

  const productOrderCount: Record<string, { name: string; count: number; revenue: number }> = {};
  for (const p of products) productOrderCount[p.id] = { name: p.name, count: 0, revenue: 0 };
  for (const o of orders) {
    const items = parseJsonField<Array<{ name?: string; productId?: string; quantity: number; price: number }>>(o.items as any, []);
    for (const item of items) {
      const pid = item.productId || "";
      const key = pid || item.name || "";
      if (key) {
        if (!productOrderCount[key]) productOrderCount[key] = { name: item.name || key, count: 0, revenue: 0 };
        productOrderCount[key].count += item.quantity || 1;
        productOrderCount[key].revenue += (item.price || 0) * (item.quantity || 1);
      }
    }
  }

  const topProductsList = Object.values(productOrderCount).sort((a, b) => b.count - a.count).slice(0, 10);

  res.json({
    totalOrders,
    confirmedOrders: confirmedOrders.length,
    totalRevenue,
    avgOrderValue: Math.round(avgOrderValue * 100) / 100,
    topProducts: topProductsList,
    sellerPerformance: Object.entries(sellerOrderCount).map(([id, data]) => ({ sellerId: id, ...data })),
  });
});

router.get("/daily", async (req: Request, res: Response) => {
  const storeId = await getAdminStoreId(req.admin!);
  const days = Math.min(90, Math.max(1, parseInt(qs(req.query.days)) || 30));
  const where = buildWhere(req, req.admin!.role, storeId);

  const now = new Date();
  const dateFrom = qs(req.query.dateFrom);
  if (!dateFrom) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    where.createdAt = where.createdAt || {};
    where.createdAt.gte = where.createdAt.gte || since;
  }

  const orders = await prisma.order.findMany({
    where: { ...where, createdAt: where.createdAt },
    select: { totalPrice: true, createdAt: true, status: true },
    orderBy: { createdAt: "asc" },
  });

  const confirmedStatuses = ["DELIVERED", "SHIPPED", "PROCESSING", "CONTACTED"];

  if (!where.createdAt?.gte) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    where.createdAt = { ...where.createdAt, gte: since };
  }
  const since = where.createdAt.gte;
  const actualDays = Math.ceil((now.getTime() - since.getTime()) / 86400000);
  const dailyMap: Record<string, { orders: number; revenue: number }> = {};
  for (let i = 0; i <= actualDays; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    if (d > now) break;
    dailyMap[d.toISOString().slice(0, 10)] = { orders: 0, revenue: 0 };
  }

  for (const o of orders) {
    const key = o.createdAt.toISOString().slice(0, 10);
    if (dailyMap[key]) {
      dailyMap[key].orders++;
      if (confirmedStatuses.includes(o.status)) dailyMap[key].revenue += o.totalPrice;
    }
  }

  res.json({
    daily: Object.entries(dailyMap).map(([date, data]) => ({
      date, orders: data.orders, revenue: Math.round(data.revenue * 100) / 100,
    })),
  });
});

router.get("/top-products", async (req: Request, res: Response) => {
  const storeId = await getAdminStoreId(req.admin!);
  const where = buildWhere(req, req.admin!.role, storeId);
  const orders = await prisma.order.findMany({ where, select: { items: true } });
  const countMap: Record<string, { name: string; quantity: number; revenue: number }> = {};
  for (const o of orders) {
    const items = parseJsonField<Array<{ name?: string; productId?: string; quantity: number; price: number }>>(o.items as any, []);
    for (const item of items) {
      const key = item.productId || item.name || "unknown";
      if (!countMap[key]) countMap[key] = { name: item.name || key, quantity: 0, revenue: 0 };
      countMap[key].quantity += item.quantity || 1;
      countMap[key].revenue += (item.price || 0) * (item.quantity || 1);
    }
  }
  res.json({ products: Object.values(countMap).sort((a, b) => b.quantity - a.quantity) });
});

router.get("/seller-performance", async (req: Request, res: Response) => {
  const storeId = await getAdminStoreId(req.admin!);
  const where = buildWhere(req, req.admin!.role, storeId);
  const orders = await prisma.order.findMany({ where, select: { sellerId: true, totalPrice: true, status: true, createdAt: true } });
  const confirmedStatuses = ["DELIVERED", "SHIPPED", "PROCESSING", "CONTACTED"];
  const perf: Record<string, { orders: number; revenue: number; confirmed: number }> = {};
  for (const o of orders) {
    if (!o.sellerId) continue;
    if (!perf[o.sellerId]) perf[o.sellerId] = { orders: 0, revenue: 0, confirmed: 0 };
    perf[o.sellerId].orders++;
    if (confirmedStatuses.includes(o.status)) {
      perf[o.sellerId].revenue += o.totalPrice;
      perf[o.sellerId].confirmed++;
    }
  }
  const sellerIds = Object.keys(perf);
  const sellers = sellerIds.length > 0 ? await prisma.seller.findMany({ where: { id: { in: sellerIds } }, select: { id: true, name: true } }) : [];
  const sellerMap = new Map(sellers.map((s) => [s.id, s.name]));
  res.json(
    Object.entries(perf).map(([id, data]) => ({ sellerId: id, sellerName: sellerMap.get(id) || "Unknown", ...data }))
  );
});

router.get("/campaigns", async (req: Request, res: Response) => {
  const storeId = await getAdminStoreId(req.admin!);
  const where = buildWhere(req, req.admin!.role, storeId);
  const orders = await prisma.order.findMany({ where, select: { utmCampaign: true, totalPrice: true, status: true } });
  const confirmedStatuses = ["DELIVERED", "SHIPPED", "PROCESSING", "CONTACTED"];
  const campaigns: Record<string, { orders: number; revenue: number }> = {};
  for (const o of orders) {
    const c = o.utmCampaign || "(direct)";
    if (!campaigns[c]) campaigns[c] = { orders: 0, revenue: 0 };
    campaigns[c].orders++;
    if (confirmedStatuses.includes(o.status)) campaigns[c].revenue += o.totalPrice;
  }
  res.json(Object.entries(campaigns).map(([campaign, data]) => ({ campaign, ...data })));
});

router.get("/traffic-sources", async (req: Request, res: Response) => {
  const storeId = await getAdminStoreId(req.admin!);
  const where = buildWhere(req, req.admin!.role, storeId);
  const orders = await prisma.order.findMany({ where, select: { utmSource: true } });
  const sources: Record<string, number> = {};
  for (const o of orders) {
    const s = o.utmSource || "(direct)";
    sources[s] = (sources[s] || 0) + 1;
  }
  res.json(Object.entries(sources).map(([source, count]) => ({ source, count })));
});

export default router;
