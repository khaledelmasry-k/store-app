import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../utils/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireStore, requirePermission, enforcePlanLimit } from "../middleware/permission.js";
import { parseJsonField } from "../utils/parseJson.js";
import { computeTotalStock } from "../utils/stock.js";

const router = Router();
router.use(authMiddleware, requireStore);

router.get("/", async (req: Request, res: Response) => {
  const where = req.storeId ? { storeId: req.storeId } : {};
  let product = await prisma.product.findFirst({ where, orderBy: { updatedAt: "desc" } });
  if (!product) {
    res.json(null);
    return;
  }
  const variantStock = parseJsonField<Record<string, Record<string, number>>>(product.variantStock, {});
  res.json({
    ...product,
    pricingTiers: parseJsonField<Record<string, number>>(product.pricingTiers, {}),
    variantStock,
    stock: computeTotalStock(variantStock),
    images: parseJsonField<Record<string, string>>(product.images, {}),
    colors: parseJsonField<string[]>(product.colors, []),
    sizes: parseJsonField<string[]>(product.sizes, []),
  });
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  price: z.number().positive().optional(),
  oldPrice: z.number().positive().optional().nullable(),
  pricingTiers: z.record(z.number()).optional(),
  variantStock: z.record(z.record(z.number())).optional(),
  images: z.record(z.string()).optional(),
  colors: z.array(z.string()).optional(),
  sizes: z.array(z.string()).optional(),
  active: z.boolean().optional(),
});

router.put("/", requirePermission("products", "edit"), async (req: Request, res: Response) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }
  const where = req.storeId ? { storeId: req.storeId } : {};
  let product = await prisma.product.findFirst({ where, orderBy: { updatedAt: "desc" } });
  const data: any = { ...parsed.data };
  if (data.pricingTiers) data.pricingTiers = JSON.stringify(data.pricingTiers);
  if (data.variantStock) data.variantStock = JSON.stringify(data.variantStock);
  if (data.images) data.images = JSON.stringify(data.images);
  if (data.colors) data.colors = JSON.stringify(data.colors);
  if (data.sizes) data.sizes = JSON.stringify(data.sizes);

  if (!product) {
    if (!(await enforcePlanLimit(req, res, "products"))) return;
    product = await prisma.product.create({
      data: {
        storeId: req.storeId || undefined,
        name: data.name || "المنتج",
        description: data.description || "",
        price: data.price || 0,
        pricingTiers: data.pricingTiers || "{}",
        variantStock: data.variantStock || "{}",
        images: data.images || "{}",
        colors: data.colors || "[]",
        sizes: data.sizes || "[]",
      },
    });
  }
  const updated = await prisma.product.update({
    where: { id: product.id },
    data,
  });
  const variantStock = parseJsonField<Record<string, Record<string, number>>>(updated.variantStock, {});
  res.json({
    ...updated,
    pricingTiers: parseJsonField<Record<string, number>>(updated.pricingTiers, {}),
    variantStock,
    stock: computeTotalStock(variantStock),
    images: parseJsonField<Record<string, string>>(updated.images, {}),
    colors: parseJsonField<string[]>(updated.colors, []),
    sizes: parseJsonField<string[]>(updated.sizes, []),
  });
});

router.delete("/", requirePermission("products", "delete"), async (req: Request, res: Response) => {
  const where = req.storeId ? { storeId: req.storeId } : {};
  let product = await prisma.product.findFirst({ where, orderBy: { updatedAt: "desc" } });
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  await prisma.product.delete({ where: { id: product.id } });
  res.json({ success: true });
});

export default router;
