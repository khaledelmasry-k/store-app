import { Router, Request, Response } from "express";
import { prisma } from "../utils/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { getAdminStoreId } from "../utils/storeHelper.js";

const router = Router();
router.use(authMiddleware);

router.get("/", async (req: Request, res: Response) => {
  const storeId = await getAdminStoreId(req.admin!);
  const page = Math.max(1, parseInt(String(req.query.page)) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit)) || 20));
  const search = String(req.query.search || "");
  const sortBy = String(req.query.sortBy || "lastOrder");
  const sortDir = String(req.query.sortDir || "desc");
  const segment = String(req.query.segment || "");

  const where: any = storeId ? { storeId } : {};
  if (search) {
    where.OR = [
      { customerName: { contains: search } },
      { phone: { contains: search } },
    ];
  }

  const orders = await prisma.order.findMany({
    where,
    select: {
      customerName: true, phone: true, governorate: true, city: true,
      totalPrice: true, createdAt: true, notes: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const customerMap = new Map<string, {
    name: string; phone: string; governorate: string; city: string;
    orderCount: number; totalSpent: number; lastOrder: string;
    orders: Array<{ date: string; total: number; status: string }>;
    noteCount: number; segment: string;
  }>();

  for (const o of orders) {
    const existing = customerMap.get(o.phone);
    if (existing) {
      existing.orderCount++;
      existing.totalSpent += o.totalPrice;
      if (o.createdAt.toISOString() > existing.lastOrder) {
        existing.lastOrder = o.createdAt.toISOString();
        existing.name = o.customerName;
      }
      existing.orders.push({ date: o.createdAt.toISOString(), total: o.totalPrice, status: "" });
    } else {
      customerMap.set(o.phone, {
        name: o.customerName, phone: o.phone,
        governorate: o.governorate, city: o.city,
        orderCount: 1, totalSpent: o.totalPrice,
        lastOrder: o.createdAt.toISOString(),
        orders: [{ date: o.createdAt.toISOString(), total: o.totalPrice, status: "" }],
        noteCount: 0, segment: "",
      });
    }
  }

  let customers = Array.from(customerMap.values());
  if (segment) customers = customers.filter((c) => c.segment === segment);

  const sortFn = (a: any, b: any) => {
    const dir = sortDir === "asc" ? 1 : -1;
    if (sortBy === "name") return dir * a.name.localeCompare(b.name);
    if (sortBy === "orders") return dir * (a.orderCount - b.orderCount);
    if (sortBy === "total") return dir * (a.totalSpent - b.totalSpent);
    if (sortBy === "phone") return dir * a.phone.localeCompare(b.phone);
    return dir * (new Date(a.lastOrder).getTime() - new Date(b.lastOrder).getTime());
  };
  customers.sort(sortFn);

  const total = customers.length;
  const totalPages = Math.ceil(total / limit);
  const start = (page - 1) * limit;
  customers = customers.slice(start, start + limit);

  res.json({ customers, pagination: { page, limit, total, totalPages } });
});

router.get("/:phone", async (req: Request<{ phone: string }>, res: Response) => {
  const storeId = await getAdminStoreId(req.admin!);
  const phone = String(req.params.phone);
  const where: any = storeId ? { storeId, phone } : { phone };
  const orders = await prisma.order.findMany({
    where, include: { items: true },
    orderBy: { createdAt: "desc" },
  });
  if (orders.length === 0) { res.status(404).json({ error: "Customer not found" }); return; }
  const first = orders[0];
  res.json({
    customer: {
      name: first.customerName, phone: first.phone,
      governorate: first.governorate, city: first.city, address: first.address,
      orderCount: orders.length,
      totalSpent: orders.reduce((s, o) => s + o.totalPrice, 0),
    },
    orders: orders.map((o) => ({
      orderNumber: o.orderNumber, totalPrice: o.totalPrice, status: o.status,
      createdAt: o.createdAt, items: o.items,
      sellerId: o.sellerId, landingPageId: o.landingPageId,
      marketingLinkId: o.marketingLinkId, utmCampaign: o.utmCampaign,
    })),
  });
});

router.post("/:phone/notes", async (req: Request<{ phone: string }>, res: Response) => {
  const { note } = req.body;
  if (!note) { res.status(400).json({ error: "Note is required" }); return; }
  const phone = String(req.params.phone);
  const storeId = await getAdminStoreId(req.admin!);
  const where: any = storeId ? { storeId, phone } : { phone };
  const lastOrder = await prisma.order.findFirst({ where, orderBy: { createdAt: "desc" }, select: { id: true } });
  if (!lastOrder) { res.status(404).json({ error: "Customer not found" }); return; }
  res.json({ success: true, note });
});

router.put("/:phone/segment", async (req: Request<{ phone: string }>, res: Response) => {
  const { segment } = req.body;
  if (!segment) { res.status(400).json({ error: "Segment is required" }); return; }
  res.json({ success: true, phone: req.params.phone, segment });
});

export default router;
