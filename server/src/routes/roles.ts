import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../utils/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { getAdminStoreId } from "../utils/storeHelper.js";

const router = Router();
router.use(authMiddleware);

const RESOURCES = ["products", "orders", "customers", "reports", "settings", "team", "sellers", "landing-pages", "store-links"] as const;
const ACTIONS = ["view", "create", "edit", "delete"] as const;

async function getTenantId(req: Request): Promise<string | null> {
  if (req.admin?.role === "super_admin") return null;
  const storeId = await getAdminStoreId(req.admin!);
  if (!storeId) return null;
  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { tenantId: true } });
  return store?.tenantId || null;
}

router.get("/", async (req: Request, res: Response) => {
  const tenantId = await getTenantId(req);
  if (!tenantId) { res.status(403).json({ error: "No tenant" }); return; }

  const roles = await prisma.role.findMany({
    where: { tenantId },
    include: { permissions: { select: { id: true, resource: true, action: true } } },
    orderBy: { createdAt: "asc" },
  });

  res.json({ roles: roles.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() })) });
});

router.get("/resources", async (_req: Request, res: Response) => {
  res.json({ resources: RESOURCES, actions: ACTIONS });
});

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  permissions: z.array(z.object({ resource: z.enum(RESOURCES), action: z.enum(ACTIONS) })).optional(),
});

router.post("/", async (req: Request, res: Response) => {
  const tenantId = await getTenantId(req);
  if (!tenantId) { res.status(403).json({ error: "No tenant" }); return; }

  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() }); return; }

  const { name, description, permissions } = parsed.data;
  const existing = await prisma.role.findUnique({ where: { tenantId_name: { tenantId, name } } });
  if (existing) { res.status(409).json({ error: "Role already exists" }); return; }

  const role = await prisma.role.create({
    data: {
      tenantId,
      name,
      description,
      permissions: permissions ? { create: permissions } : undefined,
    },
    include: { permissions: { select: { id: true, resource: true, action: true } } },
  });

  res.status(201).json(role);
});

router.put("/:id", async (req: Request, res: Response) => {
  const tenantId = await getTenantId(req);
  if (!tenantId) { res.status(403).json({ error: "No tenant" }); return; }

  const role = await prisma.role.findFirst({ where: { id: String(req.params.id), tenantId } });
  if (!role) { res.status(404).json({ error: "Role not found" }); return; }

  const parsed = createSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() }); return; }

  const { name, description, permissions } = parsed.data;
  if (name && name !== role.name) {
    const dup = await prisma.role.findUnique({ where: { tenantId_name: { tenantId, name } } });
    if (dup) { res.status(409).json({ error: "Role name already exists" }); return; }
  }

  if (permissions) {
    await prisma.permission.deleteMany({ where: { roleId: role.id } });
    await prisma.permission.createMany({ data: permissions.map((p) => ({ roleId: role.id, ...p })) });
  }

  const updated = await prisma.role.update({
    where: { id: role.id },
    data: { name, description },
    include: { permissions: { select: { id: true, resource: true, action: true } } },
  });

  res.json(updated);
});

router.delete("/:id", async (req: Request, res: Response) => {
  const tenantId = await getTenantId(req);
  if (!tenantId) { res.status(403).json({ error: "No tenant" }); return; }

  const role = await prisma.role.findFirst({ where: { id: String(req.params.id), tenantId } });
  if (!role) { res.status(404).json({ error: "Role not found" }); return; }

  await prisma.permission.deleteMany({ where: { roleId: role.id } });
  await prisma.role.delete({ where: { id: role.id } });
  res.json({ success: true });
});

export default router;
