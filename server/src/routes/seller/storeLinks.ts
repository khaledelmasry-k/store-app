import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../../utils/prisma.js";
import { authMiddleware } from "../../middleware/auth.js";
import { requireStore, requirePermission } from "../../middleware/permission.js";

const router = Router();
router.use(authMiddleware, requireStore);

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
  const where = req.storeId ? { storeId: req.storeId } : {};
  const storeLinks = await prisma.storeLink.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { seller: { select: { id: true, name: true } } },
  });
  res.json(storeLinks);
});

router.post("/", requirePermission("store-links", "create"), async (req: Request, res: Response) => {
  const parsed = storeLinkSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }

  if (!req.storeId) {
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
      storeId: req.storeId,
    },
  });
  res.status(201).json(storeLink);
});

router.patch("/:id", requirePermission("store-links", "edit"), async (req: Request<{ id: string }>, res: Response) => {
  const parsed = storeLinkSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }

  const where: any = { id: String(req.params.id) };
  if (req.storeId) where.storeId = req.storeId;

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

router.delete("/:id", requirePermission("store-links", "delete"), async (req: Request<{ id: string }>, res: Response) => {
  const where: any = { id: String(req.params.id) };
  if (req.storeId) where.storeId = req.storeId;

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
