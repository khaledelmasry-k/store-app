import { Router, Request, Response } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "../utils/prisma.js";
import { authMiddleware, requireSuperAdmin } from "../middleware/auth.js";

const router = Router();

const subscriptionPlanSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  phone: z.string().optional(),
  plan: z.string(),
  price: z.number().positive(),
});

// Public: Submit subscription request
router.post("/request", async (req: Request, res: Response) => {
  const parsed = subscriptionPlanSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }

  const { email, name, phone, plan, price } = parsed.data;

  const existingRequest = await prisma.subscriptionRequest.findFirst({
    where: { email },
  });

  if (existingRequest) {
    res.status(409).json({ error: "Request already submitted for this email" });
    return;
  }

  const request = await prisma.subscriptionRequest.create({
    data: { email, name, phone, plan, price, status: "PENDING" },
  });

  res.status(201).json(request);
});

// Public: Get pricing plans
router.get("/plans", async (_req: Request, res: Response) => {
  const plans = [
    { name: "starter", price: 999, features: ["منتجات غير محدودة", "متجر واحد", "دعم عبر البريد", "تحديثات شهرية"] },
    { name: "professional", price: 1999, features: ["منتجات غير محدودة", "متاجر غير محدودة", "دعم فوري", "تقارير متقدمة", "استضافة مجانية"], popular: true },
    { name: "enterprise", price: 0, features: ["كل ميزات بروفيشنال", "تكامل مخصص", "مدير حساب", "تدريب الفريق", "SLA مضمون"], custom: true },
  ];
  res.json(plans);
});

// Super admin: Get all subscription requests
router.get("/admin/requests", authMiddleware, requireSuperAdmin, async (_req: Request, res: Response) => {
  const requests = await prisma.subscriptionRequest.findMany({
    orderBy: { createdAt: "desc" },
  });
  res.json(requests);
});

// Super admin: Update subscription request (approve/decline)
router.patch("/admin/requests/:id", authMiddleware, requireSuperAdmin, async (req: Request<{ id: string }>, res: Response) => {
  const { status, adminId } = req.body as { status: string; adminId?: string };
  if (!["APPROVED", "DECLINED"].includes(status)) {
    res.status(400).json({ error: "Invalid status. Must be APPROVED or DECLINED" });
    return;
  }

  const updateData: any = { status, updatedAt: new Date() };
  if (status === "APPROVED" && adminId) {
    updateData.admin = {
      connect: { id: adminId },
    };
  }

  const request = await prisma.subscriptionRequest.update({
    where: { id: String(req.params.id) },
    data: updateData,
    include: { admin: true },
  });

  if (status === "APPROVED") {
    const existingSeller = await prisma.admin.findFirst({
      where: { email: request.email },
    });

    if (existingSeller) {
      res.json({ ...request, message: "Seller already exists", seller: existingSeller });
      return;
    }

    const passwordHash = await bcrypt.hash("password123", 10);
    const seller = await prisma.admin.create({
      data: {
        username: request.name.toLowerCase().replace(/\\s+/g, "") + Math.floor(Math.random() * 1000),
        email: request.email,
        passwordHash,
        role: "seller",
      },
    });

    updateData.seller = seller;
    await prisma.subscriptionRequest.update({
      where: { id: request.id },
      data: updateData,
    });

    res.json({ ...request, message: "Seller created and request approved", seller });
    return;
  }

  res.json(request);
});

export default router;