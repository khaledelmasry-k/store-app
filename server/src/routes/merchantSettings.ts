import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../utils/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { getAdminStoreId } from "../utils/storeHelper.js";
import { parseJsonField } from "../utils/parseJson.js";

const router = Router();
router.use(authMiddleware);

async function getStore(req: Request, res: Response) {
  const storeId = await getAdminStoreId(req.admin!);
  if (!storeId) { res.status(403).json({ error: "Store not found" }); return null; }
  return storeId;
}

router.get("/", async (req: Request, res: Response) => {
  const storeId = await getStore(req, res);
  if (!storeId) return;
  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store) { res.status(404).json({ error: "Store not found" }); return; }
  const settings = parseJsonField<Record<string, any>>(store.settings, {});
  const tenant = store.tenantId
    ? await prisma.tenant.findUnique({ where: { id: store.tenantId }, select: { id: true, name: true, subdomain: true, email: true, domain: true } })
    : null;
  res.json({ store: { ...store, settings }, tenant });
});

const storeUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  tagLine: z.string().optional().nullable(),
  logo: z.string().optional().nullable(),
  primaryColor: z.string().optional().nullable(),
});

router.put("/store", async (req: Request, res: Response) => {
  const parsed = storeUpdateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() }); return; }
  const storeId = await getStore(req, res);
  if (!storeId) return;
  const updated = await prisma.store.update({ where: { id: storeId }, data: parsed.data });
  res.json(updated);
});

const settingsUpdateSchema = z.object({
  shipping: z.object({
    governorates: z.array(z.object({ name: z.string(), price: z.number() })).optional(),
    freeShippingMin: z.number().optional(),
  }).optional(),
  payment: z.object({
    cod: z.boolean().optional(),
    bankTransfer: z.boolean().optional(),
    bankAccount: z.string().optional(),
  }).optional(),
  whatsapp: z.object({ number: z.string().optional(), message: z.string().optional() }).optional(),
  pixel: z.object({ facebookPixelId: z.string().optional(), googleAnalyticsId: z.string().optional() }).optional(),
  seo: z.object({ title: z.string().optional(), description: z.string().optional(), keywords: z.string().optional() }).optional(),
  social: z.object({ facebook: z.string().optional(), instagram: z.string().optional(), tiktok: z.string().optional() }).optional(),
  domain: z.object({ customDomain: z.string().optional(), sslEnabled: z.boolean().optional() }).optional(),
});

router.put("/settings", async (req: Request, res: Response) => {
  const parsed = settingsUpdateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() }); return; }
  const storeId = await getStore(req, res);
  if (!storeId) return;
  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { settings: true } });
  if (!store) { res.status(404).json({ error: "Store not found" }); return; }
  const current = parseJsonField<Record<string, any>>(store.settings, {});
  const merged = { ...current, ...parsed.data };
  const updated = await prisma.store.update({ where: { id: storeId }, data: { settings: JSON.stringify(merged) } });
  res.json(parseJsonField<Record<string, any>>(updated.settings, {}));
});

export default router;
