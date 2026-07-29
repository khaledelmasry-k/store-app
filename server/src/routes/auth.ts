import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../utils/prisma.js";
import { config } from "../config.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2),
  companyName: z.string().min(1),
  storeName: z.string().min(1),
  subdomain: z.string().min(3).max(30).regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers, and hyphens"),
  plan: z.enum(["FREE", "STARTER", "PRO"]).optional().default("FREE"),
});

router.post("/register", async (req: Request, res: Response) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }

  const { email, password, name, companyName, storeName, subdomain, plan } = parsed.data;

  const existingEmail = await prisma.admin.findUnique({ where: { email } });
  if (existingEmail) {
    res.status(409).json({ error: "البريد الإلكتروني مستخدم بالفعل" });
    return;
  }

  const existingSubdomain = await prisma.tenant.findUnique({ where: { subdomain } });
  if (existingSubdomain) {
    res.status(409).json({ error: "النطاق الفرعي مستخدم بالفعل" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.admin.create({
    data: { username: email.split("@")[0], email, passwordHash, role: "seller" },
  });

  const tenant = await prisma.tenant.create({
    data: {
      name: companyName,
      subdomain,
      email,
      address: "",
      status: "ACTIVE",
      plan,
    },
  });

  await prisma.tenantUser.create({
    data: { tenantId: tenant.id, adminId: admin.id, role: "OWNER" },
  });

  const ref = subdomain;
  const store = await prisma.store.create({
    data: {
      ref,
      name: storeName,
      adminId: admin.id,
      tenantId: tenant.id,
      active: true,
    },
  });

  await prisma.product.create({
    data: {
      storeId: store.id,
      name: "منتجك الأول",
      description: "وصف المنتج",
      price: 0,
      pricingTiers: JSON.stringify({ 1: 0, 2: 0, 3: 0, 4: 0 }),
      variantStock: JSON.stringify({}),
      images: JSON.stringify({}),
      colors: JSON.stringify([]),
      sizes: JSON.stringify([]),
      active: true,
    },
  });

  await prisma.subscription.create({
    data: {
      tenantId: tenant.id,
      adminId: admin.id,
      plan,
      price: 0,
      status: "ACTIVE",
      currentPeriod: new Date(),
      nextBilling: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  const token = jwt.sign(
    { adminId: admin.id, username: admin.username, role: admin.role, tenantId: tenant.id },
    config.jwtSecret,
    { expiresIn: "24h" }
  );

  res.status(201).json({
    token,
    admin: { id: admin.id, username: admin.username, email: admin.email, role: admin.role, tenantId: tenant.id },
    tenant: { id: tenant.id, name: tenant.name, subdomain: tenant.subdomain },
    store: { id: store.id, name: store.name, ref: store.ref },
  });
});

router.get("/me", authMiddleware, async (req: Request, res: Response) => {
  const admin = await prisma.admin.findUnique({
    where: { id: req.admin!.adminId },
    select: { id: true, username: true, email: true, role: true, createdAt: true },
  });
  const tu = await prisma.tenantUser.findFirst({ where: { adminId: req.admin!.adminId }, include: { tenant: true } });
  res.json({ admin, tenant: tu?.tenant || null });
});

export default router;
