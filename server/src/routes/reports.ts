import { Router, Request, Response } from "express";
import { prisma } from "../utils/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { getAdminStoreId } from "../utils/storeHelper.js";
import { parseJsonField } from "../utils/parseJson.js";

const router = Router();
router.use(authMiddleware);

function qs(val: unknown): string { return typeof val === "string" ? val : ""; }

function buildWhere(req: Request, storeId: string | null) {
  const where: any = storeId ? { storeId } : {};
  const dateFrom = qs(req.query.dateFrom);
  const dateTo = qs(req.query.dateTo);
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(dateFrom);
    if (dateTo) where.createdAt.lte = new Date(dateTo);
  } else {
    const days = Math.min(365, Math.max(1, parseInt(qs(req.query.days)) || 7));
    const since = new Date();
    since.setDate(since.getDate() - days);
    where.createdAt = { gte: since };
  }
  return where;
}

router.get("/summary", async (req: Request, res: Response) => {
  const storeId = await getAdminStoreId(req.admin!);
  const where = buildWhere(req, storeId);

  const orders = await prisma.order.findMany({ where, select: { totalPrice: true, status: true, createdAt: true } });
  const confirmedStatuses = ["DELIVERED", "SHIPPED", "PROCESSING", "CONTACTED"];
  const totalOrders = orders.length;
  const totalRevenue = orders.filter((o) => confirmedStatuses.includes(o.status)).reduce((s, o) => s + o.totalPrice, 0);
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const byStatus: Record<string, number> = {};
  for (const o of orders) {
    byStatus[o.status] = (byStatus[o.status] || 0) + 1;
  }

  res.json({ totalOrders, totalRevenue: Math.round(totalRevenue), avgOrderValue: Math.round(avgOrderValue * 100) / 100, byStatus });
});

router.get("/period", async (req: Request, res: Response) => {
  const storeId = await getAdminStoreId(req.admin!);
  const period = qs(req.query.period) || "daily"; // daily | weekly | monthly
  const where = buildWhere(req, storeId);

  const orders = await prisma.order.findMany({
    where,
    select: { totalPrice: true, status: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const confirmedStatuses = ["DELIVERED", "SHIPPED", "PROCESSING", "CONTACTED"];
  const periodMap: Record<string, { orders: number; revenue: number }> = {};

  for (const o of orders) {
    const d = o.createdAt;
    let key: string;
    if (period === "monthly") key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    else if (period === "weekly") {
      const startOfWeek = new Date(d);
      startOfWeek.setDate(d.getDate() - d.getDay());
      key = startOfWeek.toISOString().slice(0, 10);
    } else key = d.toISOString().slice(0, 10);

    if (!periodMap[key]) periodMap[key] = { orders: 0, revenue: 0 };
    periodMap[key].orders++;
    if (confirmedStatuses.includes(o.status)) periodMap[key].revenue += o.totalPrice;
  }

  res.json({
    period,
    data: Object.entries(periodMap).map(([date, d]) => ({ date, ...d })).sort((a, b) => a.date.localeCompare(b.date)),
  });
});

router.get("/export-csv", async (req: Request, res: Response) => {
  const storeId = await getAdminStoreId(req.admin!);
  const where = storeId ? { storeId } : {};

  const orders = await prisma.order.findMany({
    where,
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });

  const headers = "رقم الطلب,العميل,الهاتف,المحافظة,المدينة,العنوان,الحالة,الإجمالي,التاريخ,المتجر";
  const rows = orders.map((o) => {
    const itemsStr = o.items.map((i) => `${i.name || ""}(${i.color}/${i.size})×${i.quantity}`).join(" | ");
    return `"${o.orderNumber}","${o.customerName}","${o.phone}","${o.governorate}","${o.city}","${o.address}","${o.status}",${o.totalPrice},"${o.createdAt.toISOString()}","${itemsStr}"`;
  });

  const csv = `${headers}\n${rows.join("\n")}`;
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename=report-${new Date().toISOString().slice(0, 10)}.csv`);
  res.send("\uFEFF" + csv);
});

export default router;
