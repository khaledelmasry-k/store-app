import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../utils/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { getAdminStoreId } from "../utils/storeHelper.js";
import { parseJsonField } from "../utils/parseJson.js";
import { computeTotalStock } from "../utils/stock.js";

const router = Router();
router.use(authMiddleware);

router.get("/", async (req: Request, res: Response) => {
  const storeId = await getAdminStoreId(req.admin!);
  const page = Math.max(1, parseInt(String(req.query.page)) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit)) || 10));
  const search = String(req.query.search || "");
  const where: any = storeId ? { storeId } : {};
  if (search) where.name = { contains: search };

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.product.count({ where }),
  ]);

  res.json({
    products: products.map((p) => ({
      ...p,
      pricingTiers: parseJsonField<Record<string, number>>(p.pricingTiers, {}),
      variantStock: parseJsonField<Record<string, Record<string, number>>>(p.variantStock, {}),
      stock: computeTotalStock(parseJsonField<Record<string, Record<string, number>>>(p.variantStock, {})),
      images: parseJsonField<Record<string, string>>(p.images, {}),
      colors: parseJsonField<string[]>(p.colors, []),
      sizes: parseJsonField<string[]>(p.sizes, []),
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

router.get("/:id", async (req: Request<{ id: string }>, res: Response) => {
  const storeId = await getAdminStoreId(req.admin!);
  const where: any = { id: String(req.params.id) };
  if (storeId) where.storeId = storeId;
  const product = await prisma.product.findFirst({ where });
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  res.json({
    ...product,
    pricingTiers: parseJsonField<Record<string, number>>(product.pricingTiers, {}),
    variantStock: parseJsonField<Record<string, Record<string, number>>>(product.variantStock, {}),
    stock: computeTotalStock(parseJsonField<Record<string, Record<string, number>>>(product.variantStock, {})),
    images: parseJsonField<Record<string, string>>(product.images, {}),
    colors: parseJsonField<string[]>(product.colors, []),
    sizes: parseJsonField<string[]>(product.sizes, []),
  });
});

const productSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().default(""),
  price: z.number().positive(),
  oldPrice: z.number().positive().optional().nullable(),
  sku: z.string().optional().nullable(),
  pricingTiers: z.record(z.number()).optional(),
  variantStock: z.record(z.record(z.number())).optional(),
  images: z.record(z.string()).optional(),
  colors: z.array(z.string()).optional(),
  sizes: z.array(z.string()).optional(),
  active: z.boolean().optional().default(true),
});

router.post("/", async (req: Request, res: Response) => {
  const parsed = productSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }
  const storeId = await getAdminStoreId(req.admin!);
  const data: any = { ...parsed.data, storeId: storeId || undefined };
  if (data.pricingTiers) data.pricingTiers = JSON.stringify(data.pricingTiers);
  if (data.variantStock) data.variantStock = JSON.stringify(data.variantStock);
  if (data.images) data.images = JSON.stringify(data.images);
  if (data.colors) data.colors = JSON.stringify(data.colors);
  if (data.sizes) data.sizes = JSON.stringify(data.sizes);
  const product = await prisma.product.create({ data });
  res.status(201).json(product);
});

router.put("/:id", async (req: Request<{ id: string }>, res: Response) => {
  const storeId = await getAdminStoreId(req.admin!);
  const where: any = { id: String(req.params.id) };
  if (storeId) where.storeId = storeId;
  const existing = await prisma.product.findFirst({ where });
  if (!existing) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  const parsed = productSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }
  const data: any = { ...parsed.data };
  if (data.pricingTiers) data.pricingTiers = JSON.stringify(data.pricingTiers);
  if (data.variantStock) data.variantStock = JSON.stringify(data.variantStock);
  if (data.images) data.images = JSON.stringify(data.images);
  if (data.colors) data.colors = JSON.stringify(data.colors);
  if (data.sizes) data.sizes = JSON.stringify(data.sizes);
  const updated = await prisma.product.update({ where: { id: existing.id }, data });
  res.json(updated);
});

router.delete("/:id", async (req: Request<{ id: string }>, res: Response) => {
  const storeId = await getAdminStoreId(req.admin!);
  const where: any = { id: String(req.params.id) };
  if (storeId) where.storeId = storeId;
  const existing = await prisma.product.findFirst({ where });
  if (!existing) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  await prisma.product.delete({ where: { id: existing.id } });
  res.json({ success: true });
});

router.get("/low-stock", async (req: Request, res: Response) => {
  const storeId = await getAdminStoreId(req.admin!);
  const where: any = storeId ? { storeId, active: true } : { active: true };
  const products = await prisma.product.findMany({ where, orderBy: { updatedAt: "desc" } });
  const threshold = Math.max(1, parseInt(String(req.query.threshold)) || 5);
  const lowStock = products
    .map((p) => ({
      ...p,
      variantStock: parseJsonField<Record<string, Record<string, number>>>(p.variantStock, {}),
      images: parseJsonField<Record<string, string>>(p.images, {}),
      colors: parseJsonField<string[]>(p.colors, []),
      sizes: parseJsonField<string[]>(p.sizes, []),
    }))
    .filter((p) => {
      for (const color of Object.values(p.variantStock)) {
        for (const qty of Object.values(color)) {
          if (qty <= threshold) return true;
        }
      }
      return false;
    })
    .map((p) => ({
      id: p.id, name: p.name, sku: p.sku, variantStock: p.variantStock,
      images: p.images, colors: p.colors, sizes: p.sizes, stock: computeTotalStock(p.variantStock),
    }));
  res.json({ products: lowStock, threshold });
});

router.post("/:id/duplicate", async (req: Request<{ id: string }>, res: Response) => {
  const storeId = await getAdminStoreId(req.admin!);
  const where: any = { id: String(req.params.id) };
  if (storeId) where.storeId = storeId;
  const original = await prisma.product.findFirst({ where });
  if (!original) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  const product = await prisma.product.create({
    data: {
      storeId: original.storeId,
      name: `${original.name} (نسخة)`,
      description: original.description,
      price: original.price,
      oldPrice: original.oldPrice,
      pricingTiers: original.pricingTiers,
      variantStock: original.variantStock,
      images: original.images,
      colors: original.colors,
      sizes: original.sizes,
      active: false,
    },
  });
  res.status(201).json(product);
});

export default router;
