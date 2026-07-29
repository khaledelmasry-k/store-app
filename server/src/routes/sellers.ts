import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../utils/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { getAdminStoreId } from "../utils/storeHelper.js";

const router = Router();
router.use(authMiddleware);

router.get("/", async (req: Request, res: Response) => {
  const storeId = await getAdminStoreId(req.admin!);
  if (!storeId) {
    res.status(403).json({ error: "Store not found" });
    return;
  }
  const sellers = await prisma.seller.findMany({
    where: { storeId },
    orderBy: { createdAt: "desc" },
  });
  const result = await Promise.all(
    sellers.map(async (s) => {
      const orders = await prisma.order.findMany({
        where: { sellerId: s.id },
        select: { totalPrice: true, status: true },
      });
      const totalOrders = orders.length;
      const totalRevenue = orders.reduce((sum, o) => sum + o.totalPrice, 0);
      const confirmedRevenue = orders.filter((o) => o.status === "DELIVERED").reduce((sum, o) => sum + o.totalPrice, 0);
      let parsedPermissions = {};
      try { parsedPermissions = JSON.parse(s.permissions || "{}"); } catch {}
      return { ...s, permissions: parsedPermissions, totalOrders, totalRevenue, confirmedRevenue };
    })
  );
  res.json(result);
});

const sellerSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  commission: z.number().min(0).max(100).optional().default(0),
  active: z.boolean().optional().default(true),
});

router.post("/", async (req: Request, res: Response) => {
  const parsed = sellerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }
  const storeId = await getAdminStoreId(req.admin!);
  if (!storeId) {
    res.status(403).json({ error: "Store not found" });
    return;
  }
  const seller = await prisma.seller.create({ data: { ...parsed.data, storeId } });
  res.status(201).json(seller);
});

router.patch("/:id", async (req: Request<{ id: string }>, res: Response) => {
  const storeId = await getAdminStoreId(req.admin!);
  const parsed = sellerSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }
  const where: any = { id: String(req.params.id) };
  if (storeId) where.storeId = storeId;
  const seller = await prisma.seller.findFirst({ where });
  if (!seller) {
    res.status(404).json({ error: "Seller not found" });
    return;
  }
  const updated = await prisma.seller.update({ where: { id: seller.id }, data: parsed.data });
  res.json(updated);
});

router.patch("/:id/permissions", async (req: Request<{ id: string }>, res: Response) => {
  const storeId = await getAdminStoreId(req.admin!);
  const where: any = { id: String(req.params.id) };
  if (storeId) where.storeId = storeId;
  const seller = await prisma.seller.findFirst({ where });
  if (!seller) { res.status(404).json({ error: "Seller not found" }); return; }
  const { permissions } = req.body;
  const updated = await prisma.seller.update({
    where: { id: seller.id },
    data: { permissions: JSON.stringify(permissions || {}) },
  });
  res.json(updated);
});

router.delete("/:id", async (req: Request<{ id: string }>, res: Response) => {
  const storeId = await getAdminStoreId(req.admin!);
  const where: any = { id: String(req.params.id) };
  if (storeId) where.storeId = storeId;
  const seller = await prisma.seller.findFirst({ where });
  if (!seller) {
    res.status(404).json({ error: "Seller not found" });
    return;
  }
  await prisma.seller.delete({ where: { id: seller.id } });
  res.json({ success: true });
});

export default router;
