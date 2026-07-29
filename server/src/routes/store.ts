import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../utils/prisma.js";
import { generateOrderNumber } from "../utils/orderNumber.js";

const router = Router();

function parseJsonField<T>(val: unknown, fallback: T): T {
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      if (typeof fallback === "object" && !Array.isArray(fallback) && fallback !== null) {
        if (typeof parsed === "object" && !Array.isArray(parsed) && parsed !== null) return parsed;
        return fallback;
      }
      if (Array.isArray(fallback)) {
        if (Array.isArray(parsed)) return parsed as T;
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

const DEFAULT_TIERS: Record<number, number> = { 1: 500, 2: 900, 3: 1200, 4: 1400 };

function getTotalPrice(qty: number, tiers: Record<string, number>): number {
  const t: Record<number, number> = {};
  Object.entries(tiers).forEach(([k, v]) => { t[Number(k)] = v; });
  const active = Object.keys(t).length ? t : DEFAULT_TIERS;
  if (qty >= 4 && active[4]) return active[4] + (qty - 4) * Math.round(active[4] / 4);
  return active[qty] || qty * (active[1] || DEFAULT_TIERS[1]);
}

router.get("/product", async (_req: Request, res: Response) => {
  const product = await prisma.product.findFirst();
  if (!product) {
    res.status(404).json({ error: "المنتج غير موجود" });
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

const orderItemSchema = z.object({
  color: z.string().min(1),
  size: z.string().min(1),
  quantity: z.number().int().min(1),
});

const orderSchema = z.object({
  customerName: z.string().min(1, "الاسم مطلوب"),
  phone: z.string().min(1, "رقم الجوال مطلوب"),
  governorate: z.string().min(1, "المحافظة مطلوبة"),
  city: z.string().min(1, "المدينة مطلوبة"),
  address: z.string().min(1, "العنوان مطلوب"),
  notes: z.string().optional(),
  ref: z.string().optional(),
  items: z.array(orderItemSchema).min(1, "يجب إضافة منتج واحد على الأقل"),
});

router.post("/", async (req: Request, res: Response) => {
  const parsed = orderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات غير صحيحة", details: parsed.error.flatten() });
    return;
  }
  const product = await prisma.product.findFirst();
  if (!product || !product.active) {
    res.status(400).json({ error: "المنتج غير متاح حالياً" });
    return;
  }

  const variantStock = parseJsonField<Record<string, Record<string, number>>>(product.variantStock, {});
  const { items, ref, ...orderData } = parsed.data;
  const totalQty = items.reduce((sum, i) => sum + i.quantity, 0);

  for (const item of items) {
    const available = variantStock[item.color]?.[item.size] ?? 0;
    if (item.quantity > available) {
      res.status(400).json({
        error: `الكمية المطلوبة من ${item.color} / ${item.size} غير متوفرة (المتبقي: ${available})`,
      });
      return;
    }
  }

  const tiers = parseJsonField<Record<string, number>>(product.pricingTiers, {});
  const totalPrice = getTotalPrice(totalQty, tiers);
  const unitPrice = totalQty > 0 ? totalPrice / totalQty : 0;
  const orderNumber = await generateOrderNumber();

  const order = await prisma.order.create({
    data: {
      ...orderData,
      orderNumber,
      totalPrice,
      createdBy: ref || "",
      status: "NEW",
      items: {
        create: items.map((item) => ({ ...item, unitPrice })),
      },
    },
    include: { items: true },
  });

  const newVariantStock = { ...variantStock };
  for (const item of items) {
    newVariantStock[item.color] = { ...newVariantStock[item.color] };
    newVariantStock[item.color][item.size] = (newVariantStock[item.color][item.size] ?? 0) - item.quantity;
  }

  await prisma.product.update({
    where: { id: product.id },
    data: { variantStock: JSON.stringify(newVariantStock) },
  });

  res.status(201).json({
    orderNumber: order.orderNumber,
    totalPrice,
    items: order.items.map((i: { color: string; size: string; quantity: number }) => ({ color: i.color, size: i.size, quantity: i.quantity })),
    message: "تم استلام طلبك بنجاح",
  });
});

export default router;
