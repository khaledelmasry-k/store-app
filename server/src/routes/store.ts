import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../utils/prisma.js";
import { generateOrderNumber } from "../utils/orderNumber.js";
import { parseJsonField } from "../utils/parseJson.js";
import { computeTotalStock } from "../utils/stock.js";

function qs(val: unknown): string { return typeof val === "string" ? val : ""; }

const router = Router();

const DEFAULT_TIERS: Record<number, number> = { 1: 500, 2: 900, 3: 1200, 4: 1400 };

function getTotalPrice(qty: number, tiers: Record<string, number>): number {
  const t: Record<number, number> = {};
  Object.entries(tiers).forEach(([k, v]) => { t[Number(k)] = v; });
  const active = Object.keys(t).length ? t : DEFAULT_TIERS;
  if (qty >= 4 && active[4]) return active[4] + (qty - 4) * Math.round(active[4] / 4);
  return active[qty] || qty * (active[1] || DEFAULT_TIERS[1]);
}

async function resolveStore(ref: string) {
  const store = await prisma.store.findUnique({ where: { ref } });
  if (!store) return { storeId: null, storeInfo: null };
  return {
    storeId: store.id,
    storeInfo: { name: store.name, tagLine: store.tagLine, logo: store.logo, primaryColor: store.primaryColor },
  };
}

// ---- GET /products — list all products for a store ----
router.get("/products", async (req: Request, res: Response) => {
  const ref = qs(req.query.ref);
  let storeId: string | undefined;
  let storeInfo: any = null;
  if (ref) {
    const resolved = await resolveStore(ref);
    storeId = resolved.storeId || undefined;
    storeInfo = resolved.storeInfo;
  }
  const where: any = { active: true };
  if (storeId) where.storeId = storeId;
  const products = await prisma.product.findMany({ where, orderBy: { updatedAt: "desc" } });
  const result = products.map((p) => ({
    ...p,
    pricingTiers: parseJsonField<Record<string, number>>(p.pricingTiers, {}),
    variantStock: parseJsonField<Record<string, Record<string, number>>>(p.variantStock, {}),
    stock: computeTotalStock(parseJsonField<Record<string, Record<string, number>>>(p.variantStock, {})),
    images: parseJsonField<Record<string, string>>(p.images, {}),
    colors: parseJsonField<string[]>(p.colors, []),
    sizes: parseJsonField<string[]>(p.sizes, []),
  }));
  res.json({ products: result, store: storeInfo });
});

// ---- GET /product — legacy single product endpoint ----
router.get("/product", async (req: Request, res: Response) => {
  const ref = qs(req.query.ref);
  let storeId: string | undefined;
  let storeInfo: any = null;
  if (ref) {
    const resolved = await resolveStore(ref);
    storeId = resolved.storeId || undefined;
    storeInfo = resolved.storeInfo;
  }
  const where: any = {};
  if (storeId) where.storeId = storeId;
  const product = await prisma.product.findFirst({ where, orderBy: { updatedAt: "desc" } });
  if (!product) { res.status(404).json({ error: "المنتج غير موجود" }); return; }
  const variantStock = parseJsonField<Record<string, Record<string, number>>>(product.variantStock, {});
  res.json({
    ...product,
    pricingTiers: parseJsonField<Record<string, number>>(product.pricingTiers, {}),
    variantStock,
    stock: computeTotalStock(variantStock),
    images: parseJsonField<Record<string, string>>(product.images, {}),
    colors: parseJsonField<string[]>(product.colors, []),
    sizes: parseJsonField<string[]>(product.sizes, []),
    store: storeInfo,
  });
});

// ---- Order schemas ----
const orderItemSchema = z.object({
  productId: z.string().optional(),
  name: z.string().optional(),
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
  sellerId: z.string().optional(),
  landingPageId: z.string().optional(),
  landingPageSlug: z.string().optional(),
  marketingLinkId: z.string().optional(),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
  items: z.array(orderItemSchema).min(1, "يجب إضافة منتج واحد على الأقل"),
});

// ---- POST / — create order with full attribution ----
router.post("/", async (req: Request, res: Response) => {
  const parsed = orderSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "بيانات غير صحيحة", details: parsed.error.flatten() }); return; }

  const ref = parsed.data.ref;
  let storeId: string | undefined;
  let tenantId: string | undefined;
  if (ref) {
    const store = await prisma.store.findUnique({ where: { ref }, select: { id: true, tenantId: true } });
    if (store) { storeId = store.id; tenantId = store.tenantId || undefined; }
  }
  if (!storeId) { res.status(400).json({ error: "المتجر غير موجود" }); return; }

  const { items, ref: _ref, sellerId, landingPageId, landingPageSlug, marketingLinkId, utmSource, utmMedium, utmCampaign, ...orderData } = parsed.data;

  // Validate stock
  const productIds = [...new Set(items.filter((i) => i.productId).map((i) => i.productId!))];
  const products = productIds.length > 0
    ? await prisma.product.findMany({ where: { id: { in: productIds }, active: true, storeId } })
    : await prisma.product.findFirst({ where: { storeId, active: true }, orderBy: { updatedAt: "desc" } }).then((p) => p ? [p] : []);
  if (products.length === 0) { res.status(400).json({ error: "لا توجد منتجات متاحة" }); return; }

  const productMap = new Map(products.map((p) => [p.id, p]));
  for (const item of items) {
    const pid = item.productId || products[0].id;
    const product = productMap.get(pid) || products[0];
    if (!product || !product.active) { res.status(400).json({ error: `المنتج "${item.name || pid}" غير متاح` }); return; }
    const vs = parseJsonField<Record<string, Record<string, number>>>(product.variantStock, {});
    const available = vs[item.color]?.[item.size] ?? 0;
    if (item.quantity > available) {
      res.status(400).json({ error: `الكمية المطلوبة من ${item.name || product.name} / ${item.color} / ${item.size} غير متوفرة (المتبقي: ${available})` });
      return;
    }
  }

  let totalPrice = 0;
  for (const item of items) {
    const pid = item.productId || products[0].id;
    const product = productMap.get(pid) || products[0];
    const tiers = parseJsonField<Record<string, number>>(product.pricingTiers, {});
    totalPrice += getTotalPrice(item.quantity, tiers);
  }

  const orderNumber = await generateOrderNumber();

  const order = await prisma.order.create({
    data: {
      customerName: orderData.customerName,
      phone: orderData.phone,
      governorate: orderData.governorate,
      city: orderData.city,
      address: orderData.address,
      notes: orderData.notes || null,
      orderNumber,
      totalPrice,
      createdBy: _ref || "",
      storeId,
      tenantId: tenantId || null,
      sellerId: sellerId || null,
      landingPageId: landingPageId || null,
      landingPageSlug: landingPageSlug || null,
      marketingLinkId: marketingLinkId || null,
      utmSource: utmSource || null,
      utmMedium: utmMedium || null,
      utmCampaign: utmCampaign || null,
      status: "NEW",
      items: {
        create: items.map((item) => {
          const pid = item.productId || products[0].id;
          const product = productMap.get(pid) || products[0];
          const tiers = parseJsonField<Record<string, number>>(product.pricingTiers, {});
          const uPrice = getTotalPrice(item.quantity, tiers) / item.quantity;
          return {
            productId: pid,
            name: item.name || product.name,
            color: item.color,
            size: item.size,
            quantity: item.quantity,
            unitPrice: Math.round(uPrice * 100) / 100,
          };
        }),
      },
    },
    include: { items: true },
  });

  // Deduct stock for each product variant
  for (const pid of [...new Set(items.map((i) => i.productId || products[0].id))]) {
    const product = productMap.get(pid);
    if (!product) continue;
    const vs = parseJsonField<Record<string, Record<string, number>>>(product.variantStock, {});
    const itemGroup = items.filter((i) => (i.productId || products[0].id) === pid);
    if (itemGroup.length === 0) continue;
    const newVs = JSON.parse(JSON.stringify(vs));
    for (const item of itemGroup) {
      if (!newVs[item.color]) newVs[item.color] = {};
      newVs[item.color][item.size] = (newVs[item.color][item.size] ?? 0) - item.quantity;
    }
    await prisma.product.update({ where: { id: product.id }, data: { variantStock: JSON.stringify(newVs) } });
  }

  res.status(201).json({
    orderNumber: order.orderNumber,
    totalPrice,
    items: order.items.map((i) => ({ color: i.color, size: i.size, quantity: i.quantity })),
    message: "تم استلام طلبك بنجاح",
  });
});

// ---- GET /track/:orderNumber — order tracking ----
router.get("/track/:orderNumber", async (req: Request<{ orderNumber: string }>, res: Response) => {
  const order = await prisma.order.findUnique({
    where: { orderNumber: String(req.params.orderNumber) },
    include: { items: { select: { name: true, color: true, size: true, quantity: true, unitPrice: true } } },
  });
  if (!order) { res.status(404).json({ error: "الطلب غير موجود" }); return; }
  res.json({
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    totalPrice: order.totalPrice,
    status: order.status,
    governorate: order.governorate,
    city: order.city,
    createdAt: order.createdAt,
    items: order.items,
    utmSource: order.utmSource,
    utmCampaign: order.utmCampaign,
  });
});

// ---- GET /links/resolve/:slug — resolve marketing link with full attribution ----
router.get("/links/resolve/:slug", async (req: Request<{ slug: string }>, res: Response) => {
  const link = await prisma.storeLink.findUnique({
    where: { slug: String(req.params.slug) },
    include: {
      store: { select: { ref: true, tenantId: true } },
      seller: { select: { id: true, name: true } },
      landingPage: { select: { id: true, slug: true } },
    },
  });
  if (!link) { res.status(404).json({ error: "Link not found" }); return; }
  await prisma.storeLink.update({ where: { id: link.id }, data: { clicks: { increment: 1 } } });
  res.json({
    id: link.id,
    slug: link.slug,
    storeRef: link.store.ref,
    tenantId: link.store.tenantId,
    sellerId: link.seller?.id || null,
    sellerName: link.seller?.name || null,
    landingPageId: link.landingPage?.id || null,
    landingPageSlug: link.landingPage?.slug || null,
    utmSource: link.utmSource || null,
    utmMedium: link.utmMedium || null,
    utmCampaign: link.utmCampaign || null,
    clicks: link.clicks + 1,
  });
});

export default router;
