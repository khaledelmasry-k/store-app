import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../utils/prisma.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

function parseJsonField<T>(val: unknown, fallback: T): T {
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      if (typeof fallback === "object" && !Array.isArray(fallback) && fallback !== null) {
        if (typeof parsed === "object" && !Array.isArray(parsed) && parsed !== null) return parsed;
        return fallback;
      }
      if (Array.isArray(fallback)) {
        if (Array.isArray(parsed)) return parsed;
        return fallback;
      }
      return parsed;
    } catch { return fallback; }
  }
  return val as T;
}

function computeTotalStock(vs: Record<string, Record<string, number>>): number {
  let total = 0;
  for (const sizes of Object.values(vs)) {
    for (const qty of Object.values(sizes)) {
      total += qty;
    }
  }
  return total;
}

router.get("/", async (_req: Request, res: Response) => {
  let product = await prisma.product.findFirst();
  if (!product) {
    product = await prisma.product.create({
      data: {
        name: "المنتج",
        description: "",
        price: 0,
        images: "{}",
        colors: "[]",
        sizes: "[]",
        pricingTiers: "{}",
        variantStock: "{}",
      },
    });
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

router.put("/", async (req: Request, res: Response) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }
  let product = await prisma.product.findFirst();
  const data: any = { ...parsed.data };
  if (data.pricingTiers) data.pricingTiers = JSON.stringify(data.pricingTiers);
  if (data.variantStock) data.variantStock = JSON.stringify(data.variantStock);
  if (data.images) data.images = JSON.stringify(data.images);
  if (data.colors) data.colors = JSON.stringify(data.colors);
  if (data.sizes) data.sizes = JSON.stringify(data.sizes);

  if (!product) {
    product = await prisma.product.create({
      data: {
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

export default router;
