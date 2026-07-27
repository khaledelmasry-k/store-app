const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const jwt = require("jsonwebtoken");

admin.initializeApp();
const db = admin.firestore();

const JWT_SECRET = "mk-store-jwt-secret-2b26f";

function auth(req) {
  const h = req.headers.authorization || "";
  if (!h.startsWith("Bearer ")) return null;
  try { return jwt.verify(h.slice(7), JWT_SECRET); } catch { return null; }
}

function json(res, data, status = 200) {
  res.status(status).json(data);
}

function parseJsonField(val, fallback) {
  if (typeof val === "string") {
    try { const p = JSON.parse(val); return typeof p === "object" && p !== null ? p : fallback; }
    catch { return fallback; }
  }
  return val || fallback;
}

// ───── Seed ─────
let seeded = false;
async function ensureSeed() {
  if (seeded) return;
  const snap = await db.collection("admins").doc("admin").get();
  if (snap.exists) { seeded = true; return; }
  const bcrypt = require("bcryptjs");
  const hash = bcrypt.hashSync("admin123", 10);
  await db.collection("admins").doc("admin").set({ username: "admin", password: hash });
  await db.collection("products").doc("default").set({
    name: "بنطلون كتان فرنساوي", description: "بنطلون كتان فرنساوي فاخر - خامة طبيعية 100%",
    price: 500, oldPrice: 0, active: true,
    colors: ["أسود", "بيج", "زيتي", "أبيض"], sizes: ["L", "XL", "XXL"],
    images: {}, pricingTiers: { "1": 500, "2": 900, "3": 1200, "4": 1400 },
    variantStock: {
      أسود: { L: 10, XL: 10, XXL: 10 },
      بيج: { L: 10, XL: 10, XXL: 10 },
      زيتي: { L: 10, XL: 10, XXL: 10 },
      أبيض: { L: 10, XL: 10, XXL: 10 },
    },
  });
  seeded = true;
}

exports.api = onRequest({ cors: true, minInstances: 0 }, async (req, res) => {
  await ensureSeed();
  const path = req.path.replace(/\/$/, "");
  const method = req.method;

  // ─── Login ───
  if (path === "/api/admin/login" && method === "POST") {
    const { username, password } = req.body || {};
    const doc = await db.collection("admins").doc(username || "x").get();
    if (!doc.exists) return json(res, { error: "Invalid credentials" }, 401);
    const bcrypt = require("bcryptjs");
    if (!bcrypt.compareSync(password, doc.data().password)) return json(res, { error: "Invalid credentials" }, 401);
    const token = jwt.sign({ username, role: "admin" }, JWT_SECRET, { expiresIn: "7d" });
    return json(res, { token, user: { username } });
  }

  const user = auth(req);
  if (!user) return json(res, { error: "Unauthorized" }, 401);

  // ─── Dashboard ───
  if (path === "/api/admin/orders/dashboard" && method === "GET") {
    const allOrders = await db.collection("orders").get();
    const orders = allOrders.docs.map((d) => ({ id: d.id, ...d.data(), items: d.data().items || [] }));
    const counts = { NEW: 0, CONTACTED: 0, PROCESSING: 0, SHIPPED: 0, DELIVERED: 0, CANCELLED: 0 };
    function emptyPerson() { return { totalOrders: 0, NEW: 0, CONTACTED: 0, PROCESSING: 0, SHIPPED: 0, DELIVERED: 0, CANCELLED: 0, totalRevenue: 0, totalQuantity: 0 }; }
    const pk = emptyPerson(), pm = emptyPerson();
    for (const o of orders) {
      if (counts[o.status] !== undefined) counts[o.status]++;
      const p = o.createdBy === "1" ? pk : o.createdBy === "2" ? pm : null;
      if (p) {
        p.totalOrders++;
        if (p[o.status] !== undefined) p[o.status]++;
        p.totalRevenue += o.totalPrice || 0;
        for (const item of o.items || []) p.totalQuantity += item.quantity || 0;
      }
    }
    const totalOrders = Object.values(counts).reduce((a, b) => a + b, 0);
    const prod = await db.collection("products").doc("default").get();
    const vs = prod.data()?.variantStock || {};
    let totalStock = 0;
    for (const sizes of Object.values(vs)) for (const q of Object.values(sizes)) totalStock += q;
    return json(res, { totalOrders, ...counts, khaledStats: pk, mahmoudStats: pm, totalStock, variantStock: vs });
  }

  // ─── Orders list ───
  if (path === "/api/admin/orders" && method === "GET") {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
    const search = (req.query.search || "").toString();
    const phone = (req.query.phone || "").toString();
    const status = (req.query.status || "").toString();
    let query = db.collection("orders").orderBy("createdAt", "desc");
    let all = await query.get();
    let orders = all.docs.map((d) => ({ id: d.id, ...d.data(), items: d.data().items || [] }));
    if (search) orders = orders.filter((o) => (o.customerName || "").includes(search));
    if (phone) orders = orders.filter((o) => (o.phone || "").includes(phone));
    if (status) orders = orders.filter((o) => o.status === status);
    const total = orders.length;
    const paged = orders.slice((page - 1) * limit, page * limit);
    return json(res, { orders: paged, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  }

  // ─── Single order ───
  const orderMatch = path.match(/^\/api\/admin\/orders\/([^/]+)$/);
  if (orderMatch && method === "GET") {
    const doc = await db.collection("orders").doc(orderMatch[1]).get();
    if (!doc.exists) return json(res, { error: "Not found" }, 404);
    return json(res, { id: doc.id, ...doc.data(), items: doc.data().items || [] });
  }

  // ─── Update status ───
  const statusMatch = path.match(/^\/api\/admin\/orders\/([^/]+)\/status$/);
  if (statusMatch && method === "PATCH") {
    const st = req.body?.status;
    const valid = ["NEW", "CONTACTED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"];
    if (!valid.includes(st)) return json(res, { error: "Invalid status" }, 400);
    await db.collection("orders").doc(statusMatch[1]).update({ status: st });
    return json(res, { success: true });
  }

  // ─── Delete order ───
  if (orderMatch && method === "DELETE") {
    const doc = await db.collection("orders").doc(orderMatch[1]).get();
    if (!doc.exists) return json(res, { error: "Not found" }, 404);
    const data = doc.data();
    const prodDoc = await db.collection("products").doc("default").get();
    if (prodDoc.exists) {
      const vs = { ...(prodDoc.data().variantStock || {}) };
      for (const item of data.items || []) {
        if (!vs[item.color]) vs[item.color] = {};
        vs[item.color][item.size] = (vs[item.color][item.size] || 0) + (item.quantity || 0);
      }
      await db.collection("products").doc("default").update({ variantStock: vs });
    }
    await db.collection("orders").doc(orderMatch[1]).delete();
    return json(res, { success: true });
  }

  // ─── Product (GET / PUT) ───
  if (path === "/api/admin/product" && method === "GET") {
    const doc = await db.collection("products").doc("default").get();
    return json(res, { id: "default", ...doc.data() });
  }
  if (path === "/api/admin/product" && method === "PUT") {
    const body = req.body || {};
    const upd = {};
    for (const k of ["name", "description", "price", "oldPrice", "active", "colors", "sizes", "images", "pricingTiers", "variantStock"]) {
      if (body[k] !== undefined) upd[k] = body[k];
    }
    await db.collection("products").doc("default").update(upd);
    const doc = await db.collection("products").doc("default").get();
    return json(res, { id: "default", ...doc.data() });
  }

  // ─── Upload ───
  if (path === "/api/admin/upload" && method === "POST") {
    return json(res, { error: "File upload not supported on serverless. Use a URL instead." }, 400);
  }

  // ─── Store: product ───
  if (path === "/api/orders/product" && method === "GET") {
    const doc = await db.collection("products").doc("default").get();
    const d = doc.data();
    let totalStock = 0;
    const vs = d?.variantStock || {};
    for (const sizes of Object.values(vs)) for (const q of Object.values(sizes)) totalStock += q;
    return json(res, { ...d, stock: totalStock });
  }

  // ─── Store: create order ───
  if (path === "/api/orders" && method === "POST") {
    const body = req.body || {};
    const { customerName, phone, governorate, city, address, notes, ref, items } = body;
    if (!customerName || !phone || !governorate || !city || !address || !items?.length) {
      return json(res, { error: "Missing required fields" }, 400);
    }
    const prodDoc = await db.collection("products").doc("default").get();
    if (!prodDoc.exists) return json(res, { error: "Product not found" }, 404);
    const vs = { ...(prodDoc.data().variantStock || {}) };
    for (const item of items) {
      const avail = vs[item.color]?.[item.size] || 0;
      if (avail < item.quantity) return json(res, { error: `Insufficient stock for ${item.color}/${item.size}` }, 400);
    }
    for (const item of items) {
      vs[item.color] = { ...vs[item.color] };
      vs[item.color][item.size] = (vs[item.color][item.size] || 0) - item.quantity;
    }
    const totalQty = items.reduce((s, i) => s + i.quantity, 0);
    const tiers = prodDoc.data().pricingTiers || {};
    const defaultTiers = { 1: 500, 2: 900, 3: 1200, 4: 1400 };
    const t = Object.keys(tiers).length ? Object.fromEntries(Object.entries(tiers).map(([k, v]) => [Number(k), v])) : defaultTiers;
    let totalPrice;
    if (totalQty >= 4 && t[4]) totalPrice = t[4] + (totalQty - 4) * Math.round(t[4] / 4);
    else totalPrice = t[totalQty] || totalQty * (t[1] || defaultTiers[1]);

    const ordRef = await db.collection("orders").add({
      orderNumber: "ORD-" + String(await db.collection("orders").get().then(s => s.size + 1)).padStart(5, "0"),
      customerName, phone, governorate, city, address, notes: notes || "",
      status: "NEW", totalPrice, createdBy: ref || "", createdAt: admin.firestore.FieldValue.serverTimestamp(),
      items: items.map((i) => ({ color: i.color, size: i.size, quantity: i.quantity })),
    });
    await db.collection("products").doc("default").update({ variantStock: vs });
    const doc = await ordRef.get();
    return json(res, { orderNumber: doc.data().orderNumber, totalPrice, items: doc.data().items, message: "تم استلام طلبك بنجاح" });
  }

  return json(res, { error: "Not found" }, 404);
});
