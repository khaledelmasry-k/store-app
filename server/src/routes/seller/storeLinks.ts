import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../../utils/prisma.js";
import { authMiddleware } from "../../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

const storeLinkSchema = z.object({
  slug: z.string().min(1),
  customTitle: z.string().optional(),
  productIds: z.string(),
  customLogo: z.string().optional(),
  customColor: z.string().optional(),
  sellerId: z.string().optional().nullable(),
  utmSource: z.string().optional().nullable(),
  utmMedium: z.string().optional().nullable(),
  utmCampaign: z.string().optional().nullable(),
  stats: z.any().optional(),
});

router.get("/", async (req: Request, res: Response) => {
  const storeId = await (async (admin: any): Promise<string | null> => {
    if (admin.role === "super_admin") return null;
    const store = await prisma.store.findFirst({ where: { adminId: admin.adminId } });
    return store?.id ?? null;
  })(req.admin!);

  const where = storeId ? { storeId } : {};
  const storeLinks = await prisma.storeLink.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { seller: { select: { id: true, name: true } } },
  });
  res.json(storeLinks);
});

router.post("/", async (req: Request, res: Response) => {
  const parsed = storeLinkSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }

  const storeId = await (async (admin: any): Promise<string | null> => {
    if (admin.role === "super_admin") return null;
    const store = await prisma.store.findFirst({ where: { adminId: admin.adminId } });
    return store?.id ?? null;
  })(req.admin!);

  if (!storeId) {
    res.status(403).json({ error: "Store not found or not authorized" });
    return;
  }

  const existing = await prisma.storeLink.findUnique({ where: { slug: parsed.data.slug } });
  if (existing) {
    res.status(409).json({ error: "Store link slug already exists" });
    return;
  }

  const storeLink = await prisma.storeLink.create({
    data: {
      slug: parsed.data.slug,
      customTitle: parsed.data.customTitle,
      productIds: parsed.data.productIds,
      customLogo: parsed.data.customLogo ?? "",
      customColor: parsed.data.customColor ?? "#000000",
      sellerId: parsed.data.sellerId ?? null,
      utmSource: parsed.data.utmSource ?? null,
      utmMedium: parsed.data.utmMedium ?? null,
      utmCampaign: parsed.data.utmCampaign ?? null,
      stats: parsed.data.stats ?? {},
      storeId,
    },
  });
  res.status(201).json(storeLink);
});

router.patch("/:id", async (req: Request<{ id: string }>, res: Response) => {
  const parsed = storeLinkSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }

  const storeId = await (async (admin: any): Promise<string | null> => {
    if (admin.role === "super_admin") return null;
    const store = await prisma.store.findFirst({ where: { adminId: admin.adminId } });
    return store?.id ?? null;
  })(req.admin!);

  const where: any = { id: String(req.params.id) };
  if (storeId) where.storeId = storeId;

  const existingStoreLink = await prisma.storeLink.findFirst({ where });
  if (!existingStoreLink) {
    res.status(404).json({ error: "Store link not found" });
    return;
  }

  const updatedStoreLink = await prisma.storeLink.update({
    where: { id: String(req.params.id) },
    data: parsed.data,
  });
  res.json(updatedStoreLink);
});

router.delete("/:id", async (req: Request<{ id: string }>, res: Response) => {
  const storeId = await (async (admin: any): Promise<string | null> => {
    if (admin.role === "super_admin") return null;
    const store = await prisma.store.findFirst({ where: { adminId: admin.adminId } });
    return store?.id ?? null;
  })(req.admin!);

  const where: any = { id: String(req.params.id) };
  if (storeId) where.storeId = storeId;

  const existingStoreLink = await prisma.storeLink.findFirst({ where });
  if (!existingStoreLink) {
    res.status(404).json({ error: "Store link not found" });
    return;
  }

  await prisma.storeLink.delete({ where: { id: String(req.params.id) } });
  res.json({ success: true });
});

router.patch("/:id/click", async (req: Request<{ id: string }>, res: Response) => {
  const storeLink = await prisma.storeLink.findUnique({ where: { id: String(req.params.id) } });
  if (!storeLink) {
    res.status(404).json({ error: "Store link not found" });
    return;
  }
  const updated = await prisma.storeLink.update({
    where: { id: String(req.params.id) },
    data: { clicks: { increment: 1 } },
  });
  res.json({ clicks: updated.clicks });
});

export default router;
