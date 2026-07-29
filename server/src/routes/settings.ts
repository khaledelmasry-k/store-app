import { Router, Request, Response } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "../utils/prisma.js";
import { authMiddleware, requireSuperAdmin } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

const storeSchema = z.object({
  ref: z.string().min(1),
  name: z.string().min(1),
  active: z.boolean().optional(),
});

router.get("/stores", async (_req: Request, res: Response) => {
  const stores = await prisma.store.findMany({ orderBy: { createdAt: "asc" } });
  res.json(stores);
});

router.post("/stores", requireSuperAdmin, async (req: Request, res: Response) => {
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

router.patch("/stores/:id", requireSuperAdmin, async (req: Request, res: Response) => {
  const parsed = storeSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }
  const store = await prisma.store.update({ where: { id: String(req.params.id) }, data: parsed.data });
  res.json(store);
});

router.delete("/stores/:id", requireSuperAdmin, async (req: Request, res: Response) => {
  await prisma.store.delete({ where: { id: String(req.params.id) } });
  res.json({ success: true });
});

const adminSchema = z.object({
  username: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.string().optional(),
});

router.get("/admins", requireSuperAdmin, async (_req: Request, res: Response) => {
  const admins = await prisma.admin.findMany({
    select: { id: true, username: true, email: true, role: true, createdAt: true },
  });
  res.json(admins);
});

router.post("/admins", requireSuperAdmin, async (req: Request, res: Response) => {
  const parsed = adminSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }
  const existing = await prisma.admin.findUnique({ where: { username: parsed.data.username } });
  if (existing) {
    res.status(409).json({ error: "اسم المستخدم موجود بالفعل" });
    return;
  }
  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const admin = await prisma.admin.create({
    data: { username: parsed.data.username, email: parsed.data.email, passwordHash, role: parsed.data.role || "admin" },
    select: { id: true, username: true, email: true, role: true, createdAt: true },
  });
  res.status(201).json(admin);
});

router.delete("/admins/:id", requireSuperAdmin, async (req: Request, res: Response) => {
  await prisma.admin.delete({ where: { id: String(req.params.id) } });
  res.json({ success: true });
});

export default router;
