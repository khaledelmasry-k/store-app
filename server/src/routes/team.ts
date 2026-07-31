import { Router, Request, Response } from "express";
import { prisma } from "../utils/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireStore, requirePermission, getReqTenantId } from "../middleware/permission.js";

const router = Router();
router.use(authMiddleware, requireStore);

router.get("/", async (req: Request, res: Response) => {
  const tenantId = await getReqTenantId(req);
  if (!tenantId) { res.status(403).json({ error: "No tenant" }); return; }

  const members = await prisma.tenantUser.findMany({
    where: { tenantId },
    include: { admin: { select: { id: true, username: true, email: true, role: true, createdAt: true } } },
    orderBy: { createdAt: "asc" },
  });

  res.json({
    members: members.map((m) => ({
      id: m.id,
      adminId: m.admin.id,
      username: m.admin.username,
      email: m.admin.email,
      role: m.role,
      adminRole: m.admin.role,
      createdAt: m.createdAt.toISOString(),
    })),
  });
});

router.delete("/:id", requirePermission("team", "delete"), async (req: Request, res: Response) => {
  const tenantId = await getReqTenantId(req);
  if (!tenantId) { res.status(403).json({ error: "No tenant" }); return; }

  const member = await prisma.tenantUser.findFirst({
    where: { id: String(req.params.id), tenantId },
  });
  if (!member) { res.status(404).json({ error: "Member not found" }); return; }
  if (member.adminId === req.admin!.adminId) {
    res.status(400).json({ error: "Cannot remove yourself" });
    return;
  }

  await prisma.tenantUser.delete({ where: { id: member.id } });
  res.json({ success: true });
});

export default router;
