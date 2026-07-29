import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../utils/prisma.js";
import { authMiddleware, requireSuperAdmin } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware, requireSuperAdmin);

const PLANS = ["FREE", "STARTER", "PRO", "BUSINESS", "ENTERPRISE"] as const;

router.get("/", async (_req: Request, res: Response) => {
  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { stores: true, orders: true, tenantUsers: true } },
    },
  });
  const result = await Promise.all(
    tenants.map(async (t) => {
      const orders = await prisma.order.findMany({
        where: { tenantId: t.id },
        select: { totalPrice: true, status: true },
      });
      const totalRevenue = orders.reduce((sum, o) => sum + o.totalPrice, 0);
      const confirmedRevenue = orders
        .filter((o) => o.status === "DELIVERED")
        .reduce((sum, o) => sum + o.totalPrice, 0);
      return {
        id: t.id,
        name: t.name,
        subdomain: t.subdomain,
        domain: t.domain,
        email: t.email,
        phone: t.phone,
        status: t.status,
        plan: t.plan,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        storeCount: t._count.stores,
        orderCount: t._count.orders,
        userCount: t._count.tenantUsers,
        totalRevenue,
        confirmedRevenue,
      };
    })
  );
  res.json(result);
});

router.get("/:id", async (req: Request<{ id: string }>, res: Response) => {
  const tenant = await prisma.tenant.findUnique({
    where: { id: String(req.params.id) },
    include: {
      _count: { select: { stores: true, orders: true, tenantUsers: true } },
      stores: { select: { id: true, name: true, ref: true, active: true, createdAt: true } },
    },
  });
  if (!tenant) {
    res.status(404).json({ error: "Tenant not found" });
    return;
  }
  const orders = await prisma.order.findMany({
    where: { tenantId: tenant.id },
    select: { totalPrice: true, status: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const totalRevenue = orders.reduce((sum, o) => sum + o.totalPrice, 0);
  const confirmedRevenue = orders
    .filter((o) => o.status === "DELIVERED")
    .reduce((sum, o) => sum + o.totalPrice, 0);
  res.json({
    ...tenant,
    totalRevenue,
    confirmedRevenue,
    recentOrders: orders.slice(0, 10),
  });
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  subdomain: z.string().min(1).optional(),
  domain: z.string().optional().nullable(),
  email: z.string().email().optional(),
  phone: z.string().optional().nullable(),
  address: z.string().optional(),
  status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
  plan: z.enum(PLANS).optional(),
});

router.patch("/:id", async (req: Request<{ id: string }>, res: Response) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }
  const tenant = await prisma.tenant.update({
    where: { id: String(req.params.id) },
    data: parsed.data,
  });
  res.json(tenant);
});

router.delete("/:id", async (req: Request<{ id: string }>, res: Response) => {
  const tenantId = String(req.params.id);
  await prisma.orderItem.deleteMany({ where: { order: { tenantId } } });
  await prisma.order.deleteMany({ where: { tenantId } });
  await prisma.product.deleteMany({ where: { store: { tenantId } } });
  await prisma.storeLink.deleteMany({ where: { store: { tenantId } } });
  await prisma.store.deleteMany({ where: { tenantId } });
  await prisma.subscription.deleteMany({ where: { tenantId } });
  await prisma.role.deleteMany({ where: { tenantId } });
  await prisma.invitation.deleteMany({ where: { tenantId } });
  await prisma.tenantUser.deleteMany({ where: { tenantId } });
  await prisma.tenant.delete({ where: { id: tenantId } });
  res.json({ success: true });
});

export default router;
