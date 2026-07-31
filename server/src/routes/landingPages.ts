import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../utils/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireStore, requirePermission } from "../middleware/permission.js";

const router = Router();
router.use(authMiddleware, requireStore);

const pageSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  sections: z.string().optional(),
  published: z.boolean().optional(),
});

router.get("/", async (req: Request, res: Response) => {
  if (!req.storeId) {
    res.status(403).json({ error: "Store not found" });
    return;
  }
  const pages = await prisma.landingPage.findMany({
    where: { storeId: req.storeId },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, slug: true, published: true, createdAt: true, updatedAt: true },
  });
  res.json(pages);
});

router.get("/:id", async (req: Request, res: Response) => {
  const where: any = { id: String(req.params.id) };
  if (req.storeId) where.storeId = req.storeId;
  const page = await prisma.landingPage.findFirst({ where });
  if (!page) {
    res.status(404).json({ error: "Page not found" });
    return;
  }
  const sections = JSON.parse(page.sections);
  res.json({ ...page, sections });
});

router.post("/", requirePermission("landing-pages", "create"), async (req: Request, res: Response) => {
  const parsed = pageSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }
  if (!req.storeId) {
    res.status(403).json({ error: "Store not found" });
    return;
  }
  const existing = await prisma.landingPage.findUnique({ where: { slug: parsed.data.slug } });
  if (existing) {
    res.status(409).json({ error: "Slug already exists" });
    return;
  }
  const page = await prisma.landingPage.create({
    data: { storeId: req.storeId, name: parsed.data.name, slug: parsed.data.slug, sections: parsed.data.sections || "[]" },
  });
  res.status(201).json(page);
});

router.put("/:id", requirePermission("landing-pages", "edit"), async (req: Request, res: Response) => {
  const parsed = pageSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }
  const where: any = { id: String(req.params.id) };
  if (req.storeId) where.storeId = req.storeId;
  const page = await prisma.landingPage.findFirst({ where });
  if (!page) {
    res.status(404).json({ error: "Page not found" });
    return;
  }
  if (parsed.data.slug && parsed.data.slug !== page.slug) {
    const existing = await prisma.landingPage.findUnique({ where: { slug: parsed.data.slug } });
    if (existing) { res.status(409).json({ error: "Slug already exists" }); return; }
  }
  const data: any = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.slug !== undefined) data.slug = parsed.data.slug;
  if (parsed.data.sections !== undefined) data.sections = parsed.data.sections;
  if (parsed.data.published !== undefined) data.published = parsed.data.published;
  const updated = await prisma.landingPage.update({ where: { id: page.id }, data });
  const sections = JSON.parse(updated.sections);
  res.json({ ...updated, sections });
});

router.delete("/:id", requirePermission("landing-pages", "delete"), async (req: Request, res: Response) => {
  const where: any = { id: String(req.params.id) };
  if (req.storeId) where.storeId = req.storeId;
  const page = await prisma.landingPage.findFirst({ where });
  if (!page) {
    res.status(404).json({ error: "Page not found" });
    return;
  }
  await prisma.landingPage.delete({ where: { id: page.id } });
  res.json({ success: true });
});

router.post("/:id/publish", requirePermission("landing-pages", "edit"), async (req: Request, res: Response) => {
  const where: any = { id: String(req.params.id) };
  if (req.storeId) where.storeId = req.storeId;
  const page = await prisma.landingPage.findFirst({ where });
  if (!page) {
    res.status(404).json({ error: "Page not found" });
    return;
  }
  const updated = await prisma.landingPage.update({
    where: { id: page.id },
    data: { published: !page.published },
  });
  res.json(updated);
});

router.get("/public/:slug", async (req: Request<{ slug: string }>, res: Response) => {
  const page = await prisma.landingPage.findUnique({
    where: { slug: String(req.params.slug), published: true },
    include: { store: { select: { name: true, tagLine: true, logo: true, primaryColor: true, active: true } } },
  });
  if (!page || !page.store.active) {
    res.status(404).json({ error: "Page not found or not published" });
    return;
  }
  const sections = JSON.parse(page.sections);
  res.json({ ...page, sections, store: page.store });
});

export default router;
