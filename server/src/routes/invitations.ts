import { Router, Request, Response } from "express";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "../utils/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { getAdminStoreId } from "../utils/storeHelper.js";

const router = Router();

async function getTenantId(req: Request): Promise<string | null> {
  if (req.admin?.role === "super_admin") return null;
  const storeId = await getAdminStoreId(req.admin!);
  if (!storeId) return null;
  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { tenantId: true } });
  return store?.tenantId || null;
}

router.get("/", authMiddleware, async (req: Request, res: Response) => {
  const tenantId = await getTenantId(req);
  if (!tenantId) { res.status(403).json({ error: "No tenant" }); return; }

  const invitations = await prisma.invitation.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
  });

  res.json({
    invitations: invitations.map((i) => ({
      ...i,
      createdAt: i.createdAt.toISOString(),
      expiresAt: i.expiresAt.toISOString(),
      acceptedAt: i.acceptedAt?.toISOString() || null,
    })),
  });
});

const createSchema = z.object({
  email: z.string().email(),
  role: z.string().default("EDITOR"),
});

router.post("/", authMiddleware, async (req: Request, res: Response) => {
  const tenantId = await getTenantId(req);
  if (!tenantId) { res.status(403).json({ error: "No tenant" }); return; }

  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() }); return; }

  const { email, role } = parsed.data;

  const existing = await prisma.invitation.findFirst({ where: { tenantId, email, acceptedAt: null } });
  if (existing) { res.status(409).json({ error: "Invitation already sent to this email" }); return; }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const invitation = await prisma.invitation.create({
    data: { tenantId, email, role, token, expiresAt },
  });

  res.status(201).json({
    ...invitation,
    createdAt: invitation.createdAt.toISOString(),
    expiresAt: invitation.expiresAt.toISOString(),
  });
});

router.delete("/:id", authMiddleware, async (req: Request, res: Response) => {
  const tenantId = await getTenantId(req);
  if (!tenantId) { res.status(403).json({ error: "No tenant" }); return; }

  const invitation = await prisma.invitation.findFirst({ where: { id: String(req.params.id), tenantId } });
  if (!invitation) { res.status(404).json({ error: "Invitation not found" }); return; }

  await prisma.invitation.delete({ where: { id: invitation.id } });
  res.json({ success: true });
});

router.get("/accept/:token", async (req: Request, res: Response) => {
  const invitation = await prisma.invitation.findUnique({ where: { token: String(req.params.token) } });
  if (!invitation) {
    res.status(404).json({ error: "Invalid or expired invitation link", valid: false });
    return;
  }
  if (invitation.acceptedAt) {
    res.json({ error: "Invitation already accepted", valid: false });
    return;
  }
  if (new Date() > invitation.expiresAt) {
    res.json({ error: "Invitation has expired", valid: false });
    return;
  }

  res.json({
    valid: true,
    email: invitation.email,
    role: invitation.role,
    tenantId: invitation.tenantId,
    token: invitation.token,
  });
});

router.post("/accept", async (req: Request, res: Response) => {
  const parsed = z.object({
    token: z.string(),
    username: z.string().min(3),
    password: z.string().min(6),
  }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() }); return; }

  const { token, username, password } = parsed.data;
  const invitation = await prisma.invitation.findUnique({ where: { token } });
  if (!invitation || invitation.acceptedAt) {
    res.status(400).json({ error: "Invalid or already accepted invitation" });
    return;
  }
  if (new Date() > invitation.expiresAt) {
    res.status(400).json({ error: "Invitation has expired" });
    return;
  }

  const bcrypt = await import("bcryptjs");
  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.admin.create({
    data: { username, email: invitation.email, passwordHash },
  });

  await prisma.tenantUser.create({
    data: { tenantId: invitation.tenantId, adminId: admin.id, role: invitation.role },
  });

  await prisma.invitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } });

  res.status(201).json({ success: true, message: "Account created successfully" });
});

export default router;
