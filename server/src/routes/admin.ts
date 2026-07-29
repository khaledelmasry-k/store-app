import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../utils/prisma.js";
import { config } from "../config.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

router.post("/login", async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }
  const { username, password } = parsed.data;
  const admin = await prisma.admin.findUnique({ where: { username } });
  if (!admin) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  const valid = await bcrypt.compare(password, admin.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  const tenantUser = await prisma.tenantUser.findFirst({ where: { adminId: admin.id } });
  const token = jwt.sign(
    { adminId: admin.id, username: admin.username, role: admin.role, tenantId: tenantUser?.tenantId },
    config.jwtSecret,
    { expiresIn: "24h" }
  );
  res.json({
    token,
    admin: { id: admin.id, username: admin.username, email: admin.email, role: admin.role, tenantId: tenantUser?.tenantId },
  });
});

router.get("/me", authMiddleware, async (req: Request, res: Response) => {
  const admin = await prisma.admin.findUnique({
    where: { id: req.admin!.adminId },
    select: { id: true, username: true, email: true, role: true, createdAt: true },
  });
  res.json(admin);
});

export default router;
