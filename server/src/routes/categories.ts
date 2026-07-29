import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../utils/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { getAdminStoreId } from "../utils/storeHelper.js";

const router = Router();
router.use(authMiddleware);

router.get("/", async (req: Request, res: Response) => {
  const storeId = await getAdminStoreId(req.admin!);
  const where: any = {};
  if (storeId) where.storeId = storeId;
  const categories = await prisma.category.findMany({ where, orderBy: { name: "asc" } });
  res.json(categories);
});

const categorySchema = z.object({
  name: z.string().min(1),
});

router.post("/", async (req: Request, res: Response) => {
  const parsed = categorySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }
  const storeId = await getAdminStoreId(req.admin!);
  const category = await prisma.category.create({ data: { name: parsed.data.name, storeId: storeId || undefined } });
  res.status(201).json(category);
});

router.delete("/:id", async (req: Request<{ id: string }>, res: Response) => {
  await prisma.category.delete({ where: { id: String(req.params.id) } });
  res.json({ success: true });
});

export default router;
