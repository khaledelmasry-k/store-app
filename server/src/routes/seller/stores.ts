import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../../utils/prisma.js";
import { authMiddleware } from "../../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

const storeSchema = z.object({
  ref: z.string().min(1),
  name: z.string().min(1),
  active: z.boolean().optional(),
});

router.get("/", async (_req: Request, res: Response) => {
  const stores = await prisma.store.findMany({ where: { adminId: null }, orderBy: { createdAt: "asc" } });
  res.json(stores);
});

router.post("/", async (req: Request, res: Response) => {
  const parsed = storeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }

  const existing = await prisma.store.findUnique({ where: { ref: parsed.data.ref } });
  if (existing) {
    res.status(409).json({ error: "رقم المرجع موجود بالفعل" });
    return;
  }

  const store = await prisma.store.create({ data: parsed.data });
  res.status(201).json(store);
});

router.patch("/:id", async (req: Request<{ id: string }>, res: Response) => {
  const parsed = storeSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }

  const store = await prisma.store.update({ where: { id: String(req.params.id) }, data: parsed.data });
  res.json(store);
});

router.delete("/:id", async (req: Request<{ id: string }>, res: Response) => {
  await prisma.store.delete({ where: { id: String(req.params.id) } });
  res.json({ success: true });
});

router.post("/:id/assign", async (req: Request<{ id: string }>, res: Response) => {
  const { adminId } = req.body as { adminId: string };
  const store = await prisma.store.update({ where: { id: String(req.params.id) }, data: { adminId } });
  res.json(store);
});

export default router;