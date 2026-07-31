import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../utils/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireStore, requirePermission } from "../middleware/permission.js";

const router = Router();
router.use(authMiddleware, requireStore);

router.get("/", async (req: Request, res: Response) => {
  const where: any = req.storeId ? { storeId: req.storeId } : {};
  const categories = await prisma.category.findMany({ where, orderBy: { name: "asc" } });
  res.json(categories);
});

const categorySchema = z.object({
  name: z.string().min(1),
});

router.post("/", requirePermission("products", "create"), async (req: Request, res: Response) => {
  const parsed = categorySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }
  if (!req.storeId) {
    res.status(403).json({ error: "Store not found for this account" });
    return;
  }
  const category = await prisma.category.create({ data: { name: parsed.data.name, storeId: req.storeId } });
  res.status(201).json(category);
});

router.delete("/:id", requirePermission("products", "delete"), async (req: Request<{ id: string }>, res: Response) => {
  const where: any = { id: String(req.params.id) };
  if (req.storeId) where.storeId = req.storeId;
  const existing = await prisma.category.findFirst({ where });
  if (!existing) {
    res.status(404).json({ error: "Category not found" });
    return;
  }
  await prisma.category.delete({ where: { id: existing.id } });
  res.json({ success: true });
});

export default router;
